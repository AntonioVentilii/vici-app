<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Tournament detail — port of the prototype's `TournamentBoutDetail`
	 * (16-league single-elimination bracket + prize tiers).
	 *
	 * The bracket is heavily mocked data in the prototype: rounds,
	 * matches, league standings per round. Our backend has no
	 * tournament collection yet — leagues + bouts are real but there's
	 * no "monthly bracket" concept. This page surfaces the prototype's
	 * structure with a "backend pending" hint so the route exists and
	 * users see what's coming, without faking the standings.
	 */
</script>

<div class="tournament-page">
	<MobileAppBar
		align="left"
		back={{
			label: t({ locale: $localeStore, key: 'tournament.back' }),
			onBack: () => void goto(resolve(AppPath.Social))
		}}
		title={t({ locale: $localeStore, key: 'tournament.title' })}
	/>

	<section class="tournament-hero">
		<span class="allcaps tournament-tag">
			{t({ locale: $localeStore, key: 'tournament.eyebrow' })}
		</span>
		<h1 class="tournament-headline">
			{t({ locale: $localeStore, key: 'tournament.headline' })}
		</h1>
		<p class="tournament-sub">
			{t({ locale: $localeStore, key: 'tournament.sub' })}
		</p>
	</section>

	<section class="tournament-section">
		<h2 class="eyebrow tournament-section-eyebrow">
			{t({ locale: $localeStore, key: 'tournament.bracket_eyebrow' })}
		</h2>
		<div class="tournament-pending">
			<p>{t({ locale: $localeStore, key: 'tournament.bracket_pending' })}</p>
		</div>
	</section>

	<section class="tournament-section">
		<h2 class="eyebrow tournament-section-eyebrow">
			{t({ locale: $localeStore, key: 'tournament.prizes_eyebrow' })}
		</h2>
		<ul class="tournament-prizes">
			<li class="tournament-prize is-gold">
				<span class="num tournament-prize-place">1st</span>
				<span class="tournament-prize-label">
					{t({ locale: $localeStore, key: 'tournament.prize.gold' })}
				</span>
				<span class="num tournament-prize-amount">+5,000</span>
			</li>
			<li class="tournament-prize is-silver">
				<span class="num tournament-prize-place">2nd</span>
				<span class="tournament-prize-label">
					{t({ locale: $localeStore, key: 'tournament.prize.silver' })}
				</span>
				<span class="num tournament-prize-amount">+2,500</span>
			</li>
			<li class="tournament-prize is-bronze">
				<span class="num tournament-prize-place">3rd</span>
				<span class="tournament-prize-label">
					{t({ locale: $localeStore, key: 'tournament.prize.bronze' })}
				</span>
				<span class="num tournament-prize-amount">+1,000</span>
			</li>
		</ul>
	</section>
</div>

<style lang="postcss">
	.tournament-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem 6rem;
	}

	.tournament-hero {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.2rem 1.1rem;
		background: color-mix(in srgb, #b49cff 10%, var(--bg-surface));
		border: 1px solid color-mix(in srgb, #b49cff 30%, var(--border-base));
		border-radius: var(--r-12);
	}

	.tournament-tag {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.15rem 0.55rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, #b49cff 18%, transparent);
		color: #b49cff;
		align-self: flex-start;
	}

	.tournament-headline {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-24, 1.5rem);
		font-weight: 600;
		line-height: 1.15;
		color: var(--text-base);
	}

	.tournament-sub {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.tournament-section {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.tournament-section-eyebrow {
		margin: 0;
		color: var(--text-muted);
	}

	.tournament-pending {
		padding: 1rem 1.1rem;
		font-size: var(--t-13);
		line-height: 1.5;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
	}

	.tournament-prizes {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.tournament-prize {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.tournament-prize.is-gold {
		border-color: color-mix(in srgb, #f4c544 45%, var(--border-base));
		background: color-mix(in srgb, #f4c544 6%, var(--bg-surface));
	}

	.tournament-prize.is-silver {
		border-color: color-mix(in srgb, #c0c5cc 45%, var(--border-base));
		background: color-mix(in srgb, #c0c5cc 6%, var(--bg-surface));
	}

	.tournament-prize.is-bronze {
		border-color: color-mix(in srgb, #c97c4a 45%, var(--border-base));
		background: color-mix(in srgb, #c97c4a 6%, var(--bg-surface));
	}

	.tournament-prize-place {
		font-size: var(--t-18, 1.2rem);
		font-weight: 700;
		min-width: 2.5rem;
	}

	.tournament-prize-label {
		flex: 1;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
	}

	.tournament-prize-amount {
		font-size: var(--t-14);
		font-weight: 700;
		color: var(--laurel);
	}
</style>
