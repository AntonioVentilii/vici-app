<script lang="ts">
	import MarketArtwork from '$lib/components/market/MarketArtwork.svelte';
	import FlowCoach from '$lib/components/onboarding/FlowCoach.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import SwipeableMarketCard from '$lib/components/ui/SwipeableMarketCard.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { FeaturedEventParticipant } from '$lib/types/featured-event';
	import { haptic } from '$lib/utils/haptics.utils';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding · Beat 1.b — derived prediction card.
	 *
	 * Verbatim port of `Beat1WC` phase 1.b from `onboarding-v2.jsx`
	 * (lines 92-125). Wraps the shared swipeable card in the same
	 * `.ob2-card-stage` envelope and mounts the FlowCoach overlay
	 * above it.
	 *
	 * Two question modes:
	 *   - Picked team → advancement market ("Will X make the round of
	 *     16?"). Soft predict beat — the user is asked about *their*
	 *     team's run, not who wins it all.
	 *   - Skipped     → the first favourite's winner market ("Will
	 *     Brazil win the World Cup?").
	 */
	interface Props {
		// `null` selects the skip path (no team picked); otherwise a
		// participant id (ISO-3166 alpha-2 for the WC).
		participantId: string | null;
		onCommit: (side: 'YES' | 'NO') => void;
		onChangeTeam: () => void;
	}

	const { participantId, onCommit, onChangeTeam }: Props = $props();

	const commit = (side: 'YES' | 'NO') => {
		// Firm tap on first-call commit.
		haptic('firm-tap');
		onCommit(side);
	};

	const event = $derived($featuredEvent);

	const kickoffDays = $derived(
		Math.max(0, Math.ceil((event.kickoffAt_ms - Date.now()) / DAY_IN_MS))
	);

	const picked: FeaturedEventParticipant | undefined = $derived(
		participantId === null ? undefined : event.participants.find((p) => p.id === participantId)
	);

	const fallbackFavourite: FeaturedEventParticipant | undefined = $derived(
		event.participants.find((p) => p.id === event.favouriteIds[0])
	);

	const advancement = $derived(picked ? event.advancementMarkets?.[picked.id] : undefined);

	const yesPct = $derived(advancement?.yes ?? 50);
	const noPct = $derived(100 - yesPct);

	const titleKey = $derived(
		picked && advancement ? 'onboarding.beat1b.title_advance' : 'onboarding.beat1b.title_winner'
	);
	const titleTeamName = $derived(picked?.name ?? fallbackFavourite?.name ?? '');

	// Stable seed for the FlowArt figure. Picked team's identifiers take
	// precedence so a participant with no advancement market (reachable
	// via the "+N more" list) still seeds off its own id rather than the
	// favourite's — otherwise the figure contradicts the "Backing X"
	// copy. Falls through to the fallback favourite for the skip path.
	const artworkSeed = $derived(
		advancement?.id ??
			picked?.marketId ??
			picked?.id ??
			fallbackFavourite?.marketId ??
			fallbackFavourite?.id ??
			event.id
	);
</script>

<div class="ob2-beat ob2-beat-1">
	<div class="ob2-wc-eyebrow">
		<span class="ob2-wc-tag">{event.title}</span>
		<span class="ob2-wc-countdown">
			· {t({
				locale: $localeStore,
				key: 'onboarding.beat1.kickoff_days',
				params: { days: kickoffDays }
			})}
		</span>
	</div>

	<h1 class="ob2-h1">{t({ locale: $localeStore, key: 'onboarding.beat1b.headline' })}</h1>
	{#if picked}
		<p class="ob2-sub">
			<CountryFlag class="ob2-picked-flag" countryCode={picked.id} />
			{t({ locale: $localeStore, key: 'onboarding.beat1b.backing_prefix' })}
			<b style:color={picked.color ?? 'var(--laurel)'}>{picked.name}</b>
			· {t({ locale: $localeStore, key: 'onboarding.beat1b.backing_sub' })}
			<button class="ob2-change-team" onclick={onChangeTeam} type="button">
				{t({ locale: $localeStore, key: 'onboarding.beat1b.change_team' })}
			</button>
		</p>
	{:else}
		<p class="ob2-sub">
			{t({
				locale: $localeStore,
				key: 'onboarding.beat1b.skip_sub',
				params: { team: fallbackFavourite?.name ?? '' }
			})}
		</p>
	{/if}

	<div class="ob2-card-stage">
		<SwipeableMarketCard onCommit={(side) => commit(side)}>
			{#snippet children(swipe)}
				<div
					style:transform="translate3d({swipe.dragX}px, {swipe.dragY * 0.2}px, 0) rotate({swipe.rotation}deg)"
					class="ob2-swipe-card"
					class:is-committed={swipe.committed !== null}
					class:is-dragging={swipe.dragging}
				>
					<h2 class="ob2-card-question">
						{t({ locale: $localeStore, key: titleKey, params: { team: titleTeamName } })}
					</h2>

					<div class="ob2-card-art">
						<MarketArtwork bleed category="wc" seed={artworkSeed} size={420} state="neutral" />
					</div>

					<div class="ob2-card-probs">
						<div class="ob2-card-prob no">
							<span class="ob2-card-prob-label"
								>{t({ locale: $localeStore, key: 'outcome.no' })}</span
							>
							<span class="ob2-card-prob-pct">{noPct}%</span>
						</div>
						<div class="ob2-card-prob yes">
							<span class="ob2-card-prob-label"
								>{t({ locale: $localeStore, key: 'outcome.yes' })}</span
							>
							<span class="ob2-card-prob-pct">{yesPct}%</span>
						</div>
					</div>

					<span
						style:opacity={swipe.yesOpacity}
						class="ob2-swipe-stamp ob2-swipe-stamp-yes"
						aria-hidden="true"
					>
						{t({ locale: $localeStore, key: 'outcome.yes' })}
					</span>
					<span
						style:opacity={swipe.noOpacity}
						class="ob2-swipe-stamp ob2-swipe-stamp-no"
						aria-hidden="true"
					>
						{t({ locale: $localeStore, key: 'outcome.no' })}
					</span>
				</div>
			{/snippet}
		</SwipeableMarketCard>
		<FlowCoach surface="onboarding" />
	</div>
</div>

<style lang="postcss">
	/* Inner card uses local `ob2-swipe-card` namespacing to avoid
	   clashing with the broader `ob-*` stylesheet. The outer
	   `ob2-card-stage` and `ob2-beat-1` containers live in `app.css`. */
	.ob2-swipe-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 22px;
		background: var(--ink-raised);
		border: 1px solid var(--ink-line);
		border-radius: var(--r-12);
		will-change: transform;
		transition: transform 360ms var(--ease-vici);
	}
	.ob2-swipe-card.is-dragging {
		transition: none;
	}
	.ob2-swipe-card.is-committed {
		pointer-events: none;
	}
	.ob2-card-question {
		margin: 0;
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
		line-height: 1.18;
		letter-spacing: var(--tracking-tight);
		color: var(--parchment);
	}
	/* Edge-to-edge FlowArt — cancels the swipe card's 22px padding so
	   the WC figure / spots / confetti span the body, matching the
	   prototype's `ob-art` bleed (`onboarding.jsx:128-129`). */
	.ob2-card-art {
		position: relative;
		width: calc(100% + 44px);
		height: 150px;
		margin: 0 -22px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		border-top: 1px solid var(--ink-line);
		border-bottom: 1px solid var(--ink-line);
	}
	.ob2-card-art :global(.market-artwork),
	.ob2-card-art :global(.flow-art) {
		width: 100%;
		height: 100%;
		max-width: none;
		border-radius: 0;
		box-shadow: none;
	}
	.ob2-card-art :global(.flow-art svg) {
		width: 100%;
		height: 100%;
	}
	.ob2-card-probs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.ob2-card-prob {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 14px 8px;
		background: rgba(242, 236, 220, 0.04);
		border: 1px solid var(--ink-line);
		border-radius: 10px;
	}
	.ob2-card-prob.no {
		color: var(--no);
	}
	.ob2-card-prob.yes {
		color: var(--yes);
	}
	.ob2-card-prob-label {
		font-family: var(--font-mono);
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		font-weight: 700;
	}
	.ob2-card-prob-pct {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
	}
	.ob2-swipe-stamp {
		position: absolute;
		top: 22px;
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		padding: 4px 10px;
		border-radius: var(--r-pill);
		pointer-events: none;
		transition: opacity 80ms linear;
	}
	.ob2-swipe-stamp-yes {
		right: 22px;
		color: var(--yes);
		border: 2px solid var(--yes);
		transform: rotate(-12deg);
	}
	.ob2-swipe-stamp-no {
		left: 22px;
		color: var(--no);
		border: 2px solid var(--no);
		transform: rotate(12deg);
	}
</style>
