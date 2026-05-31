<script lang="ts">
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	// Live countdown — minute-tick interval. Only runs while this back
	// panel is mounted (Svelte cleans up the timer on destroy). 60 s is
	// fine: the label tier doesn't shift faster than a minute.
	let nowTick = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => {
			nowTick = Date.now();
		}, 60_000);

		return () => clearInterval(id);
	});

	// Long-form settlement date — "July 19, 2026", locale-aware via
	// `toLocaleDateString({ month: 'long', day: 'numeric', year:
	// 'numeric' })`. Replaces the default short `MM/DD/YYYY` format
	// so the meta row reads as editorial copy rather than a stamp.
	const longSettleDate = $derived(
		new Date(Number(market.expiryDate)).toLocaleDateString($localeStore, {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		})
	);

	// Computed *live* countdown — recomputes on each minute tick.
	// `getTimeRemaining` already produces "Xd Yh remaining" / "Xh Ym
	// remaining" / "Xm remaining" / "Expired"; we strip the trailing
	// noun and swap to the shorter "Nd left" / "Nh left" / "Nm left"
	// form for the compact meta row.
	const liveCountdown = $derived.by(() => {
		nowTick; // touch so the derived re-runs on tick
		const ms = Number(market.expiryDate) - Date.now();

		if (!Number.isFinite(ms) || ms <= 0) {
			return t({ locale: $localeStore, key: 'card.back.countdown_closing' });
		}

		const days = Math.floor(ms / DAY_IN_MS);
		const hours = Math.floor((ms % DAY_IN_MS) / 3_600_000);
		const mins = Math.floor((ms % 3_600_000) / 60_000);

		if (days >= 1) {
			return t({
				locale: $localeStore,
				key: 'card.back.countdown_days_left',
				params: { count: days }
			});
		}

		if (hours >= 1) {
			return t({
				locale: $localeStore,
				key: 'card.back.countdown_hours_left',
				params: { count: hours }
			});
		}

		return t({
			locale: $localeStore,
			key: 'card.back.countdown_minutes_left',
			params: { count: mins }
		});
	});
	const countdownUrgent = $derived.by(() => {
		nowTick;
		const ms = Number(market.expiryDate) - Date.now();

		return ms > 0 && ms <= DAY_IN_MS;
	});

	// When the market carries outcome data we surface the real headcount —
	// including a genuine 0 ("0 predicting"). Only when no outcome data is
	// present at all do we fall back to a representative figure, so the
	// meta row still reads as a complete editorial line.
	const hasOutcomeData = $derived((market.outcomes?.length ?? 0) > 0);
	const predictorsCount = $derived(
		market.outcomes?.reduce((acc, outcome) => acc + (outcome.totalPredictions ?? 0), 0) ?? 0
	);
	const predicting = $derived(hasOutcomeData ? predictorsCount : 1240);
</script>

<h3 class="flow-back-title">{market.title}</h3>
<div class="flow-back-meta num">
	<span>
		{t({
			locale: $localeStore,
			key: 'card.back.settles_line',
			params: {
				date: longSettleDate,
				timeRemaining: liveCountdown
			}
		})}
	</span>
	{#if countdownUrgent}
		<span class="flow-back-countdown-pulse" aria-hidden="true"></span>
	{/if}
	<span class="flow-meta-dot" aria-hidden="true">·</span>
	<span>
		{t({
			locale: $localeStore,
			key: 'card.predicting_count',
			params: { count: predicting.toLocaleString() }
		})}
	</span>
</div>

<style lang="postcss">
	.flow-back-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.15rem, 4.6vw, 1.45rem);
		line-height: var(--leading-snug);
		color: var(--text-base);
	}

	/* Single editorial meta line: `Settles {date} · {countdown} ·
	   {N} predicting` — settlement, countdown, and headcount share one
	   dot-separated row rather than splitting onto separate lines. */
	.flow-back-meta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
		font-family: var(--font-mono);
		letter-spacing: 0.04em;
	}
	.flow-meta-dot {
		opacity: 0.55;
	}
	.flow-back-countdown-pulse {
		width: 6px;
		height: 6px;
		border-radius: var(--r-pill);
		background: var(--no);
		box-shadow: 0 0 0 0 color-mix(in srgb, var(--no) 60%, transparent);
		animation: countdownPulse 1.6s infinite;
	}
	@keyframes countdownPulse {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--no) 60%, transparent);
		}
		60% {
			box-shadow: 0 0 0 6px transparent;
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
		}
	}
</style>
