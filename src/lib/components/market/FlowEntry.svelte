<script lang="ts">
	/**
	 * FlowEntry — the unified full-bleed frosted entry that sits over the
	 * deck (above the pill-nav) until the user commits to the session.
	 *
	 * One surface, two modes:
	 *  • DECK mode — when there is nothing settled to recap, the deck riffles
	 *    (three cards fan + snap) under the Oracle orb while the first-card
	 *    fetch resolves. Rotating Oracle copy reads while the deck shuffles.
	 *  • DIGEST mode — when calls settled since the user's last visit, the
	 *    "while you were away" recap takes over: outcome-aware framing (net
	 *    gain → celebratory 56px green net + confetti + "keep the run going";
	 *    net loss → measured neutral net, no confetti, "shake it off"), the
	 *    actual resolved calls (win/loss list, capped at 5 + "+N more").
	 *
	 * The "Enter Flow →" CTA arms only when BOTH conditions hold: the read
	 * beat has elapsed (4s, or 600ms under reduced motion — a moment to read
	 * the digest / let the deck settle) AND `ready` is true. `ready` carries
	 * the REAL first-card fetch state, so the CTA never reveals a deck that
	 * has not arrived: while the fetch is in flight the Oracle copy keeps
	 * cycling and the CTA holds its arming state. A countdown bar fills INSIDE
	 * the pill; entering settles the matured calls (`onEnter`) and reveals the
	 * deck.
	 *
	 * As a safety net, the surface auto-enters once both 30s have elapsed and
	 * the deck is ready — so the entry never lingers indefinitely if the CTA
	 * is left untapped. The auto-enter runs the same `onEnter` path (settling
	 * any matured digest). Reduced-motion + theme safe.
	 */
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { ResolutionRevealData } from '$lib/types/flow';
	import { flowBeat, flowSummary } from '$lib/utils/flow-sound.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { formatWholeVxpMagnitude } from '$lib/utils/playground-display.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	interface Props {
		/** The away-digest; `count === 0` falls back to deck-shuffle mode. */
		digest: ResolutionRevealData;
		/**
		 * Real first-card fetch readiness. The CTA arms (and the auto-enter
		 * fires) only once this is true — so neither path ever reveals a deck
		 * that has not yet arrived. Stays false while the deck is loading.
		 */
		ready: boolean;
		/**
		 * Settles the matured calls and reveals the deck. Called once, when
		 * the user taps the armed CTA (or when the 30s ready-gated auto-enter
		 * fires).
		 */
		onEnter: () => void;
	}

	const { digest, ready, onEnter }: Props = $props();

	const hasDigest = $derived(digest.count > 0);
	const positive = $derived(digest.netVxp >= 0);

	// Rotating Oracle copy for the deck-shuffle mode. One line reads, fades,
	// and the next takes its place — continuously, with no empty frames. Each
	// line plays the 1.1s `flowFade` (in → hold → out) and the swap is driven
	// by that animation finishing (`advanceLine`), not by a free-running
	// timer: a `setInterval` drifts against the CSS clock, so a late tick
	// leaves the line parked at the fade-out's `opacity:0` for a visible beat
	// (longer if the tab was ever backgrounded and the interval throttled).
	// Mounting the next line the instant the previous one ends keeps the
	// cadence frame-tight.
	const loadLineKeys = [
		'flow.entry.line.crowd',
		'flow.entry.line.odds',
		'flow.entry.line.shuffle',
		'flow.entry.line.summon'
	] as const;
	let loadLine = $state(0);

	const advanceLine = () => {
		loadLine = (loadLine + 1) % loadLineKeys.length;
	};

	// The read beat — a moment to read the digest / let the deck settle —
	// elapses on a timer. The CTA arms only once this AND the real fetch
	// (`ready`) have both landed, so it never reveals a deck that hasn't
	// arrived.
	let armBeatElapsed = $state(false);
	const ctaReady = $derived(armBeatElapsed && ready);

	// Whether `onEnter` already ran (manual tap or the 30s auto-enter), so the
	// ready-gated auto-enter never double-fires once the deck becomes ready.
	let entered = $state(false);

	// Set when the 30s safety-net timer fires; the actual auto-enter is
	// ready-gated (see the effect below) so it enters at max(30s, ready).
	let autoElapsed = $state(false);

	const previewItems = $derived(digest.items.slice(0, 5));

	// Decorative confetti burst seeds — net-positive batches only. Mirrors
	// the radial `fe-spark` layout: 24 sparks fanned around the net figure.
	const burstSeeds = Array.from({ length: 24 }).map((_, i) => {
		const a = Math.PI * 2 * (i / 24);
		const r = 90 + ((i * 37) % 80);

		return {
			fdx: `${Math.cos(a) * r}px`,
			fdy: `${Math.sin(a) * r - 20}px`,
			frot: `${((i * 53) % 360) - 180}deg`,
			delay: `${(i % 5) * 0.05}s`
		};
	});

	// Reactive reduced-motion driver. `prefersReducedMotion()` reads the live
	// MediaQuery so this $effect re-runs whenever the user toggles the OS
	// preference while the component is mounted — ensuring exactly ONE driver
	// is active at any time: the CSS `animationend` path (full motion) or the
	// plain interval (reduced motion). The interval is also created fresh if
	// the preference flips from full → reduced mid-session, and cancelled when
	// it flips back. The arm timeout is also keyed on the preference so the
	// correct delay (600 ms vs 4 s) is applied from the current state.
	$effect(() => {
		const reduce = prefersReducedMotion();

		// Under reduced motion the line is held static (no `flowFade`, so no
		// `animationend` to drive the swap) — keep the same 1.1s reading beat
		// on a plain timer. The line never animates to `opacity:0`, so there
		// are still no empty frames here.
		const rot = reduce ? setInterval(advanceLine, 1100) : undefined;
		const arm = setTimeout(
			() => {
				armBeatElapsed = true;
			},
			reduce ? 600 : 4000
		);

		// Reveal cue: a celebratory chime for a net gain, a soft single tone
		// for a loss. Suppressed under reduced motion. Stored so it can be
		// cancelled on cleanup if the user navigates or preference flips before
		// the 360 ms fires.
		let audioCue: ReturnType<typeof setTimeout> | undefined;

		if (hasDigest && !reduce) {
			audioCue = setTimeout(() => {
				audioCue = undefined;

				if (positive) {
					flowSummary();
				} else {
					flowBeat(false);
				}
			}, 360);
		}

		return () => {
			clearInterval(rot);
			clearTimeout(arm);
			clearTimeout(audioCue);
		};
	});

	// Auto-enter safety net: after 30s, flag that the wait has run long. Kept
	// in its OWN effect with NO dependency on `prefersReducedMotion()`, so the
	// 30s timer starts once on mount and isn't cleared/restarted when the OS
	// reduced-motion preference is toggled mid-session (which would postpone
	// the safety auto-enter). The actual enter is ready-gated below, so an
	// in-flight deck is never revealed early — it enters the moment the deck
	// becomes ready.
	$effect(() => {
		const auto = setTimeout(() => {
			autoElapsed = true;
		}, 30_000);

		return () => {
			clearTimeout(auto);
		};
	});

	// The fade-out lands on `opacity:0`; advancing on its end mounts the next
	// line right then, so the swap is seamless. Full-motion only — reduced
	// motion holds a static line and cycles on the interval above.
	const onLineEnd = () => {
		if (!prefersReducedMotion()) {
			advanceLine();
		}
	};

	const enterFlow = () => {
		if (!ctaReady || entered) {
			return;
		}

		entered = true;
		onEnter();
	};

	// 30s safety-net auto-enter, ready-gated: enters at max(30s, ready) so the
	// surface never lingers indefinitely, yet never reveals an unready deck.
	$effect(() => {
		if (autoElapsed && ready && !entered) {
			enterFlow();
		}
	});

	const ctaLabel = $derived(
		ctaReady
			? t({ locale: $localeStore, key: 'flow.entry.cta_ready' })
			: t({ locale: $localeStore, key: 'flow.entry.cta_arming' })
	);
