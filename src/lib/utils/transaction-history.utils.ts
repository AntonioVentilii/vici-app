import type { ClearingDid } from '$declarations';
import { USD_DECIMALS, ZERO } from '$lib/constants/app.constants';
import type { MarketId } from '$lib/types/market';
import type {
	TransactionHistoryBonusTag,
	TransactionHistoryRow
} from '$lib/types/transaction-history';
import type { Transaction } from '$lib/types/wallet';
import { nativeToClearingMarginUnits } from '$lib/utils/playground-display.utils';
import { eventExecutionPrice } from '$lib/utils/resolved-position.utils';
import { isNullish, nonNullish } from '@dfinity/utils';

/**
 * A VXP ledger transaction enriched with the bits the unified `Transaction`
 * type doesn't carry: the decoded award memo (bonus labeling) and the
 * transfer fee (running-balance accounting).
 */
export interface TransactionHistoryLedgerEntry {
	transaction: Transaction;
	memoTag?: TransactionHistoryBonusTag;
	/** Transfer fee in native ledger units (`ZERO` when absent). */
	fee: bigint;
	/**
	 * A transfer to the user's own account: the only real spendable change
	 * is the fee, so it renders no row (the wallet's send + receive
	 * pseudo-row pair would read as two phantom movements here).
	 */
	selfTransfer?: boolean;
}

const KNOWN_BONUS_TAGS: ReadonlySet<string> = new Set([
	'achievement',
	'calibration',
	'comeback',
	'league_founder',
	'new-user',
	'referral',
	'streak',
	'tournament_prize',
	'worlds_podium'
]);

const VXP_MEMO_PREFIX = 'vxp:';

/**
 * Decode a ledger memo written by the satellite payout helper
 * (`vxp:<tag>:<key>`) into a bonus tag. Returns `undefined` for non-award
 * memos so callers can keep rendering them as plain transfers; an award
 * memo whose tag is not recognized (e.g. a type added after this build)
 * degrades to `'unknown'` instead of being dropped.
 */
export const decodeVxpAwardMemo = (
	memo: Uint8Array | number[] | undefined
): TransactionHistoryBonusTag | undefined => {
	if (isNullish(memo)) {
		return;
	}

	let text: string;

	try {
		text = new TextDecoder().decode(memo instanceof Uint8Array ? memo : Uint8Array.from(memo));
	} catch (_err: unknown) {
		return;
	}

	if (!text.startsWith(VXP_MEMO_PREFIX)) {
		return;
	}

	const [, tag] = text.split(':');

	return KNOWN_BONUS_TAGS.has(tag) ? (tag as TransactionHistoryBonusTag) : 'unknown';
};

/**
 * One merged feed item before the running-balance walk. `row` is absent for
 * events that move spendable VXP but are pure noise to the reader
 * (wallet ↔ clearing sweeps, approvals) — they stay in the stream so their
 * fee still feeds the balance math, but never render.
 */
interface HistoryEntry {
	row?: Omit<TransactionHistoryRow, 'balance'>;
	delta: bigint;
	timestampNs: bigint;
}

/**
 * Margin committed by an `Executed` fill, in clearing-margin base units
 * (`USD_DECIMALS`) — the unit every other delta and the spendable anchor
 * speak.
 *
 * An event's `qty` is a whole contract count (1 unit = 1.0 of the
 * underlying) and `price` a probability in [0, 1], so `qty × price` is the
 * notional in *whole* VXP; scaling by `10^USD_DECIMALS` lifts it into base
 * units. Without that scale a 5,000 VXP stake reads as `0.5` (`<1`) and,
 * worse, never debits the running balance — the backward walk then
 * underflows old balances into the negative.
 *
 * The sign is kept deliberately: should an event ever carry a negative
 * `qty` (a closing/sell fill), its proceeds must *credit* spendable and
 * unwind the accumulated stake — taking the absolute value would debit the
 * seller twice. Non-finite prices (malformed events) contribute `ZERO`
 * rather than poisoning the whole balance walk with `NaN`.
 */
const executedCost = (event: ClearingDid.Event): bigint => {
	const marginUnits = Number(event.qty) * eventExecutionPrice(event) * 10 ** USD_DECIMALS;

	return Number.isFinite(marginUnits) ? BigInt(Math.round(marginUnits)) : ZERO;
};

/**
 * Spendable-VXP contributions of the clearing trade history.
 *
 * Deltas bind to `Executed` fills, not `OrderPlaced`: the clearing canister
 * emits no cancellation event, so a resting order debited at placement could
 * never be credited back and would skew every older balance. The margin a
 * *resting* order holds is already reflected in the live spendable anchor,
 * so fills are the honest commit point.
 *
 * A `Settled` event's signed `qty` is the realized cashflow (see
 * `settledEventToResolvedPosition`); the spendable delta additionally
 * releases the margin committed by the position's fills — a full loss nets
 * to exactly zero, a win to stake + profit.
 */
