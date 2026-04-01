import type { ClearingDid } from '$declarations';
import { NANO_SECONDS_IN_MILLISECOND, USD_DECIMALS } from '$lib/constants/app.constants';
import { isNullish } from '@dfinity/utils';
import Decimal from 'decimal.js';
import { type BigNumberish, formatUnits } from 'ethers/utils';

interface FormatTokenParams {
	value: bigint;
	unitName: string | BigNumberish;
	displayDecimals?: number;
	trailingZeros?: boolean;
	showPlusSign?: boolean;
}

const DEFAULT_DISPLAY_DECIMALS = 4;
const MAX_DEFAULT_DISPLAY_DECIMALS = 8;

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
	const date = new Date(Number(nanoseconds / NANO_SECONDS_IN_MILLISECOND));

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
	// Original min length was 16 to extract split 7
	const minLength = splitLength * 2 + 2;

	return text.length > minLength
		? `${text.slice(0, splitLength)}...${text.slice(-1 * splitLength)}`
		: text;
};
