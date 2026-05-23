<script lang="ts">
	import CachedLoader from '$lib/components/loaders/CachedLoader.svelte';
	import { listSeriesCategories } from '$lib/services/category.services';
	import { categoriesStore } from '$lib/stores/categories.store';

	const onLoad = () => listSeriesCategories().catch(() => []);
</script>

<CachedLoader {onLoad} requireIdentity={false} store={categoriesStore} />
