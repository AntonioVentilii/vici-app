<script lang="ts">
	import { ChevronRight } from 'lucide-svelte/icons';
	import LandingSectionHeader from '$lib/components/landing/LandingSectionHeader.svelte';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { WELCOME_MARKET_PREVIEWS } from '$lib/constants/welcome-markets.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { categoryColor } from '$lib/utils/category-color.utils';
	import { t } from '$lib/utils/i18n.utils';

	const previewCallers = ({ id }: { id: string }): string => {
		const seed = id.charCodeAt(0);

		return (1200 + ((seed * 173) % 8500)).toLocaleString();
	};

	const isTrendingUp = ({ yesPercent, index }: { yesPercent: number; index: number }): boolean =>
		(yesPercent + index * 3) % 7 < 3;
</script>

<div class="welcome-section-inner">
	<LandingSectionHeader
		eyebrow={t({ locale: $localeStore, key: 'markets.eyebrow' })}
		sub={t({ locale: $localeStore, key: 'markets.sub' })}
		title={t({ locale: $localeStore, key: 'markets.title_a' })}
		titleAccent={t({ locale: $localeStore, key: 'markets.title_b' })}
	/>

	<div class="welcome-market-grid">
		{#each WELCOME_MARKET_PREVIEWS as market, index (market.id)}
			{@const catColor = categoryColor(market.category)}
			{@const yesPct = market.yesPercent}
			{@const noPct = 100 - yesPct}
			<a class="welcome-market-card" href={PublicPath.SignUp}>
				<div class="welcome-market-card-top">
					<span style:color={catColor} class="welcome-market-tag"
						>{market.category.toUpperCase()}</span
					>
					<span class="welcome-market-meta num">
						{previewCallers({ id: market.id })}
						{t({ locale: $localeStore, key: 'card.calls' })}
						{#if isTrendingUp({ yesPercent: yesPct, index })}
							<span class="welcome-market-trend text-yes" aria-hidden="true">↑</span>
						{/if}
					</span>
				</div>

				<p class="welcome-market-q">{market.question}</p>

				<div class="welcome-market-bar">
					<div class="welcome-market-bar-labels">
						<span style:color={yesPct >= 50 ? 'var(--yes)' : 'var(--no)'} class="eyebrow">
							{t({ locale: $localeStore, key: 'ticker.consensus' }).toUpperCase()} · {yesPct}%
						</span>
						<span class="num welcome-market-no-pct">{noPct}% NO</span>
					</div>
					<div class="welcome-market-prob" aria-hidden="true">
						<span style:width="{noPct}%" class="welcome-market-prob-no"></span>
						<span style:width="{yesPct}%" class="welcome-market-prob-yes"></span>
					</div>
				</div>

				<div class="welcome-market-foot">
					<span class="num welcome-market-closes">
						{t({ locale: $localeStore, key: 'market.closes' })}
						{market.closesLabel}
					</span>
					<span class="welcome-market-open">
						{t({ locale: $localeStore, key: 'market.open_flow' })}
						<ChevronRight aria-hidden="true" size={12} />
					</span>
				</div>
			</a>
		{/each}
	</div>
</div>

<style lang="postcss">
	.welcome-market-grid {
		display: grid;
		gap: 1.125rem;
		margin-top: 3.5rem;
	}

	@media (min-width: 40rem) {
		.welcome-market-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 64rem) {
		.welcome-market-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.welcome-market-card {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 1.25rem;
		border-radius: 12px;
		border: 1px solid var(--border);
		background: var(--card);
		box-shadow: var(--shadow-card);
		text-decoration: none;
		color: inherit;
		cursor: pointer;
		transition:
			transform 200ms var(--ease-vici),
			border-color 200ms var(--ease-vici),
			background 200ms var(--ease-vici);
	}

	.welcome-market-card:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--laurel) 35%, transparent);
		background: color-mix(in srgb, var(--card) 92%, var(--foreground) 8%);
	}

	.welcome-market-tag {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.welcome-market-card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.welcome-market-meta {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: var(--t-11);
		color: var(--muted-foreground);
	}

	.welcome-market-trend {
		font-weight: 700;
		font-size: var(--t-11);
	}

	.welcome-market-q {
		margin: 0;
		font-size: var(--t-16);
		font-weight: 600;
		line-height: 1.35;
		min-height: 3rem;
		letter-spacing: -0.005em;
		color: var(--foreground);
	}

	.welcome-market-bar-labels {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.375rem;
	}

	.welcome-market-bar-labels .eyebrow {
		font-size: 10px;
	}

	.welcome-market-no-pct {
		font-size: var(--t-11);
		color: var(--muted-foreground);
	}

	.welcome-market-prob {
		display: flex;
		height: 4px;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--foreground) 8%, transparent);
	}

	.welcome-market-prob-no {
		background: var(--no);
	}

	.welcome-market-prob-yes {
		background: var(--yes);
	}

	.welcome-market-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: auto;
		padding-top: 0.375rem;
		border-top: 1px dashed color-mix(in srgb, var(--foreground) 8%, transparent);
	}

	.welcome-market-closes {
		font-size: var(--t-11);
		color: var(--muted-foreground);
	}

	.welcome-market-open {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--t-12);
		font-weight: 600;
		color: var(--laurel);
		opacity: 0;
		transform: translateX(-4px);
		transition:
			opacity 180ms var(--ease-vici),
			transform 180ms var(--ease-vici);
	}

	.welcome-market-card:hover .welcome-market-open {
		opacity: 1;
		transform: translateX(0);
	}
</style>
