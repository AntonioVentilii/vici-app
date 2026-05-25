import { functions } from '$declarations/satellite/satellite.api';
import type { SocialFeedEntryDoc } from '$lib/types/social-feed';

/**
 * Thin wrapper around the satellite's `listSocialFeed` defineQuery.
 * Projects the snake_case wire shape (ref_id / created_at_ms) to the
 * camelCase domain type so FE pages don't have to.
 *
 * Hooks (BE-12) populate the feed asynchronously after writes to
 * `league_members` / `bouts` / `affiliations`; the page renders an
 * empty state until the first entries land.
 */
export const listSocialFeed = async ({ limit }: { limit?: number } = {}): Promise<
	SocialFeedEntryDoc[]
> => {
	const { items } = await functions.listSocialFeed({ limit });

	return items.map((entry) => ({
		actor: entry.actor,
		kind: entry.kind,
		refId: entry.ref_id,
		context: entry.context,
		createdAtMs: entry.created_at_ms
	}));
};
