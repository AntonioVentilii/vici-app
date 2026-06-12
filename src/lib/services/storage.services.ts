import {
	LEAGUE_IMAGE_JPEG_QUALITY,
	LEAGUE_IMAGE_SIZE_PX,
	LEAGUE_IMAGES_COLLECTION
} from '$lib/types/league';
import { downscaleImageToSquareJpeg } from '$lib/utils/image.utils';
import { isNullish } from '@dfinity/utils';
import { deleteAsset, uploadFile } from '@junobuild/core';

/**
 * Juno Storage helpers. Uploads land binary assets in a Storage
 * collection and persist only the resolved download URL on the owning
 * Datastore doc — we never inline base64 data URLs into a record.
 */

/**
 * Downscale a user-picked image to a 256² cover JPEG and upload it to
 * the league-images Storage collection. Returns the public download URL
 * to persist on the league doc's `imageUrl`.
 *
 * The asset is keyed under `/<collection>/<leagueId>-<timestamp>.jpg`
 * so a re-upload for the same league never collides with the prior
 * asset (the caller clears the old one separately via
 * {@link deleteLeagueImageByUrl}).
 *
 * Throws when the picked file can't be decoded/painted (the caller
 * surfaces a friendly error) so a half-uploaded state never reaches the
 * doc.
 */
export const uploadLeagueImage = async ({
	leagueId,
	file
}: {
	leagueId: string;
	file: File;
}): Promise<string> => {
	const downscaled = await downscaleImageToSquareJpeg({
		file,
		size: LEAGUE_IMAGE_SIZE_PX,
		quality: LEAGUE_IMAGE_JPEG_QUALITY
	});

	if (isNullish(downscaled)) {
		throw new Error('Could not process the selected image.');
	}

	const { downloadUrl } = await uploadFile({
		collection: LEAGUE_IMAGES_COLLECTION,
		data: new File([downscaled], `${leagueId}-${Date.now()}.jpg`, { type: 'image/jpeg' })
	});

	return downloadUrl;
};

/**
 * Delete a previously-uploaded league image given its download URL.
 * Best-effort: a missing or already-deleted asset is swallowed so
 * clearing the doc's `imageUrl` never fails on a stale URL. Only acts
 * on URLs that point at the league-images collection — external or
 * malformed URLs (e.g. a legacy value) are left untouched.
 */
export const deleteLeagueImageByUrl = async (url: string): Promise<void> => {
	const prefix = `/${LEAGUE_IMAGES_COLLECTION}/`;

	let fullPath: string;

	try {
		({ pathname: fullPath } = new URL(url));
	} catch {
		return;
	}

	if (!fullPath.startsWith(prefix)) {
		return;
	}

	try {
		await deleteAsset({
			collection: LEAGUE_IMAGES_COLLECTION,
			fullPath
		});
	} catch (err) {
		// The doc-side clear is the source of truth; a dangling asset is
		// a cosmetic leak, not a failure the user should see.
		console.warn('storage.services: deleteLeagueImageByUrl failed', err);
	}
};