const clearingEntries = (events: ClearingDid.Event[]): HistoryEntry[] => {
	const ascending = [...events].sort((a, b) =>
		a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? 1 : -1
	);

	const stakeBySeries = new Map<string, bigint>();
	const entries: HistoryEntry[] = [];

	for (const event of ascending) {
		const [eventKey] = Object.keys(event.event_type) as Array<keyof ClearingDid.EventType>;
		const marketId = event.series_id as MarketId;
		const id = `clearing-${event.event_id.toString()}-${eventKey}`;

		if (eventKey === 'Executed') {
			const cost = executedCost(event);
			stakeBySeries.set(marketId, (stakeBySeries.get(marketId) ?? ZERO) + cost);

			entries.push({
				timestampNs: event.timestamp,
				delta: -cost,
				row: {
					id,
					kind: 'prediction',
					marketId,
					timestampNs: event.timestamp,
					delta: -cost
				}
			});
		} else if (eventKey === 'Settled' || eventKey === 'Liquidated') {
			// Clamp at zero: a series whose closing fills credited more than
			// its opening fills cost would otherwise "release" a negative
			// stake and double-debit the settlement.
			const accumulated = stakeBySeries.get(marketId) ?? ZERO;
			const released = accumulated > ZERO ? accumulated : ZERO;
			stakeBySeries.set(marketId, ZERO);

			const cashflow = event.qty;
			const delta = released + cashflow;

			const kind =
				eventKey === 'Liquidated'
					? 'liquidation'
					: cashflow > ZERO
						? 'won'
						: cashflow < ZERO
							? 'lost'
							: 'neutral';

			entries.push({
				timestampNs: event.timestamp,
				delta,
				row: {
					id,
					kind,
					marketId,
					timestampNs: event.timestamp,
					delta,
					stake: released
				}
			});
		}

		// `OrderPlaced` is ignored: informational only, no spendable move.
	}

	return entries;
};

/**
 * Spendable-VXP contributions of the VXP ledger trail. Sweeps between the
 * wallet and the clearing collateral account move VXP the user can still
 * spend, so they stay hidden — only their fee debits the balance.
 */
const ledgerEntry = ({
	transaction,
	memoTag,
	fee,
	selfTransfer
}: TransactionHistoryLedgerEntry): HistoryEntry => {
	const { token, type, timestamp, amount, id } = transaction;

	const amountMargin = nativeToClearingMarginUnits({
		nativeBalance: amount,
		nativeDecimals: token.decimals
	});
	const feeMargin = nativeToClearingMarginUnits({
		nativeBalance: fee,
		nativeDecimals: token.decimals
	});

	if (selfTransfer === true) {
		return { timestampNs: timestamp, delta: -feeMargin };
	}

	const base = { id: `ledger-${id}`, timestampNs: timestamp };

	if (type === 'Receive' || type === 'Mint') {
		const kind = nonNullish(memoTag) ? 'bonus' : type === 'Mint' ? 'minted' : 'received';

		return {
			timestampNs: timestamp,
			delta: amountMargin,
			row: { ...base, kind, bonusTag: memoTag, delta: amountMargin }
		};
	}

	switch (type) {
		case 'Send': {
			const delta = -(amountMargin + feeMargin);

			return { timestampNs: timestamp, delta, row: { ...base, kind: 'sent', delta } };
		}

		case 'Burn': {
			return {
				timestampNs: timestamp,
				delta: -amountMargin,
				row: { ...base, kind: 'burned', delta: -amountMargin }
			};
		}

		// Sweeps and approvals: spendable-neutral, fee-only, never rendered.
		default:
			return { timestampNs: timestamp, delta: -feeMargin };
	}
};

/**
 * Merge the clearing trade history and the VXP ledger trail into one
 * newest-first feed and stamp each visible row with the running spendable
 * balance after that event.
 *
 * The walk anchors on the *current* spendable figure and subtracts deltas
 * going back in time, so the top row always agrees with the number the Dash
 * hero shows — gaps in very old data shift old balances, never today's.
 */
export const assembleTransactionHistory = ({
	events,
	ledgerEntries,
	spendableAnchor,
	includeGenesis = false
}: {
	events: ClearingDid.Event[];
	ledgerEntries: TransactionHistoryLedgerEntry[];
	spendableAnchor: bigint;
	/**
	 * Append the "joined Vici" genesis marker as the oldest row. Only pass
	 * `true` when the full history was loaded (the ledger walk reached the
	 * beginning, not the page cap) — otherwise there *is* older history and
	 * the marker would lie about where the trail starts.
	 */
	includeGenesis?: boolean;
}): TransactionHistoryRow[] => {
	const entries = [...clearingEntries(events), ...ledgerEntries.map(ledgerEntry)].sort((a, b) =>
		a.timestampNs === b.timestampNs ? 0 : a.timestampNs > b.timestampNs ? -1 : 1
	);

	const rows: TransactionHistoryRow[] = [];
	let running = spendableAnchor;

	for (const entry of entries) {
		if (nonNullish(entry.row)) {
			rows.push({ ...entry.row, balance: running });
		}

		running -= entry.delta;
	}

	// The account's origin: zero VXP, before any bonus or prediction. Dated to
	// the oldest real event (the moment the user first showed up). Fixed at
	// `ZERO` rather than the walked `running`, so it reads as a clean genesis
	// even when resting-order margin leaves the walk a touch off the floor.
	if (includeGenesis && rows.length > 0) {
		rows.push({
			id: 'genesis',
			kind: 'joined',
			timestampNs: rows[rows.length - 1].timestampNs,
			delta: ZERO,
			balance: ZERO
		});
	}

	return rows;
};
