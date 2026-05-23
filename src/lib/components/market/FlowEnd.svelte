<script lang="ts">
	import { fly } from 'svelte/transition';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import FlowInviteCard from '$lib/components/market/FlowInviteCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
	import type { FlameStage } from '$lib/utils/streak.utils';

	interface Props {
		betsCount: number;
		xp: number;
		dailyStreak: number;
		flameStage: FlameStage;
		flameLabel: string;
		accuracyUnlocked: boolean;
		lifetimeAccuracy: number;
		lifetimeTotalTrades: number;
		onBackToMarkets: () => void;
	}

	const {
		betsCount,
		xp,
		dailyStreak,
		flameStage,
		flameLabel,
		accuracyUnlocked,
		lifetimeAccuracy,
		lifetimeTotalTrades,
		onBackToMarkets
	}: Props = $props();
</script>

<!-- FlowEnd — brand voice ("Vici." serif-italic display, terse
     copy). No confetti / no green-check celebration; the
     accomplishment is the laurel + the numbers, not noise. -->
<div class="flow-end">
	<div class="flow-end-inner" in:fly={{ y: 20, duration: 500 }}>
		<h2 class="flow-end-title display">Vici.</h2>
		<p class="flow-end-sub">
			{#if betsCount === 0}
				{t({ locale: $localeStore, key: 'flow.end.no_calls' })}
			{:else if betsCount === 1}
				{t({ locale: $localeStore, key: 'flow.end.one_call' })}
			{:else}
				{t({
					locale: $localeStore,
					key: 'flow.end.many_calls',
					params: { count: betsCount }
				})}
			{/if}
		</p>

		<div class="flow-end-grid">
			<div class="flow-end-cell">
				<div class="allcaps flow-end-cell-label">
					{t({ locale: $localeStore, key: 'flow.session_xp' })}
				</div>
				<div class="num flow-end-cell-value">+{xp}</div>
			</div>
			<div class="flow-end-cell flow-end-cell-streak" class:is-hot={dailyStreak >= 7}>
				<div class="flow-end-cell-flame">
					<FlameChar animate={dailyStreak >= 1} size={28} stage={flameStage} />
				</div>
				<div class="allcaps flow-end-cell-label">{flameLabel}</div>
				<div class="num flow-end-cell-value">
					{t({ locale: $localeStore, key: 'flow.streak_days', params: { count: dailyStreak } })}
				</div>
			</div>
			<div class="flow-end-cell">
				{#if accuracyUnlocked}
					<div class="allcaps flow-end-cell-label">
						{t({ locale: $localeStore, key: 'profile.dashboard.accuracy_short' })}
					</div>
					<div class="num flow-end-cell-value">{Math.round(lifetimeAccuracy)}%</div>
				{:else}
					<div class="allcaps flow-end-cell-label">
						{t({ locale: $localeStore, key: 'profile.dashboard.calls_short' })}
					</div>
					<div class="num flow-end-cell-value">{lifetimeTotalTrades + betsCount}</div>
					<div class="flow-end-cell-foot">
						{t({ locale: $localeStore, key: 'flow.until_accuracy' })}
					</div>
				{/if}
			</div>
		</div>

		<FlowInviteCard sessionXp={xp} />
		<Button onclick={onBackToMarkets}>
			{t({ locale: $localeStore, key: 'flow.back_to_markets' })}
		</Button>
	</div>
</div>

<style lang="postcss">
	/* FlowEnd — session summary surface. Brand voice over confetti.
	   `.display` headline (serif italic) sits with the bedded grid;
	   no green-check celebration, no big particle field. */
	.flow-end {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background:
			radial-gradient(circle at 20% 10%, var(--laurel-glow), transparent 45%), var(--bg-base);
		overflow: hidden;
	}
	.flow-end-inner {
		max-width: 22rem;
		text-align: center;
	}
	.flow-end-title {
		font-size: var(--t-64);
		margin: 0 0 0.5rem;
		color: var(--laurel);
	}
	@media (min-width: 400px) {
		.flow-end-title {
			font-size: var(--t-88);
		}
	}
	.flow-end-sub {
		font-size: var(--t-14);
		color: var(--text-muted);
		margin: 0 0 1.75rem;
		font-family: var(--font-display);
	}

	.flow-end-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.625rem;
		margin-bottom: 1.5rem;
	}
	.flow-end-cell {
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		padding: 0.875rem 0.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		box-shadow: var(--inset-hi);
	}
	.flow-end-cell-streak.is-hot {
		background: linear-gradient(135deg, var(--color-primary), var(--laurel));
		color: var(--color-primary-foreground);
		box-shadow: 0 4px 12px var(--laurel-glow);
	}
	.flow-end-cell-flame {
		display: flex;
		justify-content: center;
		margin-bottom: 2px;
	}
	.flow-end-cell-label {
		font-size: 10px;
		color: var(--text-muted);
	}
	.flow-end-cell-streak.is-hot .flow-end-cell-label {
		color: var(--color-primary-foreground);
		opacity: 0.85;
	}
	.flow-end-cell-value {
		font-size: var(--t-24);
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.05;
		color: var(--text-base);
	}
	.flow-end-cell-streak.is-hot .flow-end-cell-value {
		color: var(--color-primary-foreground);
	}
	.flow-end-cell-foot {
		font-size: 9px;
		color: var(--text-muted);
		opacity: 0.56;
		font-family: var(--font-display);
		text-transform: uppercase;
		letter-spacing: var(--tracking-allcaps);
	}
</style>
