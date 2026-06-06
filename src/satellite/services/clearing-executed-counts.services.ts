import type { ClearingDid } from '$declarations';
import { CLEARING_CANISTER_ID } from '$lib/constants/canisters.constants';
import { IDL } from '@icp-sdk/core/candid';
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

/**
 * IDL for the clearing `Price` record. Mirrors the generated
 * `ClearingDid.Price` shape; only the fields needed to decode an `Event`
 * are declared. Kept local (like the other clearing IDLs in the satellite)
 * so the hand-written decode stays self-contained.
 */
const PriceIdl = IDL.Record({
	timestamp: IDL.Opt(IDL.Nat64),
	oracle_id: IDL.Opt(IDL.Text),
	decimal: IDL.Record({ decimals: IDL.Nat8, value: IDL.Nat })
});

/** IDL for the clearing `EventType` variant. */
const EventTypeIdl = IDL.Variant({
	OrderPlaced: IDL.Null,
	Executed: IDL.Null,
	Liquidated: IDL.Null,
	Settled: IDL.Null
});

/**
 * IDL for the clearing `Event` record, matching the generated
 * `ClearingDid.Event`. `timestamp` is protocol nanoseconds since the UNIX
 * epoch (`Nat64`).
 */
const EventIdl = IDL.Record({
	qty: IDL.Int,
	series_id: IDL.Text,
	user: IDL.Principal,
	timestamp: IDL.Nat64,
	event_id: IDL.Nat64,
	price: PriceIdl,
	event_type: EventTypeIdl,
	clearing_id: IDL.Principal
});

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
 * returns and never over-count a different principal's trades.
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
	const events = await call<ClearingDid.Event[]>({
		canisterId: CLEARING_CANISTER_ID,
		method: 'get_trade_history',
		result: IDL.Vec(EventIdl)
	});

	const userText = user.toText();

	// Executed events for this user only. `event.user` is the on-chain owner
	// of the event, so this filter is the spoof-proof scoping the profile
	// field cannot provide.
	const executed = events.filter(
		(event) => 'Executed' in event.event_type && event.user.toText() === userText
	);

	const lifetimeExecutedCount = executed.length;

	const dayStartMs = startOfUtcDayMs(nowMs);
	const dayStartNs = BigInt(dayStartMs) * NS_PER_MS;
	const dayEndNs = BigInt(dayStartMs + MS_PER_DAY) * NS_PER_MS;

	// `timestamp` is protocol nanoseconds; bucket by the current UTC day in
	// the ns domain so no precision is lost converting per-event.
	const executedCountTodayUtc = executed.filter(
		(event) => event.timestamp >= dayStartNs && event.timestamp < dayEndNs
	).length;

	return { lifetimeExecutedCount, executedCountTodayUtc };
};
