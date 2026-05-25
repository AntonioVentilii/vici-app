<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import MarketForkModal from '$lib/components/market/MarketForkModal.svelte';
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import SavedMarketToggle from '$lib/components/saved-markets/SavedMarketToggle.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import PrincipalText from '$lib/components/ui/PrincipalText.svelte';
	import { MARKET_TAG_LABEL_KEYS } from '$lib/constants/market-tags.constants';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { formatDate } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { getTimeRemaining } from '$lib/utils/market.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();
	let isForkModalOpen = $state(false);

	const { title, status, outcome } = $derived(market);
	const isFork = $derived(market.forkedFrom !== undefined);
	const isResolved = $derived(status === 'Resolved');
	const timeRemaining = $derived(getTimeRemaining(market.expiryDate));
	const tags = $derived($marketTags[market.id] ?? []);
</script>

<section class="detail-hero">
	<div class="detail-hero-top">
		<div class="detail-chip-row">
			{#each tags as tag (tag)}
				<!-- V1.2 detail header tints the category chip with the
				     category's brand color so the page reads as
				     macro/crypto/politics/etc. at a glance. Mirrors the
				     per-card treatment landed in 7e0edc7; both surfaces
				     now share the same tagColor() source of truth. -->
				<span
					style:color={tagColor(tag)}
					style:background-color="color-mix(in srgb, {tagColor(tag)} 12%, transparent)"
					style:border-color="color-mix(in srgb, {tagColor(tag)} 28%, transparent)"
					class="detail-chip detail-chip-category"
				>
					{t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] })}
				</span>
			{/each}
			<span class="detail-chip detail-chip-status">
				<OutcomeBadge {status} />
			</span>
			{#if isResolved && nonNullish(outcome)}
				<span class="detail-chip detail-chip-status">
					<OutcomeBadge {outcome} />
				</span>
			{/if}
			{#if market.isInviteOnly}
				<Badge size="sm" variant="warning">
					{t({ locale: $localeStore, key: 'markets.filter.access.closed' })}
				</Badge>
			{/if}
		</div>

		<div class="detail-hero-actions">
			<!-- Heart save / unsave — reuses the shared SavedMarketToggle so
			     the per-card heart and the detail-page heart stay visually
			     and behaviourally identical. -->
			<SavedMarketToggle marketId={market.id} size="md" stopPropagation={false} />

			{#if !isFork}
				<Button onclick={() => (isForkModalOpen = true)} size="sm" variant="outline">
					{t({ locale: $localeStore, key: 'card.challenge_friends' })}
				</Button>
			{/if}
		</div>
	</div>

	<div class="detail-hero-copy">
		<h1>{title}</h1>

		{#if market.description}
			<p>{market.description}</p>
		{/if}
	</div>

	<div class="detail-meta-grid">
		<div class="detail-meta-cell">
			<span class="allcaps">{t({ locale: $localeStore, key: 'market.detail.header.settles' })}</span
			>
			<strong class="num">{formatDate(market.expiryDate)}</strong>
		</div>
		<div class="detail-meta-cell">
			<span class="allcaps"
				>{t({ locale: $localeStore, key: 'market.detail.header.time_left' })}</span
			>
			<strong class="num text-primary">{timeRemaining}</strong>
		</div>
		<div class="detail-meta-cell detail-meta-creator">
			<span class="allcaps">{t({ locale: $localeStore, key: 'market.detail.created_by' })}</span>
			<strong><PrincipalText principal={market.creator} splitLength={5} /></strong>
		</div>
	</div>
</section>

{#if !isFork}
	<MarketForkModal isOpen={isForkModalOpen} {market} onClose={() => (isForkModalOpen = false)} />
{/if}

<style lang="postcss">
	.detail-hero {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--border-base);
		border-radius: 1.75rem;
		background:
			radial-gradient(circle at 14% 0%, var(--laurel-glow), transparent 34%),
			linear-gradient(180deg, var(--bg-popover), var(--bg-surface));
		box-shadow: var(--shadow-card);
		padding: 1rem;
	}

	.detail-hero-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.detail-hero-top :global(.btn) {
		display: none;
	}

	.detail-hero-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.detail-chip-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	.detail-chip {
		display: inline-flex;
		align-items: center;
		border-radius: var(--r-pill);
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 84%, transparent);
	}

	.detail-chip-category {
		padding: 0.35rem 0.65rem;
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.detail-chip-status {
		padding: 0.25rem 0.45rem;
	}

	.detail-hero-copy {
		margin-top: 1rem;
		max-width: 52rem;
	}

	.detail-hero-copy h1 {
		margin: 0;
		color: var(--text-base);
		font-family: var(--font-display);
		font-size: clamp(1.45rem, 6.2vw, 2rem);
		font-weight: 700;
		letter-spacing: -0.025em;
		line-height: 1.12;
	}

	.detail-hero-copy p {
		margin: 0.85rem 0 0;
		max-width: 44rem;
		color: var(--text-muted);
		font-size: var(--t-14);
		line-height: var(--leading-normal);
	}

	.detail-meta-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.detail-meta-cell {
		min-width: 0;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 84%, transparent);
		padding: 0.75rem;
	}

	.detail-meta-cell strong {
		display: block;
		margin-top: 0.25rem;
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.detail-meta-creator {
		grid-column: 1 / -1;
	}

	@media (min-width: 768px) {
		.detail-hero {
			padding: 1.35rem;
		}

		.detail-hero-top :global(.btn) {
			display: inline-flex;
		}

		.detail-hero-copy h1 {
			font-size: clamp(2.5rem, 5vw, 4.4rem);
			letter-spacing: -0.055em;
			line-height: 0.98;
		}

		.detail-meta-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			max-width: 42rem;
		}

		.detail-meta-creator {
			grid-column: auto;
		}
	}
</style>
