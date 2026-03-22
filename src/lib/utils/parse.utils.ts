import { parseUnits, type BigNumberish } from 'ethers/utils';

/** Parses a decimal token string into a bigint using ethers `parseUnits`. */
export const parseToken = ({
	value,
	unitName
}: {
	value: string;
	unitName: BigNumberish;
}): bigint => parseUnits(value, unitName);
