<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		hasBestWin: boolean;
		bestWinTitle: string;
		// Realized VXP of the highlighted win, in whole VXP. Rendered as
		// "+{vxp} VXP" in the sub-line.
		bestWinVxp: number;
		// `true` when the highlighted win was against the crowd — switches
		// the sub-line tag from "best call" to "contrarian win".
		bestWinContrarian: boolean;
	}

	let { hasBestWin, bestWinTitle, bestWinVxp, bestWinContrarian }: Props = $props();

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
				{t({
					locale: $localeStore,
					key: bestWinContrarian
						? 'dash.oracle.best_call_sub_contrarian'
						: 'dash.oracle.best_call_sub',
					params: { vxp: bestWinVxp }
				})}
			</span>
		{:else}
			<p class="q">{t({ locale: $localeStore, key: 'dash.oracle.empty' })}</p>
			<span class="sub">{t({ locale: $localeStore, key: 'dash.oracle.empty_sub' })}</span>
		{/if}
	</div>
</div>
