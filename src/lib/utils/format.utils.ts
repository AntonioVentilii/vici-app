import { NANO_SECONDS_IN_MILLISECOND } from '$lib/constants/app.constants';
import { isNullish } from '@dfinity/utils';
import Decimal from 'decimal.js';
import { formatUnits, type BigNumberish } from 'ethers/utils';

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
