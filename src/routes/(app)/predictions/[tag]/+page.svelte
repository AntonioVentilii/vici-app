<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import MarketsListRow from '$lib/components/market/MarketsListRow.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { MARKET_TAG_LABEL_KEYS, tagFromTopicSlug } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { marketTags, marketTagsNotInitialized } from '$lib/derived/market-tags.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	// `/predictions/<slug>` — the slug expands to a tag id (`world-cup` → `wc`).
	const slug = $derived(page.params.tag ?? '');
	const tag = $derived(tagFromTopicSlug(slug));
	const category = $derived(
		nonNullish(tag) ? t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] }) : ''
	);

	const tagsByMarket = $derived($marketTags);
	const taggedMarkets = $derived(
		nonNullish(tag) ? $markets.filter((m) => tagsByMarket[m.id]?.includes(tag) ?? false) : []
	);
	const marketCount = $derived(taggedMarkets.length);

	const loading = $derived($marketsNotInitialized || $marketTagsNotInitialized);

	// Unknown slug → the canonical board. SEO topic pages only exist for real
	// tags, so an invalid `[tag]` is a mistyped/stale link, not a landing page.
	$effect(() => {
		if (!loading && isNullish(tag)) {
			void goto(resolve(AppPath.App), { replaceState: true });
		}
	});
</script>

<svelte:head>
	<title>{t({ locale: $localeStore, key: 'seo.topic.title', params: { category } })}</title>
	<meta
		name="description"
		content={t({
			locale: $localeStore,
			key: 'seo.topic.description',
			params: { category, count: `${marketCount}` }
		})}
	/>
	<link href={`https://vici.market/predictions/${slug}`} rel="canonical" />
</svelte:head>

{#if loading}
	<div class="flex h-full items-center justify-center py-16">
		<LoadingSpinner />
	</div>
{:else if nonNullish(tag)}
	<section class="mx-auto w-full max-w-2xl px-4 py-8">
		<header class="mb-6">
			<h1 class="text-2xl font-bold tracking-tight">
				{t({ locale: $localeStore, key: 'predictions.topic.h1', params: { category } })}
			</h1>
			<p class="text-muted mt-2 text-sm">
				{t({
					locale: $localeStore,
					key: 'predictions.topic.intro',
					params: { category, count: `${marketCount}` }
				})}
			</p>
		</header>

		{#if marketCount === 0}
			<p class="text-muted py-8 text-center text-sm">
				{t({ locale: $localeStore, key: 'predictions.topic.empty', params: { category } })}
			</p>
		{:else}
			<ul class="flex flex-col">
				{#each taggedMarkets as market (market.id)}
					<li>
						<MarketsListRow {market} {tag} />
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
