import { parseUnits, type BigNumberish } from 'ethers/utils';

export const parseToken = ({
	value,
	unitName
}: {
	value: string;
	unitName: BigNumberish;
}): bigint => parseUnits(value, unitName);
