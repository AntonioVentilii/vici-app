<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		sizeStake: number;
	}

	let { sizeStake }: Props = $props();
</script>

<div class="flow-foot num">
	<span class="flow-foot-size">
		{t({
			locale: $localeStore,
			key: 'card.size_vxp',
			params: { stake: sizeStake }
		})}
	</span>
	<span class="flow-foot-hint allcaps">
		{t({ locale: $localeStore, key: 'card.tap_depth' })}
	</span>
</div>

<style lang="postcss">
	.flow-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: auto 1.1rem 1.1rem;
		padding-top: 0.5rem;
		font-size: var(--t-12);
		color: var(--text-muted);
		letter-spacing: 0.06em;
	}
	.flow-foot-size {
		font-weight: 700;
		letter-spacing: 0.1em;
	}
	.flow-foot-hint {
		letter-spacing: 0.14em;
		font-size: 10.5px;
		opacity: 0.7;
	}
</style>
