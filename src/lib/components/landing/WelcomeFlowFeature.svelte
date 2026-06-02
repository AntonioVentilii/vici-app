<script lang="ts">
	/**
	 * Two-column "Flow Feature" landing section: editorial copy on the
	 * left, animated swipe-demo on the right.
	 *
	 * `tick` cycles 0→3 every 1300 ms — 0 = at rest, 1 = mid-swipe,
	 * 2 = swiped out + xp burst, 3 = next card sliding up.
	 */
	import { Flame, Zap } from '@lucide/svelte/icons';
	import { onDestroy, onMount } from 'svelte';
	import LandingFlowCard from '$lib/components/landing/LandingFlowCard.svelte';
	import { LANDING_MARKETS } from '$lib/constants/landing-data.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	const cards = LANDING_MARKETS.slice(0, 3);
	const stacked = [...cards].reverse();
	let tick = $state(0);
	let intervalId: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		intervalId = setInterval(() => {
			tick = (tick + 1) % 4;
		}, 1300);
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
	});

	const topRot = $derived(tick === 1 ? 10 : tick === 2 ? 26 : 0);
	const topX = $derived(tick === 1 ? 70 : tick === 2 ? 460 : 0);
	const topOpacity = $derived(tick === 2 ? 0 : 1);
	const yesOverlay = $derived(tick >= 1 && tick < 3 ? Math.min(1, topX / 100) : 0);
	const xpY = $derived(tick === 2 ? -30 : tick === 1 ? -8 : 0);
	const xpOpacity = $derived(tick === 2 ? 1 : tick === 1 ? 0.6 : 0);
</script>

<section id="flow" class="lp-section lp-flow-feature lp-root">
	<div class="lp-section-inner">
		<div class="lp-feature-grid">
			<div>
				<div style="gap:8px; margin-bottom:14px;" class="row">
					<span class="eyebrow acc">{t({ locale: $localeStore, key: 'flow.eyebrow' })}</span>
				</div>
				<h2 class="lp-h2">
					{t({ locale: $localeStore, key: 'flow.title_a' })}
					<span class="serif-italic acc">{t({ locale: $localeStore, key: 'flow.title_b' })}</span>
				</h2>
				<p style="margin-top:18px;" class="lp-lede">
					{t({ locale: $localeStore, key: 'flow.lede' })}
				</p>

				<div class="lp-live-pulse">
					<span class="lp-pulse-dot"></span>
					<span style="font-weight:600; color:var(--fg);" class="num">2,847</span>
					<span class="dim t-body">
						<span class="serif-italic">{t({ locale: $localeStore, key: 'flow.in_flow' })}</span>
						{t({ locale: $localeStore, key: 'flow.right_now' })}
					</span>
				</div>

				<ul class="lp-list">
					<li>
						<span class="num acc">01</span>
						{t({ locale: $localeStore, key: 'flow.list_01' })}
					</li>
					<li>
						<span class="num acc">02</span>
						{t({ locale: $localeStore, key: 'flow.list_02' })}
					</li>
					<li>
						<span class="num acc">03</span>
						{t({ locale: $localeStore, key: 'flow.list_03' })}
					</li>
					<li>
						<span class="num acc">04</span>
						{t({ locale: $localeStore, key: 'flow.list_04' })}
					</li>
				</ul>
			</div>

			<div class="lp-flow-demo">
				<div class="lp-streak-chip">
					<Flame style="color: var(--accent);" size={14} strokeWidth={2} />
					<span style="font-weight:600;" class="num">12</span>
					<span style="margin-left:2px;" class="eyebrow t-micro">
						{t({ locale: $localeStore, key: 'chip.day_streak' })}
					</span>
				</div>

				<div class="lp-flow-frame">
					{#each stacked as c, i (c.id)}
						{@const isTop = i === 2}
						{@const depth = 2 - i}
						<div
							style="
								transform: {isTop
								? `translate(${topX}px, 0) rotate(${topRot}deg)`
								: `translate(${depth * -14}px, ${depth * -10}px) scale(${1 - depth * 0.05}) rotate(${depth * -2}deg)`};
								z-index: {10 + i};
								opacity: {isTop ? topOpacity : 0.55 - depth * 0.1};
								transition: transform 520ms var(--ease), opacity 360ms var(--ease);
							"
							class="flow-card {isTop ? 'lp-demo-top' : ''}"
						>
							<LandingFlowCard market={c} />
							{#if isTop && yesOverlay > 0}
								<div style="opacity:{yesOverlay};" class="overlay yes">YES</div>
							{/if}
						</div>
					{/each}

					<div
						style="
							transform: translate({topX * 0.35}px, {xpY}px);
							opacity: {xpOpacity};
							transition: transform 520ms var(--ease), opacity 360ms var(--ease);
						"
						class="lp-xp-burst"
					>
						<Zap size={14} strokeWidth={2.4} />
						<span class="num">+180 VXP</span>
					</div>
				</div>

				<div class="lp-flow-caption num mute">
					<span>{t({ locale: $localeStore, key: 'flow.caption' })}</span>
				</div>
			</div>
		</div>
	</div>
</section>
