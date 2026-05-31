<script lang="ts">
	import { Share } from 'lucide-svelte/icons';
	import SharePopover from '$lib/components/market/SharePopover.svelte';
	import SavedMarketToggle from '$lib/components/saved-markets/SavedMarketToggle.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { Market } from '$lib/types/market';
	import type { PriorCallSignal } from '$lib/types/market-signals';
	import type { FlowArtCategory } from '$lib/utils/flow-art.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: Market;
		category: FlowArtCategory;
		priorCall?: PriorCallSignal;
	}

	const { market, category, priorCall }: Props = $props();

	// Share popover toggle — anchored above the share button. The
	// popover handles native / clipboard / channel paths itself; this
	// component owns just the open/close state and the toast we show
	// on successful clipboard copy.
	let shareOpen = $state(false);

	const toggleShare = () => {
		shareOpen = !shareOpen;
	};

	const onCopied = () => {
		notificationsStore.add({
			title: t({ locale: $localeStore, key: 'market.detail.share.copied_title' }),
			message: t({ locale: $localeStore, key: 'market.detail.share.copied' }),
			type: 'success'
		});
	};
</script>

<header class="flow-back-head">
	<span class="allcaps flow-back-cat">{category}</span>
	<div class="flow-back-actions" data-no-card-gesture="true">
		<SavedMarketToggle marketId={market.id} size="sm" />
		<button
			class="flow-back-share"
			aria-label={t({ locale: $localeStore, key: 'market.detail.share.label' })}
			onclick={toggleShare}
			type="button"
		>
			<Share aria-hidden="true" size={16} strokeWidth={1.8} />
		</button>
		{#if shareOpen}
			<SharePopover
				{market}
				onClose={() => (shareOpen = false)}
				{onCopied}
				priorCall={priorCall ? { side: priorCall.side } : null}
			/>
		{/if}
	</div>
</header>

<style lang="postcss">
	.flow-back-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 1.1rem 1.1rem 0.7rem;
		border-bottom: 1px solid var(--border-base);
	}

	/* Category chip — a subtle neutral pill (parchment-wash background)
	   with category-colored ink, rather than a plain colored label. */
	.flow-back-cat {
		display: inline-flex;
		align-items: center;
		padding: 3px 7px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--text-base) 8%, transparent);
		font-size: var(--t-10);
		color: var(--cat-color);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
	}

	.flow-back-actions {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	/* Share-pop anchor button — mirrors `MarketDetailShareButton` but
	   stays inline here because the popover is anchored relative to
	   `.flow-back-actions`, so the button can't take its own offset
	   parent. */
	.flow-back-share {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}
	.flow-back-share:hover {
		border-color: var(--border-strong);
		background: var(--bg-popover);
		color: var(--text-base);
	}
</style>
