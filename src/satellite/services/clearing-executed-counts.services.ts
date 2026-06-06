import type { ClearingDid } from '$declarations';
import { CLEARING_CANISTER_ID } from '$lib/constants/canisters.constants';
import { candidMethod } from '$satellite/utils/candid.utils';
import type { Principal } from '@icp-sdk/core/principal';
import { call } from '@junobuild/functions/ic-cdk';

/**
 * Authoritative, clearing-derived count of a user's *Executed* trades.
 *
 * These counts are read from the clearing canister's event log — the
 * on-chain source of truth for what actually traded — rather than from
 * any client-written profile field (e.g. `totalTrades`). A profile field
 * is set by the user's own browser and is therefore spoofable; an Executed
 * event only exists because the clearing engine matched and recorded a real
 * trade. Anything that credits real value off "how much has this user
 * traded" (e.g. an anti-cheat gate on a VXP grant) must derive that figure
 * here, server-side, never from the profile.
 *
 * The flow economy is denominated in VXP, whose clearing balance domain is
 * `ViciXp` (see {@link import('$lib/utils/balance-domain.utils')}). Clearing
 * `Event`s, however, are not tagged with a balance domain — the domain lives
 * on the series/market, and the client scopes history to a domain by
 * intersecting events with that domain's market id set. These counts are the
 * caller's *lifetime* Executed activity across markets, which is the figure
 * an anti-cheat trigger wants (a global "is this user a real trader?" check),
 * so no per-domain market intersection is applied here.
 */
export interface ExecutedCounts {
	/** Total Executed trades for the user, all time. */
	lifetimeExecutedCount: number;
	/**
	 * Executed trades whose execution timestamp falls in the current UTC
	 * calendar day (00:00:00.000 UTC inclusive to the next 00:00:00.000 UTC
	 * exclusive).
	 */
	executedCountTodayUtc: number;
}

const NS_PER_MS = 1_000_000n;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Start of `nowMs`'s UTC calendar day, in epoch milliseconds. */
const startOfUtcDayMs = (nowMs: number): number => {
	const now = new Date(nowMs);

	return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};

/**
 * Reads the user's Executed-trade counts directly from the clearing
 * canister.
 *
 * IMPORTANT — caller scoping. The only clearing query that returns
 * per-trade `Event`s for a user, `get_trade_history`, is *caller-scoped*
 * (it has no principal argument; it returns the events of whoever invokes
 * it). A cross-canister `call` from the satellite is sent with the
 * satellite's own principal, so today this query returns the satellite's
 * events, not `user`'s. The clearing canister exposes no principal-scoped
 * executed-trade query, so this helper cannot yet derive an arbitrary
 * user's authoritative counts on its own. To make this production-correct,
 * clearing must add a principal-argument query (e.g.
 * `get_trade_history_of : (principal) -> (vec Event) query`); this helper
 * is shaped to consume exactly that the moment it lands — only the call
 * arguments change, the Executed filter and UTC-day bucketing stay as-is.
 *
 * The returned events are filtered to `event.user === user` regardless, so
 * the counts are correct-by-construction for whatever set the query
 * returns and never over-count a different principal's trades. As a guard
 * against premature consumption, a *non-empty* response that contains no
 * events for `user` (the strong signal of caller-scoping — we received
 * someone else's history) throws rather than returning a silent
 * `{ 0, 0 }`, which a consumer could not tell apart from a real
 * zero-trade user and could mis-gate on.
 *
 * @param user The principal whose Executed counts to derive.
 * @param nowMs Current time in epoch milliseconds, used to bound "today
 *   (UTC)". Defaults to wall-clock now; injectable for deterministic tests.
 */
export const getExecutedCounts = async ({
	user,
	nowMs = Date.now()
}: {
	user: Principal;
	nowMs?: number;
}): Promise<ExecutedCounts> => {
	const { result: resultType } = candidMethod({
		canister: 'clearing',
		method: 'get_trade_history'
	});
	const events = await call<ClearingDid.Event[]>({
		canisterId: CLEARING_CANISTER_ID,
		method: 'get_trade_history',
		result: resultType
	});

	const userText = user.toText();

	const dayStartMs = startOfUtcDayMs(nowMs);
	const dayStartNs = BigInt(dayStartMs) * NS_PER_MS;
	const dayEndNs = BigInt(dayStartMs + MS_PER_DAY) * NS_PER_MS;

	// Single pass over the history: count this user's Executed trades
	// (lifetime + current UTC day) and note whether the response contained
	// any event for `user` at all. `event.user` is the on-chain owner of the
	// event, so this scoping is the spoof-proof check the profile field
	// cannot provide. `timestamp` is protocol nanoseconds; the day bounds are
	// compared in the ns domain so no precision is lost per event.
	let lifetimeExecutedCount = 0;
	let executedCountTodayUtc = 0;
	let userEventSeen = false;

	for (const event of events) {
		if (event.user.toText() === userText) {
			userEventSeen = true;

			if ('Executed' in event.event_type) {
				lifetimeExecutedCount += 1;

				if (event.timestamp >= dayStartNs && event.timestamp < dayEndNs) {
					executedCountTodayUtc += 1;
				}
			}
		}
	}

	// Caller-scoping guard (see the doc comment): `get_trade_history` returns
	// the *caller's* events, so a non-empty response with nothing for `user`
	// means we read a different principal's history. Fail loudly rather than
	// return a `{ 0, 0 }` that a consumer would read as a genuine zero-trade
	// user. Collapses to a no-op once a principal-scoped clearing query lands.
	if (events.length > 0 && !userEventSeen) {
		throw new Error(
			`getExecutedCounts: clearing returned ${events.length} event(s), none for ${userText} — ` +
				`get_trade_history is caller-scoped; a principal-scoped clearing query is required ` +
				`before this helper can derive another user's counts.`
		);
	}

	return { lifetimeExecutedCount, executedCountTodayUtc };
};
