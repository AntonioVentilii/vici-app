<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { get } from 'svelte/store';
	import CachedLoader from '$lib/components/loaders/CachedLoader.svelte';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getReceivedActivityReactions } from '$lib/services/activity-reaction.services';
	import { loadProfilesByPrincipals } from '$lib/services/profile.services';
	import { receivedReactionsStore } from '$lib/stores/activity-reactions.store';
	import type { ActivityReaction } from '$lib/types/social';

	// Likes other users left on the viewer's own calls, for the like-received
	// inbox card. Identity-scoped (the key-prefix read needs the viewer's
	// principal); hydrates liker profiles as a side-effect so the card renders
	// `@{name}` without its own fetch loop.
	const onLoad = async (): Promise<ActivityReaction[]> => {
		const author = get(authPrincipal);

		if (isNullish(author)) {
			return [];
		}

		const reactions = await getReceivedActivityReactions({ author });

		await loadProfilesByPrincipals({ principals: reactions.map(({ liker }) => liker) });

		return reactions;
	};
</script>

<CachedLoader {onLoad} store={receivedReactionsStore} />
