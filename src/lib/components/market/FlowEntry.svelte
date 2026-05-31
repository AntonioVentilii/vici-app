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
	 * There is NO auto-dismiss. A gated "Enter Flow →" CTA arms after 4s
	 * (600ms under reduced motion) with a countdown bar filling INSIDE the
	 * pill; entering settles the matured calls (`onEnter`) and reveals the
	 * deck. The loading mode is wired to the REAL first-card fetch state —
	 * `loading` flips false when the deck has arrived; between-card waits
	 * prefetch and never re-show this surface. Reduced-motion + theme safe.
	 */
	import { onMount } from 'svelte';
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { ResolutionRevealData } from '$lib/types/flow';
	import { flowBeat, flowSummary } from '$lib/utils/flow-sound.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	interface Props {
		/** The away-digest; `count === 0` falls back to deck-shuffle mode. */
		digest: ResolutionRevealData;
		/**
		 * Settles the matured calls and reveals the deck. Called once, when
		 * the user taps the armed CTA.
		 */
		onEnter: () => void;
	}

	const { digest, onEnter }: Props = $props();

	const hasDigest = $derived(digest.count > 0);
	const positive = $derived(digest.netVxp >= 0);

	// Rotating Oracle copy for the deck-shuffle mode. Cycles every 1.1s.
	const loadLineKeys = [
		'flow.entry.line.crowd',
		'flow.entry.line.odds',
		'flow.entry.line.shuffle',
		'flow.entry.line.summon'
	] as const;
	let loadLine = $state(0);

	// The CTA arms on a timer (a beat to read the digest / let the deck
	// settle), not on the fetch — the user always enters on their own.
	let ctaReady = $state(false);

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

	onMount(() => {
		const reduce = prefersReducedMotion();
		const rot = setInterval(() => {
			loadLine = (loadLine + 1) % loadLineKeys.length;
		}, 1100);
		const arm = setTimeout(
			() => {
				ctaReady = true;
			},
			reduce ? 600 : 4000
		);

		// Reveal cue: a celebratory chime for a net gain, a soft single tone
		// for a loss. Suppressed under reduced motion.
		if (hasDigest && !reduce) {
			setTimeout(() => {
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
		};
	});

	const enterFlow = () => {
		if (!ctaReady) {
			return;
		}

		onEnter();
	};

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
				{positive ? '+' : '−'}{Math.abs(digest.netVxp).toLocaleString()}
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
						<span class="resdot {it.won ? 'win' : 'loss'}" aria-hidden="true"></span>
						<span class="resq">{it.question}</span>
						<span class="resv {it.won ? 'win' : 'loss'}"
							>{it.net >= 0 ? '+' : '−'}{Math.abs(it.net)}</span
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
				<span style="animation: flowFade 1100ms ease both" class="line"
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
