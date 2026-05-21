<script lang="ts">
	import MarketsPage from '$lib/components/pages/MarketsPage.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
</script>

<svelte:head>
	<title>{t({ locale: $localeStore, key: 'seo.home.title' })}</title>
	<meta name="description" content={t({ locale: $localeStore, key: 'seo.home.description' })} />
</svelte:head>

<MarketsPage />
