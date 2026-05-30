<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		hasBestWin: boolean;
		bestWinTitle: string;
	}

	let { hasBestWin, bestWinTitle }: Props = $props();

	const stripWillPrefix = (title: string): string =>
		title.replace(/^Will\s+/i, '').replace(/\?\s*$/, '');
</script>

<div class="dash-section">
	<div class="dash-oracle">
		<span class="lbl">{t({ locale: $localeStore, key: 'dash.oracle.eyebrow' })}</span>
		{#if hasBestWin}
			<p class="q">
				{t({
					locale: $localeStore,
					key: 'dash.oracle.best_call',
					params: { title: stripWillPrefix(bestWinTitle) }
				})}
			</p>
			<span class="sub">
				{t({ locale: $localeStore, key: 'dash.oracle.best_call_sub' })}
			</span>
		{:else}
			<p class="q">{t({ locale: $localeStore, key: 'dash.oracle.empty' })}</p>
			<span class="sub">{t({ locale: $localeStore, key: 'dash.oracle.empty_sub' })}</span>
		{/if}
	</div>
</div>