</script>

<div class="flow-loading" aria-live="polite" role="status">
	{#if hasDigest}
		<!-- DIGEST MODE — focused on the resolved calls; no deck animation
		     competing for attention. -->
		<div class="away-view {positive ? 'win' : 'loss'}">
			{#if positive}
				<div class="away-burst" aria-hidden="true">
					{#each burstSeeds as seed, i (i)}
						<i
							style="--fdx: {seed.fdx}; --fdy: {seed.fdy}; --frot: {seed.frot}; animation-delay: {seed.delay}"
						></i>
					{/each}
				</div>
			{/if}
			<div class="orcfloat-sm"><OracleChar animate size={44} /></div>
			<div class="eyebrow-mute">{t({ locale: $localeStore, key: 'flow.entry.away_eyebrow' })}</div>
			<div class="away-net">
				{positive ? '+' : '−'}{formatWholeVxpMagnitude(digest.netVxp)}
				{t({ locale: $localeStore, key: 'flow.reso.vxp' })}
			</div>
			<div class="away-sub">
				{t({
					locale: $localeStore,
					key: 'flow.entry.away_sub',
					params: { count: digest.count, wins: digest.wins, losses: digest.losses }
				})}
			</div>
			<div class="away-copy">
				{positive
					? t({ locale: $localeStore, key: 'flow.entry.away_copy_win' })
					: t({ locale: $localeStore, key: 'flow.entry.away_copy_loss' })}
			</div>
			<div class="reslist">
				{#each previewItems as it (it.eventId)}
					<div class="resrow">
						<span class="resdot {it.result}" aria-hidden="true"></span>
						<span class="resq">{it.question}</span>
						<span class="resv {it.result}"
							>{it.net > 0 ? '+' : it.net < 0 ? '−' : ''}{formatWholeVxpMagnitude(it.net)}</span
						>
					</div>
				{/each}
			</div>
			{#if digest.count > 5}
				<div class="resmore">
					{t({
						locale: $localeStore,
						key: 'flow.entry.away_more',
						params: { count: digest.count - 5 }
					})}
				</div>
			{/if}
			<button
				class="enter-cta{ctaReady ? ' ready' : ''}"
				disabled={!ctaReady}
				onclick={enterFlow}
				type="button"
			>
				{#if !ctaReady}<span class="cta-fill" aria-hidden="true"></span>{/if}
				<span class="cta-label">{ctaLabel}</span>
			</button>
		</div>
	{:else}
		<!-- DECK MODE — the shuffle, when there's nothing to settle. -->
		<div class="deckwrap" aria-hidden="true">
			<div class="pc a"><i class="t"></i><i class="m"></i><i class="s"></i></div>
			<div class="pc c"><i class="t"></i><i class="m"></i><i class="s"></i></div>
			<div class="pc b"><i class="t"></i><i class="m"></i><i class="s"></i></div>
			<div class="orcfloat"><span class="orb"><OracleChar animate size={58} /></span></div>
		</div>
		<div class="label">
			<div class="eyebrow-mute">{t({ locale: $localeStore, key: 'flow.entry.deck_eyebrow' })}</div>
			{#key loadLine}
				<!-- Ambient loading flavor — hidden from the polite live region so
				     the 1.1s swaps aren't announced on every cycle. -->
				<span class="line" aria-hidden="true" onanimationend={onLineEnd}
					>{t({ locale: $localeStore, key: loadLineKeys[loadLine] })}</span
				>
			{/key}
			<button
				class="enter-cta{ctaReady ? ' ready' : ''}"
				disabled={!ctaReady}
				onclick={enterFlow}
				type="button"
			>
				{#if !ctaReady}<span class="cta-fill" aria-hidden="true"></span>{/if}
				<span class="cta-label">{ctaLabel}</span>
			</button>
		</div>
	{/if}
</div>
