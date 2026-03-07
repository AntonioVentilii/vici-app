import type { ClearingDid } from '$declarations';
import { getPosition as getPositionApi } from '$lib/api/clearing.api';
import { safeGetIdentityOnce } from '$lib/services/identity.services';

export const getPosition = async (seriesId: string): Promise<ClearingDid.Position | undefined> => {
	const identity = await safeGetIdentityOnce();

	return await getPositionApi({
		identity,
		params: { series_id: seriesId }
	});
};
