import type { ClearingDid } from '$declarations';
import { NANO_SECONDS_IN_MILLISECOND } from '$lib/constants/app.constants';
import { isNullish } from '@dfinity/utils';
import Decimal from 'decimal.js';
import { type BigNumberish, formatUnits } from 'ethers/utils';

/** Number, token, currency, date, volume, and probability formatting for UI display. */

interface FormatTokenParams {
	value: bigint;
	unitName: string | BigNumberish;
	displayDecimals?: number;
	trailingZeros?: boolean;
	showPlusSign?: boolean;
}

const DEFAULT_DISPLAY_DECIMALS = 4;
const MAX_DEFAULT_DISPLAY_DECIMALS = 8;

/** Formats a token amount (wei-style bigint + decimals) for display, with optional trailing zeros and plus sign. */
export const formatToken = ({
	value,
	unitName,
	displayDecimals,
	trailingZeros = false,
	showPlusSign = false
}: FormatTokenParams): string => {
	const parsedUnitName: BigNumberish =
		typeof unitName === 'number' || typeof unitName === 'bigint'
			? unitName
			: /^\d+$/.test(unitName)
				? BigInt(unitName)
				: unitName;

	const res = formatUnits(value, parsedUnitName);

	const match = res.match(/^0\.0*/);
	const leadingZeros = match ? match[0].length - 2 : 0;

	if (isNullish(displayDecimals) && leadingZeros >= MAX_DEFAULT_DISPLAY_DECIMALS) {
		return '< 0.00000001';
	}

	const maxFractionDigits = Math.min(leadingZeros + 2, MAX_DEFAULT_DISPLAY_DECIMALS);
	const minFractionDigits = displayDecimals ?? DEFAULT_DISPLAY_DECIMALS;

	const dec = new Decimal(res);
	const maxDigits =
		displayDecimals ?? (leadingZeros > 2 ? maxFractionDigits : DEFAULT_DISPLAY_DECIMALS);
	const decDP = dec.toDecimalPlaces(maxDigits);
	const minDigits = trailingZeros ? Math.max(minFractionDigits, maxDigits) : undefined;

	const formatted = decDP.toFixed(minDigits) as `${number}`;

	const prefix = showPlusSign && +res > 0 ? '+' : '';

	if (trailingZeros) {
		return `${prefix}${formatted}`;
	}

	// Remove trailing zeros if not explicitly requested
	const finalFormatted = formatted.replace(/\.?0+$/, '');

	return `${prefix}${finalFormatted || '0'}`;
};

/** Formats a whole-number quantity with two decimal places (via {@link formatToken}). */
export const formatQuantity = ({
	value,
	decimals = 0
}: {
	value: bigint;
	decimals?: number;
}): string => formatToken({ value, unitName: decimals, displayDecimals: 2 });

/** Formats a bigint amount as fiat-style currency (default USD with `$` prefix). */
export const formatCurrency = ({
	value,
	decimals = 6,
	symbol = 'USD'
}: {
	value: bigint;
	decimals?: number;
	symbol?: string;
}): string => {
	const formatted = formatToken({ value, unitName: decimals, displayDecimals: 2 });

	if (symbol === 'USD') {
		return `$${formatted}`;
	}

	return `${formatted} ${symbol}`;
};

const DATE_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
};

/** Converts IC timestamp nanoseconds to a short locale date/time string. */
export const formatNanosecondsToDate = ({ nanoseconds }: { nanoseconds: bigint }): string => {
	const date = new Date(Number(nanoseconds / NANO_SECONDS_IN_MILLISECOND));
	return date.toLocaleDateString('en', DATE_TIME_FORMAT_OPTIONS);
};

/** Formats a clearing price as a whole-number percentage string. */
export const formatPrice = (price: ClearingDid.Price): string =>
	`${Math.round((Number(price.decimal.value) / 10 ** price.decimal.decimals) * 100)}%`;

/** Formats a probability in `[0, 1]` as a whole-number percentage string. */
export const formatProbability = (prob: number): string => `${Math.round(prob * 100)}%`;

/** Formats a Unix ms timestamp (bigint or number) as a locale date string. */
export const formatDate = (date: bigint | number): string =>
	new Date(Number(date)).toLocaleDateString();

/** Formats traded volume with token decimals and symbol suffix. */
export const formatVolume = ({
	volume,
	decimals,
	symbol
}: {
	volume: bigint;
	decimals: number;
	symbol: string;
}): string => `${formatToken({ value: volume, unitName: decimals })} ${symbol}`;

/** Formats available balance as USD (accepts bigint, number, or numeric string). */
export const formatAvailableUsd = ({
	value,
	decimals = 6
}: {
	value: string | number | bigint;
	decimals?: number;
}) => {
	const val = typeof value === 'bigint' ? value : BigInt(Math.floor(Number(value)));
	return formatCurrency({ value: val, decimals });
};
