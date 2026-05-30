<script lang="ts">
	import CachedLoader from '$lib/components/loaders/CachedLoader.svelte';
	import { VICI_EVENTS } from '$lib/constants/events.constants';
	import { listMarketMetadataBySeries } from '$lib/services/market-tags.services';
	import { marketMetadataStore } from '$lib/stores/market-metadata.store';

	const onLoad = () => listMarketMetadataBySeries().catch(() => ({}));
</script>

<CachedLoader
	{onLoad}
	refreshEvent={VICI_EVENTS.REFRESH_MARKET_METADATA}
	requireIdentity={false}
	store={marketMetadataStore}
/>
