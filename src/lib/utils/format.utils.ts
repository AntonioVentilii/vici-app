import type { ClearingDid } from '$declarations';
import { MILLISECOND_IN_NANOSECONDS, USD_DECIMALS } from '$lib/constants/app.constants';
import { isNullish } from '@dfinity/utils';
import Decimal from 'decimal.js';
import { type BigNumberish, formatUnits } from 'ethers/utils';

interface FormatTokenParams {
	value: bigint;
	unitName: string | BigNumberish;
	displayDecimals?: number;
	trailingZeros?: boolean;
	showPlusSign?: boolean;
	useGrouping?: boolean;
}

const DEFAULT_DISPLAY_DECIMALS = 4;
const MAX_DEFAULT_DISPLAY_DECIMALS = 8;

/**
 * Adds locale-aware thousands separators to the integer part of a string
 * already in `[-]?\d+(\.\d+)?` form (the output of `Decimal.toFixed`). The
 * fractional part — including its precision — is preserved verbatim so we
 * don't reintroduce rounding on numbers that have already been quantised.
 */
export const groupIntegerPart = ({
	formatted,
	locale
}: {
	formatted: string;
	locale?: string;
}): string => {
	const negative = formatted.startsWith('-');
	const body = negative ? formatted.slice(1) : formatted;
	const [intPart, fracPart] = body.split('.');
	const groupedInt = new Intl.NumberFormat(locale, { useGrouping: true }).format(BigInt(intPart));
	const grouped = fracPart === undefined ? groupedInt : `${groupedInt}.${fracPart}`;

	return negative ? `-${grouped}` : grouped;
};

export const formatToken = ({
	value,
	unitName,
	displayDecimals,
	trailingZeros = false,
	showPlusSign = false,
	useGrouping = true
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

	const fixed = decDP.toFixed(minDigits) as `${number}`;
	const formatted = useGrouping ? groupIntegerPart({ formatted: fixed }) : fixed;

	if (trailingZeros) {
		return formatted;
	}

	return `${showPlusSign && +res > 0 ? '+' : ''}${formatted}`;
};

export const formatQuantity = ({
	value,
	decimals = 0
}: {
	value: bigint;
	decimals?: number;
}): string => formatToken({ value, unitName: decimals, displayDecimals: 2 });

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

export const formatNanosecondsToDate = ({ nanoseconds }: { nanoseconds: bigint }): string => {
	const date = new Date(Number(nanoseconds / MILLISECOND_IN_NANOSECONDS));

	return date.toLocaleDateString('en', DATE_TIME_FORMAT_OPTIONS);
};

export const decimalFixedValueToNumber = ({
	value,
	decimals
}: {
	value: bigint;
	decimals: number;
}): number => Number(formatUnits(value, decimals));

export const formatPrice = (price: ClearingDid.Price): string =>
	`${Math.round(
		decimalFixedValueToNumber({
			value: price.decimal.value,
			decimals: price.decimal.decimals
		}) * 100
	)}%`;

export const formatProbability = (prob: number): string => `${Math.round(prob * 100)}%`;

export const formatDate = (date: bigint | number): string =>
	new Date(Number(date)).toLocaleDateString();

export const formatVolume = ({
	volume,
	decimals,
	symbol
}: {
	volume: bigint;
	decimals: number;
	symbol: string;
}): string => `${formatToken({ value: volume, unitName: decimals })} ${symbol}`;

export const formatAvailableUsd = ({
	value,
	decimals = USD_DECIMALS
}: {
	value: string | number | bigint;
	decimals?: number;
}) => {
	const val = typeof value === 'bigint' ? value : BigInt(Math.floor(Number(value)));

	return formatCurrency({ value: val, decimals });
};

export const shortenWithMiddleEllipsis = ({
	text,
	splitLength = 7
}: {
	text: string;
	splitLength?: number;
}): string => {
	const minLength = splitLength * 2 + 2;

	return text.length > minLength
		? `${text.slice(0, splitLength)}...${text.slice(-1 * splitLength)}`
		: text;
};

// =============================================================
//  Locale-aware Intl wrappers
// =============================================================
//
// Locale-aware integer formatter — what landing / onboarding need most
// (`new Intl.NumberFormat(locale).format(...)`). Locale is typed as
// `string` rather than `AppLocale` so callers in surfaces that don't
// import `AppLocale` (e.g. transient demo surfaces) can pass any
// BCP-47 string the runtime accepts.

export const formatLocaleNumber = ({ value, locale }: { value: number; locale: string }): string =>
	new Intl.NumberFormat(locale).format(value);

/**
 * Compact-notation number ("1.2K", "5M"). Used wherever a constrained
 * pill / chip shows XP or follower counts.
 */
export const formatLocaleCompactNumber = ({
	value,
	locale
}: {
	value: number;
	locale: string;
}): string =>
	new Intl.NumberFormat(locale, {
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(value);

/**
 * Locale-aware percent formatter. Input is a 0–1 ratio, not 0–100, to
 * match `Intl.NumberFormat`'s `style: 'percent'` contract.
 */
export const formatLocalePercent = ({
	value,
	locale,
	maximumFractionDigits = 1
}: {
	value: number;
	locale: string;
	maximumFractionDigits?: number;
}): string =>
	new Intl.NumberFormat(locale, {
		style: 'percent',
		maximumFractionDigits
	}).format(value);
