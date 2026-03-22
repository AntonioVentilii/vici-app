import type { ClearingDid } from '$declarations';
import {
	CKUSDC_LEDGER_CANISTER_ID,
	ICP_LEDGER_CANISTER_ID,
	VICI_LEDGER_CANISTER_ID,
	VXP_LEDGER_CANISTER_ID
} from '$lib/constants/canisters.constants';
import type { Token } from '$lib/types/token';
import { isSettlement, isViciXp } from '$lib/utils/balance-domain.utils';
import { nonNullish } from '@dfinity/utils';

/** Product rule: settlement wallet / clearing UI uses these ICRC ledgers only. */
const SETTLEMENT_LEDGER_ORDER = [ICP_LEDGER_CANISTER_ID, CKUSDC_LEDGER_CANISTER_ID] as const;

/** Product rule: ViciXp (app playground) uses VXP only. */
const VICIXP_LEDGER_ID = VXP_LEDGER_CANISTER_ID;

/** VICI is defined in the app but not surfaced in wallet UI yet. */
const isViciToken = (t: Token): boolean => t.ledgerCanisterId === VICI_LEDGER_CANISTER_ID;

/**
 * After clearing-config filtering, keep only tokens allowed for the active balance domain:
 * - **Settlement:** ICP, ckUSDC (fixed order).
 * - **ViciXp:** VXP only.
 * - **VICI:** never (until wired).
 */
export const filterTokensForBalanceDomain = ({
	tokens,
	balanceDomain
}: {
	tokens: Token[];
	balanceDomain: ClearingDid.BalanceDomain;
}): Token[] => {
	const withoutVici = tokens.filter((t) => !isViciToken(t));

	if (isViciXp(balanceDomain)) {
		return withoutVici.filter((t) => t.ledgerCanisterId === VICIXP_LEDGER_ID);
	}

	if (isSettlement(balanceDomain)) {
		const byLedger = new Map(withoutVici.map((t) => [t.ledgerCanisterId, t]));
		return SETTLEMENT_LEDGER_ORDER.map((id) => byLedger.get(id)).filter(nonNullish);
	}

	return [];
};
