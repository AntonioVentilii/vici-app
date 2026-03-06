import type { ClearingDid } from '$declarations';
import { CKUSDC_TOKEN, ICP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import type { Token } from '$lib/types/token';
import { assertNever } from '@dfinity/utils';

export const assetToToken = (asset: ClearingDid.SettlementAsset): Token | undefined => {
	if ('Icp' in asset) {
		return ICP_TOKEN;
	}

	if ('CkUsdc' in asset) {
		return CKUSDC_TOKEN;
	}

	assertNever(asset, `Unknown asset type: ${asset}`);
};
