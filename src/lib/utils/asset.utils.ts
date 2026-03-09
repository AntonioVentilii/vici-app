import type { RegistryDid } from '$declarations';
import { CKUSDC_TOKEN, ICP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import type { Token } from '$lib/types/token';
import { assertNever } from '@dfinity/utils';

export const assetToToken = (payoutUnit: RegistryDid.PayoutUnit): Token | undefined => {
	if ('Crypto' in payoutUnit) {
		const crypto = payoutUnit.Crypto;

		if ('Icp' in crypto) {
			return ICP_TOKEN;
		}

		if ('Usdc' in crypto) {
			return CKUSDC_TOKEN;
		}

		throw new Error(`Unsupported crypto payout unit: ${crypto}`);
	}

	if ('Fiat' in payoutUnit) {
		const fiat = payoutUnit.Fiat;

		throw new Error(`Unsupported fiat payout unit: ${fiat}`);
	}

	if ('NonMonetary' in payoutUnit) {
		const nonMonetary = payoutUnit.NonMonetary;

		throw new Error(`Unsupported non-monetary payout unit: ${nonMonetary}`);
	}

	assertNever(payoutUnit, `Unknown payoutUnit type: ${payoutUnit}`);
};
