<script lang="ts">
	import CachedLoader from '$lib/components/loaders/CachedLoader.svelte';
	import { getLeaderboard } from '$lib/services/leaderboard.services';
	import { leaderboardStore } from '$lib/stores/leaderboard.store';

	const LEADERBOARD_LIMIT = 50;

	const onLoad = () => getLeaderboard(LEADERBOARD_LIMIT);
</script>

<CachedLoader {onLoad} requireIdentity={false} store={leaderboardStore} />
