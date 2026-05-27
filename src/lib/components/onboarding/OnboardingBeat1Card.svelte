<script lang="ts">
	import FlowCoach from '$lib/components/onboarding/FlowCoach.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import SwipeableMarketCard from '$lib/components/ui/SwipeableMarketCard.svelte';
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
		Math.max(0, Math.ceil((event.kickoffAt_ms - Date.now()) / (24 * 60 * 60 * 1000)))
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
		border-radius: 16px;
		will-change: transform;
		transition: transform 360ms cubic-bezier(0.2, 0.7, 0.2, 1);
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
		letter-spacing: -0.02em;
		color: var(--parchment);
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
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 700;
	}
	.ob2-card-prob-pct {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.ob2-swipe-stamp {
		position: absolute;
		top: 22px;
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 4px 10px;
		border-radius: 999px;
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
