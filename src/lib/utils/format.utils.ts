import type { ClearingDid } from '$declarations';
import { NANO_SECONDS_IN_MILLISECOND } from '$lib/constants/app.constants';
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

export const formatPrice = (price: ClearingDid.Price): string =>
	`${Math.round((Number(price.decimal.value) / 10 ** price.decimal.decimals) * 100)}%`;

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

// TODO: How did we arrive at this decimals??? It refers to USD_DECIMALS of Clearing canister, but should we be using token decimals instead?
export const formatAvilableUsd = (value: string | number | bigint) =>
	(Number(value) / 10 ** 6).toFixed(2);
