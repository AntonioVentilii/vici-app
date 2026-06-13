import type { ClearingDid } from '$declarations';
import type { MessageKey } from '$lib/utils/i18n.utils';
import { assertNever } from '@dfinity/utils';

/**
 * The discriminant of a Candid variant — its single top-level key (e.g.
 * `'InsufficientMargin'`). Safe to surface in logs/`Error.message`: it
 * names the failure without the variant's payload (principals, base-unit
 * bigints), which stays solely on `TradeExecutionError.tradeError`.
 */
const variantName = (variant: object): string => Object.keys(variant)[0] ?? 'Unknown';

/**
 * A clearing trade call (`submit_market_order` / `submit_limit_order` /
 * `cancel_limit_order`) rejected by the engine. Carries the structured
 * Candid `TradeError` variant so the UI can render a localized,
 * human-readable reason instead of the raw `JSON.stringify`d `Err` (which
 * leaked principals and base-unit bigints into the "Prediction failed"
 * toast). `Error.message` holds only the variant name — never the payload.
 */
export class TradeExecutionError extends Error {
	readonly tradeError: ClearingDid.TradeError;

	constructor(tradeError: ClearingDid.TradeError) {
		super(`Trade rejected: ${variantName(tradeError)}`);
		this.name = 'TradeExecutionError';
		this.tradeError = tradeError;
	}
}

/**
 * An i18n message descriptor — a `MessageKey` plus its interpolation params —
 * resolved by the caller through `t({ locale, key, params })`.
 */
export interface TradeErrorMessage {
	key: MessageKey;
	params?: Record<string, string | number>;
}

const mapCommonError = (err: ClearingDid.CommonError): TradeErrorMessage => {
	if ('Internal' in err) {
		return { key: 'trade.error.common.internal' };
	}

	if ('InvalidInput' in err) {
		return { key: 'trade.error.common.invalid_input' };
	}

	if ('MathOverflow' in err) {
		return { key: 'trade.error.common.math_overflow' };
	}

	if ('Unauthorized' in err) {
		return { key: 'trade.error.common.unauthorized' };
	}

	if ('RegistryNotSet' in err) {
		return { key: 'trade.error.common.registry_not_set' };
	}

	assertNever(err, `Unhandled CommonError variant: ${variantName(err)}`);
};

/**
 * Maps a clearing `TradeError` to a user-facing i18n message descriptor. The
 * `assertNever` tail makes this exhaustive: if the generated bindings gain a
 * new variant, this stops compiling until it is handled here.
 */
export const mapTradeError = (err: ClearingDid.TradeError): TradeErrorMessage => {
	if ('SelfTradingNotAllowed' in err) {
		return { key: 'trade.error.self_trading_not_allowed' };
	}

	if ('OrderNotFound' in err) {
		return { key: 'trade.error.order_not_found' };
	}

	if ('ArbitrageLimitExceeded' in err) {
		return { key: 'trade.error.arbitrage_limit_exceeded' };
	}

	if ('RegistryError' in err) {
		return { key: 'trade.error.registry_error' };
	}

	if ('InsufficientMargin' in err) {
		return { key: 'trade.error.insufficient_margin' };
	}

	if ('NotOrderCreator' in err) {
		return { key: 'trade.error.not_order_creator' };
	}

	if ('SeriesNotFound' in err) {
		return { key: 'trade.error.series_not_found' };
	}

	if ('SeriesAlreadySettled' in err) {
		return { key: 'trade.error.series_already_settled' };
	}

	if ('NotAuthorizedToTrade' in err) {
		return { key: 'trade.error.not_authorized_to_trade' };
	}

	if ('Common' in err) {
		return mapCommonError(err.Common);
	}

	assertNever(err, `Unhandled TradeError variant: ${variantName(err)}`);
};

/**
 * Resolves any caught trade error to a message descriptor. Non-trade errors
 * (and — defensively — a variant the bindings don't yet know about) fall
 * through to a generic key so the toast never surfaces a raw payload.
 */
export const tradeErrorMessage = (error: unknown): TradeErrorMessage => {
	if (!(error instanceof TradeExecutionError)) {
		return { key: 'trade.error.generic' };
	}

	try {
		return mapTradeError(error.tradeError);
	} catch {
		if (import.meta.env.DEV) {
			// Variant name only — never the payload (principals, base-unit bigints).
			console.warn('Unmapped trade error variant:', variantName(error.tradeError));
		}

		return { key: 'trade.error.generic' };
	}
};
