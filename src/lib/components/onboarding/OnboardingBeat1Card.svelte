<script lang="ts">
	import FlowCoach from '$lib/components/onboarding/FlowCoach.svelte';
	import SwipeableMarketCard from '$lib/components/ui/SwipeableMarketCard.svelte';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { FeaturedEventParticipant } from '$lib/types/featured-event';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding · Beat 1.b — derived prediction card.
	 *
	 * Composes the "first call" card from the picked
	 * team (or skip path) chosen in Beat 1.a. Two question modes:
	 *
	 *   - Picked team → advancement market ("Will X make the round of
	 *     16?"). Soft predict beat — the user is asked about *their*
	 *     team's run, not who wins it all.
	 *   - Skipped     → the first favourite's winner market ("Will
	 *     Brazil win the World Cup?").
	 *
	 * Emits `onCommit('YES' | 'NO')` either via swipe gesture (via the
	 * shared `SwipeableMarketCard` primitive) or via tap on the
	 * fallback YES / NO buttons. `onChangeTeam` fires the "Change team"
	 * affordance — the orchestrator routes that back to Beat 1.a.
	 */
	interface Props {
		// `null` selects the skip path (no team picked); otherwise a
		// participant id (ISO-3166 alpha-2 for the WC).
		participantId: string | null;
		onCommit: (side: 'YES' | 'NO') => void;
		onChangeTeam: () => void;
	}

	const { participantId, onCommit, onChangeTeam }: Props = $props();

	// Delay between the user committing a side and advancing to Beat 2 so
	// the swipe-card animation (or the tapped YES/NO button highlight) has
	// time to play.
	const COMMIT_FEEDBACK_MS = 360;

	let committing: 'YES' | 'NO' | null = $state(null);

	const commit = (side: 'YES' | 'NO') => {
		if (committing !== null) {
			return;
		}

		committing = side;
		setTimeout(() => onCommit(side), COMMIT_FEEDBACK_MS);
	};

	const event = $derived($featuredEvent);

	const picked: FeaturedEventParticipant | undefined = $derived(
		participantId === null ? undefined : event.participants.find((p) => p.id === participantId)
	);

	// Skip path → the first favourite as the canonical "wins it all"
	// market. For WC 2026 that's BR.
	const fallbackFavourite: FeaturedEventParticipant | undefined = $derived(
		event.participants.find((p) => p.id === event.favouriteIds[0])
	);

	const advancement = $derived(picked ? event.advancementMarkets?.[picked.id] : undefined);

	// `yes` is in the 0–100 scale in the FeaturedEvent type; map to 0–1
	// for the percentage formatter.
	const yesPct = $derived(advancement?.yes ?? 50);
	const noPct = $derived(100 - yesPct);

	// Question template picks per branch. Picked team with an advancement
	// market → "round of 16" framing; picked team without one (long-tail
	// participant) or skip → "wins the World Cup" framing.
	const titleKey = $derived(
		picked && advancement ? 'onboarding.beat1b.title_advance' : 'onboarding.beat1b.title_winner'
	);
	const titleTeamName = $derived(picked?.name ?? fallbackFavourite?.name ?? '');
</script>

<section class="ob2-beat ob2-beat-1b" aria-labelledby="ob2-beat1b-title">
	<div class="ob2-wc-eyebrow">
		<span class="allcaps ob2-wc-tag">{event.title}</span>
		<span class="ob2-wc-eyebrow-sub allcaps">
			{t({ locale: $localeStore, key: 'onboarding.beat1b.eyebrow_first_call' })}
		</span>
	</div>

	<h1 id="ob2-beat1b-title" class="ob2-h1">
		{t({ locale: $localeStore, key: 'onboarding.beat1b.headline' })}
	</h1>

	{#if picked}
		<p class="ob2-sub">
			<span class="ob2-team-glyph" aria-hidden="true">{picked.glyph ?? ''}</span>
			{t({
				locale: $localeStore,
				key: 'onboarding.beat1b.backing',
				params: { team: picked.name }
			})}
			<span class="ob2-sub-detail">
				{t({ locale: $localeStore, key: 'onboarding.beat1b.backing_sub' })}
			</span>
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
						<div class="ob2-card-probs-row">
							<div class="ob2-card-probs-side ob2-card-probs-side-no">
								<span class="ob2-card-probs-pct num">{noPct}%</span>
								<span class="ob2-card-probs-label allcaps">
									{t({ locale: $localeStore, key: 'outcome.no' })}
								</span>
							</div>
							<div class="ob2-card-probs-track" aria-hidden="true">
								<div
									style:width="{noPct}%"
									class="ob2-card-probs-fill ob2-card-probs-fill-no"
								></div>
								<div
									style:width="{yesPct}%"
									class="ob2-card-probs-fill ob2-card-probs-fill-yes"
								></div>
							</div>
							<div class="ob2-card-probs-side ob2-card-probs-side-yes">
								<span class="ob2-card-probs-label allcaps">
									{t({ locale: $localeStore, key: 'outcome.yes' })}
								</span>
								<span class="ob2-card-probs-pct num">{yesPct}%</span>
							</div>
						</div>
					</div>

					<div class="ob2-prob-grid">
						<button
							class="ob2-prob-btn no"
							class:is-dimmed={committing !== null && committing !== 'NO'}
							class:is-picked={committing === 'NO'}
							disabled={committing !== null}
							onclick={() => commit('NO')}
							type="button"
						>
							<span>{t({ locale: $localeStore, key: 'outcome.no' })}</span>
							<strong class="num">{noPct}%</strong>
						</button>
						<button
							class="ob2-prob-btn yes"
							class:is-dimmed={committing !== null && committing !== 'YES'}
							class:is-picked={committing === 'YES'}
							disabled={committing !== null}
							onclick={() => commit('YES')}
							type="button"
						>
							<span>{t({ locale: $localeStore, key: 'outcome.yes' })}</span>
							<strong class="num">{yesPct}%</strong>
						</button>
					</div>

					<span
						style:opacity={swipe.yesOpacity}
						class="ob2-swipe-stamp ob2-swipe-stamp-yes allcaps"
						aria-hidden="true"
					>
						{t({ locale: $localeStore, key: 'outcome.yes' })}
					</span>
					<span
						style:opacity={swipe.noOpacity}
						class="ob2-swipe-stamp ob2-swipe-stamp-no allcaps"
						aria-hidden="true"
					>
						{t({ locale: $localeStore, key: 'outcome.no' })}
					</span>
				</div>
			{/snippet}
		</SwipeableMarketCard>
		<FlowCoach />
	</div>

	<p class="allcaps ob2-swipe-hint" aria-hidden="true">
		{t({ locale: $localeStore, key: 'onboarding.beat1b.swipe_hint' })}
	</p>
</section>

<style lang="postcss">
	.ob2-beat {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem 1.1rem 1.5rem;
		color: var(--text-base);
	}

	.ob2-card-stage {
		position: relative;
	}

	.ob2-card-question {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.1rem, 4vw, 1.35rem);
		font-weight: 700;
		line-height: 1.18;
		letter-spacing: -0.02em;
		color: var(--text-base);
		text-wrap: balance;
	}

	.ob2-card-probs {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.ob2-card-probs-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.6rem;
	}

	.ob2-card-probs-side {
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
		font-family: var(--font-display);
	}

	.ob2-card-probs-side-no {
		color: var(--no);
	}

	.ob2-card-probs-side-yes {
		color: var(--yes);
	}

	.ob2-card-probs-pct {
		font-size: var(--t-20, 1.25rem);
		font-weight: 700;
	}

	.ob2-card-probs-label {
		font-size: var(--t-12);
		font-weight: 700;
	}

	.ob2-card-probs-track {
		position: relative;
		height: 6px;
		border-radius: 999px;
		background: var(--no-wash);
		overflow: hidden;
	}

	.ob2-card-probs-fill {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 999px;
	}

	.ob2-card-probs-fill-no {
		left: 0;
		background: linear-gradient(90deg, var(--no), color-mix(in srgb, var(--no) 65%, transparent));
	}

	.ob2-card-probs-fill-yes {
		right: 0;
		background: linear-gradient(90deg, color-mix(in srgb, var(--yes) 65%, transparent), var(--yes));
	}

	.ob2-wc-eyebrow {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.45rem;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.ob2-wc-tag {
		color: var(--laurel);
		font-weight: 700;
	}

	.ob2-wc-eyebrow-sub {
		font-weight: 600;
	}

	.ob2-h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 6vw, 2rem);
		line-height: var(--leading-tight);
		color: var(--text-base);
	}

	.ob2-sub {
		margin: 0;
		font-size: var(--t-14);
		color: var(--text-muted);
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.4rem;
	}

	.ob2-team-glyph {
		font-size: 1.15rem;
		line-height: 1;
	}

	.ob2-sub-detail {
		color: var(--text-base);
	}

	.ob2-change-team {
		appearance: none;
		margin-left: auto;
		padding: 0;
		font: inherit;
		font-size: var(--t-12);
		color: var(--laurel);
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: underline;
	}

	.ob2-prob-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
		margin-top: 0.5rem;
	}

	.ob2-prob-btn {
		appearance: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 1.1rem 0.75rem;
		min-height: 5rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			transform 140ms ease,
			border-color 140ms ease,
			background 140ms ease;
	}

	.ob2-prob-btn .num {
		font-size: var(--t-20, 1.25rem);
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.ob2-prob-btn.no {
		border-color: color-mix(in srgb, var(--no) 38%, var(--border-base));
		color: var(--no);
	}

	.ob2-prob-btn.no:hover:not(:disabled) {
		background: color-mix(in srgb, var(--no-wash) 22%, var(--bg-surface));
		transform: translateY(-1px);
	}

	.ob2-prob-btn.no.is-picked {
		background: color-mix(in srgb, var(--no) 18%, var(--bg-surface));
		border-color: var(--no);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--no) 28%, transparent);
		animation: ob2-pulse 360ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.ob2-prob-btn.yes {
		border-color: color-mix(in srgb, var(--yes) 38%, var(--border-base));
		color: var(--yes);
	}

	.ob2-prob-btn.yes:hover:not(:disabled) {
		background: color-mix(in srgb, var(--yes-wash) 22%, var(--bg-surface));
		transform: translateY(-1px);
	}

	.ob2-prob-btn.yes.is-picked {
		background: color-mix(in srgb, var(--yes) 18%, var(--bg-surface));
		border-color: var(--yes);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--yes) 28%, transparent);
		animation: ob2-pulse 360ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.ob2-prob-btn.is-dimmed {
		opacity: 0.4;
	}

	.ob2-prob-btn:disabled {
		cursor: default;
	}

	@keyframes ob2-pulse {
		0% {
			transform: scale(1);
		}
		55% {
			transform: scale(1.04);
		}
		100% {
			transform: scale(1.02);
		}
	}

	.ob2-swipe-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem 1.1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		will-change: transform;
		transition:
			transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 220ms ease;
	}

	.ob2-swipe-card.is-dragging {
		transition: none;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.18),
			0 0 0 1px color-mix(in srgb, var(--text-base) 6%, transparent);
	}

	.ob2-swipe-card.is-committed {
		transition: transform 360ms cubic-bezier(0.4, 0, 0.8, 0.6);
		pointer-events: none;
	}

	.ob2-swipe-stamp {
		position: absolute;
		top: 0.9rem;
		font-family: var(--font-display);
		font-size: var(--t-22, 1.4rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.2rem 0.6rem;
		border-radius: var(--r-pill);
		pointer-events: none;
		transition: opacity 80ms linear;
	}

	.ob2-swipe-stamp-yes {
		right: 0.9rem;
		color: var(--yes);
		border: 2px solid var(--yes);
		transform: rotate(-12deg);
	}

	.ob2-swipe-stamp-no {
		left: 0.9rem;
		color: var(--no);
		border: 2px solid var(--no);
		transform: rotate(12deg);
	}

	.ob2-swipe-hint {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
		text-align: center;
	}
</style>
