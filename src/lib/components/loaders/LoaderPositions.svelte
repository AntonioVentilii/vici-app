<script lang="ts">
	import DomainCachedLoader from '$lib/components/loaders/DomainCachedLoader.svelte';
	import { VICI_EVENTS } from '$lib/constants/events.constants';
	import { loadPositions } from '$lib/services/position.services';
	import { positionsStore } from '$lib/stores/positions.store';
</script>

<DomainCachedLoader
	onLoad={loadPositions}
	refreshEvent={VICI_EVENTS.REFRESH_POSITIONS}
	store={positionsStore}
/>
