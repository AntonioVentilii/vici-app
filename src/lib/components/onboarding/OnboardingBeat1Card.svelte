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
	 * Wraps the shared swipeable card in the `.ob2-card-stage`
	 * envelope and mounts the FlowCoach overlay above it. The card is
	 * a sectioned editorial layout: a gold-tinted header (category +
	 * first-call badges, question, "Backing X" context), a full-bleed
	 * WC artwork band, and a body with the NO/YES probability tiles
	 * and footer.
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
		<span class="ob2-wc-tag">{event.badgeTitle ?? event.title}</span>
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
		<!-- Behind-card shadow — tilted slightly so the live card reads as
		     the top of a stack. -->
		<div class="ob2-card-shadow" aria-hidden="true"></div>

		<SwipeableMarketCard onCommit={(side) => commit(side)}>
			{#snippet children(swipe)}
				<div
					style:transform="translate3d({swipe.dragX}px, {swipe.dragY * 0.2}px, 0) rotate({swipe.rotation}deg)"
					class="ob2-swipe-card"
					class:is-committed={swipe.committed !== null}
					class:is-dragging={swipe.dragging}
				>
					<!-- Tinted header — category + first-call badges, question,
					     and the "Backing X" context line. -->
					<div class="ob2-card-head">
						<div class="ob2-card-head-row">
							<span class="ob2-card-tag">{event.shortTitle ?? event.title}</span>
							<span class="ob2-card-flag"
								>{t({ locale: $localeStore, key: 'onboarding.beat1b.first_call' })}</span
							>
						</div>
						<h2 class="ob2-card-question">
							{t({ locale: $localeStore, key: titleKey, params: { team: titleTeamName } })}
						</h2>
						<p class="ob2-card-ctx">
							{t({ locale: $localeStore, key: 'onboarding.beat1b.backing_prefix' })}
							{titleTeamName}
						</p>
					</div>

					<!-- Full-bleed artwork band. -->
					<div class="ob2-card-art">
						<MarketArtwork bleed fill category="wc" seed={artworkSeed} size={420} state="neutral" />
					</div>

					<!-- Body — probability tiles + footer. -->
					<div class="ob2-card-body">
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
						<div class="ob2-card-foot">
							<span class="ob2-card-foot-calls"
								>— {t({ locale: $localeStore, key: 'card.calls' })}</span
							>
							<span class="ob2-card-foot-swipe"
								>{t({ locale: $localeStore, key: 'card.swipe_to_call' })}</span
							>
						</div>
					</div>

					<!-- Edge tints — light up the chosen side as the card is dragged. -->
					<div
						style:opacity={Math.min(1, Math.max(0, swipe.dragX / 100)) * 0.55}
						class="ob2-card-edge yes"
						aria-hidden="true"
					></div>
					<div
						style:opacity={Math.min(1, Math.max(0, -swipe.dragX / 100)) * 0.55}
						class="ob2-card-edge no"
						aria-hidden="true"
					></div>

					<!-- Swipe stamps. -->
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
	/* Sectioned card — tinted header, full-bleed art, body — that
	   fills the stage and sits over a slightly tilted shadow card.
	   Local `ob2-*` namespacing avoids clashing with the broader `ob-*`
	   stylesheet; the outer `ob2-card-stage` / `ob2-beat-1` containers
	   live in `app.css`. */

	/* The swipe host (from SwipeableMarketCard) is the flex child that
	   fills the stage; the card inside is absolutely positioned so it
	   overlaps the shadow card cleanly. */
	.ob2-card-stage :global(.swipe-host) {
		position: relative;
		z-index: 2;
		flex: 1 1 auto;
		min-height: 0;
	}

	.ob2-card-shadow {
		position: absolute;
		right: 12px;
		bottom: -2px;
		left: 12px;
		top: 14px;
		z-index: 1;
		background: linear-gradient(180deg, var(--ink-elevated), var(--ink-raised));
		border: 1px solid var(--ink-line);
		border-radius: var(--r-12);
		transform: rotate(-2deg);
		opacity: 0.45;
	}

	.ob2-swipe-card {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: linear-gradient(180deg, var(--ink-elevated), var(--ink-raised));
		border: 1px solid var(--ink-line-strong);
		border-radius: var(--r-12);
		box-shadow:
			0 18px 50px -16px rgba(0, 0, 0, 0.6),
			inset 0 1px 0 rgba(242, 236, 220, 0.08);
		will-change: transform;
		transition: transform 360ms var(--ease-vici);
	}
	.ob2-swipe-card.is-dragging {
		transition: none;
	}
	.ob2-swipe-card.is-committed {
		pointer-events: none;
	}

	/* Tinted header — gold wash + hairline divider. */
	.ob2-card-head {
		flex-shrink: 0;
		padding: 16px 18px 12px;
		background: linear-gradient(
			160deg,
			rgba(226, 184, 66, 0.15) 0%,
			rgba(226, 184, 66, 0.06) 60%,
			transparent 100%
		);
		border-bottom: 1px solid rgba(226, 184, 66, 0.12);
	}
	.ob2-card-head-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.ob2-card-tag {
		display: inline-flex;
		padding: 3px 7px;
		border-radius: 4px;
		background: rgba(242, 236, 220, 0.06);
		color: var(--laurel);
		font-family: var(--font-display);
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.ob2-card-flag {
		color: var(--laurel);
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.ob2-card-question {
		margin: 10px 0 4px;
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		line-height: 1.18;
		letter-spacing: var(--tracking-tight);
		color: var(--parchment);
		text-wrap: balance;
	}
	.ob2-card-ctx {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.4;
		color: var(--parchment-dim);
	}

	/* Full-bleed art band — grows to fill the card height. */
	.ob2-card-art {
		position: relative;
		flex: 1;
		min-height: 120px;
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

	.ob2-card-body {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px 18px 14px;
	}
	.ob2-card-probs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.ob2-card-prob {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 14px;
		background: rgba(242, 236, 220, 0.02);
		border: 1px solid var(--ink-line);
		border-radius: 11px;
	}
	.ob2-card-prob.no {
		align-items: flex-start;
		color: var(--no);
	}
	.ob2-card-prob.yes {
		align-items: flex-end;
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
		font-family: var(--font-mono);
		font-size: 26px;
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
	}

	.ob2-card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.ob2-card-foot-calls {
		font-family: var(--font-mono);
		font-size: var(--t-11);
		color: var(--parchment-mute);
	}
	.ob2-card-foot-swipe {
		font-family: var(--font-mono);
		font-size: var(--t-10);
		letter-spacing: 0.14em;
		color: var(--parchment-mute);
	}

	/* Edge tints — fade in toward the swiped side. */
	.ob2-card-edge {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		transition: opacity 100ms linear;
	}
	.ob2-card-edge.yes {
		background: linear-gradient(270deg, rgba(79, 211, 161, 0.55), transparent 55%);
	}
	.ob2-card-edge.no {
		background: linear-gradient(90deg, rgba(255, 107, 107, 0.55), transparent 55%);
	}

	.ob2-swipe-stamp {
		position: absolute;
		top: 22px;
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		padding: 6px 12px;
		border-radius: 6px;
		pointer-events: none;
		transition: opacity 100ms linear;
	}
	.ob2-swipe-stamp-yes {
		right: 22px;
		color: var(--yes);
		border: 2px solid var(--yes);
		transform: rotate(8deg);
	}
	.ob2-swipe-stamp-no {
		left: 22px;
		color: var(--no);
		border: 2px solid var(--no);
		transform: rotate(-8deg);
	}
</style>
