<script lang="ts">
	import MarketArtwork from '$lib/components/market/MarketArtwork.svelte';
	import FlowCoach from '$lib/components/onboarding/FlowCoach.svelte';
	import OnboardingStepTracker from '$lib/components/onboarding/OnboardingStepTracker.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import { DAY_IN_MS, ZERO } from '$lib/constants/app.constants';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { FeaturedEventParticipant } from '$lib/types/featured-event';
	import { resolveFlowArtCategory } from '$lib/utils/flow-art.utils';
	import { formatVolume } from '$lib/utils/format.utils';
	import { haptic } from '$lib/utils/haptics.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { buildOnboardingFirstCallMarket } from '$lib/utils/onboarding-market.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	/**
	 * Onboarding · Beat 1.b — bespoke first-call card.
	 *
	 * A dedicated, simpler swipeable card for the opening "make your
	 * first call" beat — deliberately NOT the in-product Flow deck card.
	 * It carries its own header (event tag + days pill + first-call
	 * label), generative artwork band, YES / NO probability split, and
	 * footer, plus the shared `FlowCoach` gesture overlay. The actual
	 * commit is YES / NO only — tap-to-flip and swipe-up SKIP are not
	 * wired here — but the coach still
	 * demonstrates the full gesture set (the SKIP and tap cues teach the
	 * deck's vocabulary). Phase 3 ("tap card") degrades to a
	 * zoom-and-de-blur on this faceless card rather than a flip.
	 *
	 * Two question modes (mirrored from the team-pick branch):
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

	// The participant the card frames — the picked team, or the first
	// favourite on the skip path so the winner market still has a subject.
	const subject: FeaturedEventParticipant | undefined = $derived(picked ?? fallbackFavourite);

	// Synthetic `Market` the card binds to. Built off the featured-event
	// fixture (onboarding runs pre-auth, before any market hydrates).
	const market = $derived(buildOnboardingFirstCallMarket({ event, participant: picked }));

	// Resolved artwork category + accent. The featured event is the WC
	// tentpole, so the band uses the WC visual language and laurel-gold
	// accent — same renderer the in-product deck uses, fit by height in
	// the `.ob-art` band rather than stretched.
	const artCategory = $derived(resolveFlowArtCategory({ categoryId: 'wc', seed: market.id }));
	const accent = $derived(tagColor('wc'));

	const yesPct = $derived(Math.round(market.yesProbability * 100));
	const noPct = $derived(100 - yesPct);

	// Footer volume line — formatted volume when the market has any, else
	// "New market". The onboarding card binds to a synthetic featured-event
	// fixture (`buildOnboardingFirstCallMarket`) whose `totalVolume` is
	// genuinely zero pre-auth, so this reads "New market" here — the same
	// cold-start branch a real fresh market would take. No fabricated
	// volume is shown.
	const volumeLine = $derived(
		market.totalVolume > ZERO
			? formatVolume({
					volume: market.totalVolume,
					decimals: market.token.decimals,
					symbol: market.token.symbol
				})
			: t({ locale: $localeStore, key: 'market.detail.stats.new_market' })
	);

	// Editorial sub-line under the question — "Backing Brazil". Echoes
	// the team just chosen (or the framed favourite on the skip path).
	const context = $derived(
		subject
			? t({
					locale: $localeStore,
					key: 'onboarding.beat1b.card_context',
					params: { team: subject.name }
				})
			: undefined
	);

	// Header tint + border, mixed from the resolved accent so the head
	// reads as a soft wash of the category colour.
	const headBackground = $derived(
		`linear-gradient(160deg, color-mix(in srgb, ${accent} 15%, transparent) 0%, color-mix(in srgb, ${accent} 6%, transparent) 60%, transparent 100%)`
	);
	const headBorder = $derived(`color-mix(in srgb, ${accent} 12%, transparent)`);

	// ── Swipe physics — plain deltas, no spring. Commit threshold of
	// 80 px each way; a light settle delay before the parent advances.
	const SWIPE_THRESHOLD = 80;
	const SETTLE_MS = 80;

	let startX = 0;
	let startY = 0;
	let dragX = $state(0);
	let dragY = $state(0);
	let dragging = $state(false);
	let committed: 'YES' | 'NO' | null = $state(null);

	const rotation = $derived(dragX / 18);
	const yesStampOpacity = $derived(Math.min(1, Math.max(0, dragX / 60)));
	const noStampOpacity = $derived(Math.min(1, Math.max(0, -dragX / 60)));
	const yesEdgeOpacity = $derived(Math.min(1, Math.max(0, dragX / 100)) * 0.55);
	const noEdgeOpacity = $derived(Math.min(1, Math.max(0, -dragX / 100)) * 0.55);

	const cardTransform = $derived(`translate(${dragX}px, ${dragY}px) rotate(${rotation}deg)`);
	const cardTransition = $derived(
		dragging ? 'none' : 'transform 360ms cubic-bezier(0.2, 0.7, 0.2, 1), opacity 360ms'
	);

	const commit = (side: 'YES' | 'NO') => {
		if (committed) {
			return;
		}

		committed = side;
		dragX = side === 'YES' ? 480 : -480;
		dragY = 0;
		dragging = false;
		// Firm tap on first-call commit.
		haptic('firm-tap');
		setTimeout(() => onCommit(side), SETTLE_MS);
	};

	const isInteractiveTarget = (target: EventTarget | null): boolean => {
		const el = target as HTMLElement | null;

		return Boolean(el?.closest('button, a, input, textarea, select'));
	};

	const onPointerDown = (e: MouseEvent | TouchEvent) => {
		if (committed || isInteractiveTarget(e.target)) {
			return;
		}

		const p = 'touches' in e ? e.touches[0] : e;
		startX = p.clientX;
		startY = p.clientY;
		dragging = true;
	};

	const onPointerMove = (e: MouseEvent | TouchEvent) => {
		if (!dragging || committed) {
			return;
		}

		const p = 'touches' in e ? e.touches[0] : e;
		dragX = p.clientX - startX;
		dragY = p.clientY - startY;
	};

	const onPointerUp = () => {
		if (!dragging || committed) {
			return;
		}

		dragging = false;

		if (dragX > SWIPE_THRESHOLD) {
			commit('YES');

			return;
		}

		if (dragX < -SWIPE_THRESHOLD) {
			commit('NO');

			return;
		}

		dragX = 0;
		dragY = 0;
	};
</script>

<div class="ob2-beat ob2-beat-1">
	<OnboardingStepTracker step={1} />

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
		<div class="ob-stage">
			<!-- Shadow card behind the live card. -->
			<div class="ob-shadow" aria-hidden="true"></div>

			<!-- Live swipeable card. Pointer-driven; YES / NO only. -->
			<div
				style:transform={cardTransform}
				style:transition={cardTransition}
				style:opacity={committed ? 0 : 1}
				class="ob-card"
				class:committed={committed !== null}
				onmousedown={onPointerDown}
				onmouseleave={onPointerUp}
				onmousemove={onPointerMove}
				onmouseup={onPointerUp}
				ontouchend={onPointerUp}
				ontouchmove={onPointerMove}
				ontouchstart={onPointerDown}
				role="presentation"
			>
				<!-- Tinted header. -->
				<div
					style:background={headBackground}
					style:border-bottom={`1px solid ${headBorder}`}
					class="ob-card-head"
				>
					<div class="ob-card-head-row">
						<div class="ob-card-head-meta">
							<span
								style:color={accent}
								style:background="color-mix(in srgb, var(--text-base) 6%, transparent)"
								class="ob-tag"
							>
								{event.badgeTitle ?? event.title}
							</span>
							<span class="ob-days">
								{t({
									locale: $localeStore,
									key: 'onboarding.beat1b.days_short',
									params: { days: kickoffDays }
								})}
							</span>
						</div>
						<span style:color={accent} class="ob-first-call">
							{t({ locale: $localeStore, key: 'onboarding.beat1b.first_call_label' })}
						</span>
					</div>
					<h2 class="ob-q">{market.title}</h2>
					{#if context}
						<p class="ob-ctx">{context}</p>
					{/if}
				</div>

				<!-- Generative artwork — fit by height in the band so the
				     figure reads whole, never stretched to the band aspect
				     (sizing lives in the `.ob-art` rules in app.css). -->
				<div class="ob-art">
					<MarketArtwork category={artCategory} fill seed={market.id} state="neutral" />
				</div>

				<!-- Probability split + footer. -->
				<div class="ob-body">
					<div class="ob-probs">
						<div class="ob-prob no">
							<span class="ob-prob-eyebrow no">
								{t({ locale: $localeStore, key: 'flow.action.no' })}
							</span>
							<span class="ob-prob-num">{noPct}%</span>
						</div>
						<div class="ob-prob yes">
							<span class="ob-prob-eyebrow yes">
								{t({ locale: $localeStore, key: 'flow.action.yes' })}
							</span>
							<span class="ob-prob-num">{yesPct}%</span>
						</div>
					</div>
					<div class="ob-foot">
						<span class="ob-foot-vol num">
							{volumeLine}
						</span>
						<span class="ob-foot-swipe">
							{t({ locale: $localeStore, key: 'card.swipe_to_call' })}
						</span>
					</div>
				</div>

				<!-- Drag edge tints. -->
				<div style:opacity={yesEdgeOpacity} class="ob-edge yes" aria-hidden="true"></div>
				<div style:opacity={noEdgeOpacity} class="ob-edge no" aria-hidden="true"></div>

				<!-- Swipe stamps. -->
				<span style:opacity={yesStampOpacity} class="ob-stamp yes" aria-hidden="true">
					{t({ locale: $localeStore, key: 'flow.action.yes' })}
				</span>
				<span style:opacity={noStampOpacity} class="ob-stamp no" aria-hidden="true">
					{t({ locale: $localeStore, key: 'flow.action.no' })}
				</span>
			</div>

			<!-- Shared gesture coach — the same five-phase overlay the deck
			     uses, riding on this surface's `.ob-card`. Cycles NO / YES
			     / SKIP / TAP / IDLE, drifting the card in sympathy via the
			     `data-coach-phase` CSS in app.css, and dismisses on the
			     first pointer-down. Shown once per device
			     (`vici.coach-onboarding-seen`). -->
			<FlowCoach surface="onboarding" />
		</div>
	</div>
</div>
