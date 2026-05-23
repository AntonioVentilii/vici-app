<script lang="ts">
	import CachedLoader from '$lib/components/loaders/CachedLoader.svelte';
	import { getFollowing } from '$lib/services/relation.services';
	import { followingStore } from '$lib/stores/following.store';

	const onLoad = () => getFollowing().catch(() => []);
</script>

<CachedLoader {onLoad} store={followingStore} />
