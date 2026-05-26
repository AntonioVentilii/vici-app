<script lang="ts">
	import { page } from '$app/state';
	import InfoPage from '$lib/components/pages/InfoPage.svelte';
	import { INFO_DOCS } from '$lib/constants/info-docs.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	const doc = $derived(INFO_DOCS[page.params.slug ?? '']);
</script>

{#if doc}
	<InfoPage {doc} />
{:else}
	<div class="mx-auto flex max-w-[var(--reading-max,64ch)] flex-col gap-3 py-10">
		<h1 class="display text-3xl">{t({ locale: $localeStore, key: 'info.not_found.title' })}</h1>
		<p class="text-foreground/85">
			{t({ locale: $localeStore, key: 'info.not_found.body' })}
		</p>
	</div>
{/if}
