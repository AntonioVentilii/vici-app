<script lang="ts">
	import { ChevronRight, Clock } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LandingSectionHeader from '$lib/components/landing/LandingSectionHeader.svelte';
	import { PublicPath } from '$lib/constants/routes.constants';
	import {
		daysToKickoff,
		featuredEvent,
		featuredEventActive,
		featuredEventFavourites
	} from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	// Mirrors V1.2's landing WCFeature section — eyebrow + countdown,
	// big title, CTA, and a small grid of favourite participants. Reads
	// entirely from the FeaturedEvent abstraction (b9dfb7d) so swapping
	// the next tentpole (Olympics, election, …) is a one-export change
	// in the constants file. Hidden when the event is archived.
</script>

{#if $featuredEventActive}
	<section class="welcome-featured-event">
		<div class="welcome-section-inner">
			<div class="welcome-featured-grid">
				<div class="welcome-featured-copy">
					<div class="welcome-featured-meta">
						<LandingSectionHeader
							eyebrow={t({
								locale: $localeStore,
								key: 'welcome.featured_event.eyebrow'
							})}
							sub={t({
								locale: $localeStore,
								key: 'welcome.featured_event.sub',
								params: { event: $featuredEvent.title }
							})}
							title={$featuredEvent.title}
							titleSuffix={$featuredEvent.subtitle}
						/>

						<div class="welcome-featured-countdown">
							<Clock aria-hidden="true" size={12} strokeWidth={2} />
							<span class="num">
								{#if $daysToKickoff !== null && $daysToKickoff > 0}
									{t({
										locale: $localeStore,
										key: 'welcome.featured_event.countdown',
										params: { days: $daysToKickoff }
									})}
								{:else}
									{t({ locale: $localeStore, key: 'welcome.featured_event.countdown_live' })}
								{/if}
							</span>
						</div>
					</div>

					<button
						class="welcome-featured-cta"
						onclick={() => goto(resolve(PublicPath.SignUp))}
						type="button"
					>
						{t({ locale: $localeStore, key: 'welcome.featured_event.cta' })}
						<ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
					</button>
				</div>

				<div class="welcome-featured-favourites">
					{#each $featuredEventFavourites as favourite (favourite.id)}
						{@const accent = favourite.color ?? 'var(--laurel)'}
						<button
							style:background="linear-gradient(160deg, {accent}1A, transparent 70%)"
							style:border="1px solid {accent}33"
							class="welcome-favourite-tile"
							onclick={() => goto(resolve(PublicPath.SignUp))}
							type="button"
						>
							{#if favourite.glyph}
								<span class="welcome-favourite-glyph" aria-hidden="true">{favourite.glyph}</span>
							{/if}
							<span class="welcome-favourite-name">{favourite.name}</span>
							{#if favourite.odds !== undefined}
								<span style:color={accent} class="welcome-favourite-odds num">
									{t({
										locale: $localeStore,
										key: 'welcome.featured_event.to_win',
										params: { odds: favourite.odds.toFixed(1) }
									})}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</section>
{/if}

<style lang="postcss">
	.welcome-featured-event {
		padding: 3rem 0;
	}

	.welcome-section-inner {
		max-width: var(--content-max);
		margin: 0 auto;
		padding: 0 1.25rem;
	}

	.welcome-featured-grid {
		display: grid;
		gap: 2rem;
		align-items: start;
	}

	@media (min-width: 768px) {
		.welcome-featured-grid {
			grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
			gap: 3rem;
		}
	}

	.welcome-featured-copy {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.welcome-featured-meta {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.welcome-featured-countdown {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		align-self: flex-start;
		padding: 0.3rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--laurel) 28%, transparent);
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		color: var(--laurel);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.welcome-featured-cta {
		display: inline-flex;
		align-self: flex-start;
		align-items: center;
		gap: 0.4rem;
		padding: 0.85rem 1.4rem;
		border: 0;
		border-radius: var(--r-pill);
		background: var(--laurel);
		color: var(--ink);
		font-size: var(--t-14);
		font-weight: 700;
		letter-spacing: 0;
		cursor: pointer;
		transition:
			transform var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici);
	}

	.welcome-featured-cta:hover {
		background: var(--laurel-deep);
		transform: translateY(-1px);
	}

	.welcome-featured-favourites {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.welcome-favourite-tile {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1.25rem 1.1rem;
		border-radius: var(--r-12);
		text-align: left;
		cursor: pointer;
		appearance: none;
		font: inherit;
		color: inherit;
		transition: transform var(--d-hover) var(--ease-vici);
	}

	.welcome-favourite-tile:hover {
		transform: translateY(-2px);
	}

	.welcome-favourite-glyph {
		font-size: 1.85rem;
		line-height: 1;
	}

	.welcome-favourite-name {
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 600;
	}

	.welcome-favourite-odds {
		font-size: var(--t-12);
		font-weight: 600;
		letter-spacing: 0.04em;
	}
</style>
