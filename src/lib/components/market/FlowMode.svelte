<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount, onDestroy } from 'svelte';
	import { cubicOut, backOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import FlowCard from '$lib/components/market/FlowCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_STAKE_STEP_VXP } from '$lib/constants/vxp-trade.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { playgroundFlowTradeUnitLabel } from '$lib/derived/playground.derived';
	import { flowTradeService } from '$lib/services/flow.services';
	import { getFlowQueue } from '$lib/services/market.services';
	import { getPositions } from '$lib/services/position.services';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
	import {
		assertViciXpHumanPremiumAndPayout,
		resolveOutcomeExecutionPriceForSizing
	} from '$lib/utils/trade.utils';

	const MAX_BETS = 10;
	const MAX_MARKETS = 20;
	const BASE_XP_PER_BET = 10;

	let markets = $state<Market[]>([]);
	let currentIndex = $state(0);
	let loading = $state(true);
	let tradeAmount = $state('1.0');
	let betsCount = $state(0);
	let completed = $state(false);
	let positions = $state<Position[]>([]);

	let exitX = $state(0);
	let exitY = $state(0);

	let streak = $state(0);
	let bestStreak = $state(0);
	let xp = $state(0);
	let lastStreakShown = $state(0);

	interface XpPop {
		id: number;
		amount: number;
		combo: number;
		side: 'YES' | 'NO';
	}

	let xpPops = $state<XpPop[]>([]);
	let popCounter = 0;

	const comboMultiplier = $derived(streak >= 5 ? 3 : streak >= 3 ? 2 : 1);

	const vibrate = (pattern: number | number[]) => {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(pattern);
			} catch {
				/* ignore */
			}
		}
	};

	onMount(async () => {
		document.body.classList.add('overflow-hidden');

		flowTradeService.startSession();

		try {
			const [queue, userPositions] = await Promise.all([
				getFlowQueue($balanceDomain),
				nonNullish($userStore.user) ? getPositions($balanceDomain) : Promise.resolve([])
			]);

			markets = queue.slice(0, MAX_MARKETS);
			positions = userPositions;

			const fromProfile = $userStore.profile?.preferences?.defaultAmount?.flow;

			if (isViciXp($balanceDomain)) {
				const candidate = fromProfile ?? String(VXP_STAKE_STEP_VXP);
				const n = Number(candidate);

				tradeAmount =
					Number.isFinite(n) &&
					n >= VXP_STAKE_STEP_VXP &&
					n % VXP_STAKE_STEP_VXP === 0 &&
					Number.isInteger(n)
						? String(n)
						: String(VXP_STAKE_STEP_VXP);
			} else if (fromProfile) {
				tradeAmount = fromProfile;
			}
		} catch (e) {
			console.error('Failed to load Flow queue', e);
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		document.body.classList.remove('overflow-hidden');
		void flowTradeService.endSession();
	});

	const spawnXpPop = ({
		amount,
		combo,
		side
	}: {
		amount: number;
		combo: number;
		side: 'YES' | 'NO';
	}) => {
		const id = ++popCounter;
		xpPops = [...xpPops, { id, amount, combo, side }];

		setTimeout(() => {
			xpPops = xpPops.filter((p) => p.id !== id);
		}, 1100);
	};

	const handleAction = (action: 'YES' | 'NO' | 'SKIP') => {
		if (completed) {
			return;
		}

		const currentMarket = markets[currentIndex];

		if (!currentMarket) {
			return;
		}

		if (action === 'YES') {
			exitX = 500;
			exitY = 20;
			vibrate(12);
		} else if (action === 'NO') {
			exitX = -500;
			exitY = 20;
			vibrate(12);
		} else if (action === 'SKIP') {
			exitX = 0;
			exitY = -500;
			vibrate(8);
		}

		if (action === 'SKIP') {
			streak = 0;
			advance();

			return;
		}

		const executeTrade = async () => {
			try {
				if (isViciXp(currentMarket.balanceDomain)) {
					const executionPrice = resolveOutcomeExecutionPriceForSizing({
						market: currentMarket,
						action,
						orderType: 'MARKET'
					});

					assertViciXpHumanPremiumAndPayout({
						amountStr: tradeAmount,
						executionPrice
					});
				}

				await flowTradeService.executeTrade({
					market: currentMarket,
					action,
					amount: tradeAmount
				});
			} catch (e) {
				notificationsStore.add({
					title: 'Trade Failed',
					message: `Order for "${currentMarket.title.slice(0, 30)}..." failed: ${(e as Error).message}`,
					type: 'error'
				});
			}
		};

		void executeTrade();

		betsCount += 1;
		streak += 1;
		bestStreak = Math.max(bestStreak, streak);

		const awarded = BASE_XP_PER_BET * comboMultiplier;
		xp += awarded;
		spawnXpPop({ amount: awarded, combo: comboMultiplier, side: action });

		if (streak === 3 || streak === 5 || streak === 10) {
			const shown = streak;
			lastStreakShown = shown;
			vibrate([12, 40, 18]);
			setTimeout(() => {
				if (lastStreakShown === shown) {
					lastStreakShown = 0;
				}
			}, 1600);
		}

		advance();
	};

	const advance = () => {
		if (currentIndex < markets.length - 1 && betsCount < MAX_BETS) {
			currentIndex += 1;
		} else {
			completed = true;
			vibrate([14, 30, 20, 30, 40]);
		}
	};

	const backToMarkets = () => {
		goto(AppPath.Home);
	};

	const incrementAmount = (direction: 1 | -1) => {
		const step = isViciXp($balanceDomain) ? VXP_STAKE_STEP_VXP : 0.1;
		const min = isViciXp($balanceDomain) ? VXP_STAKE_STEP_VXP : 0.1;
		const current = Number(tradeAmount) || 0;
		const next = Math.max(min, Number((current + direction * step).toFixed(2)));
		tradeAmount = String(next);
	};

	const visibleCards = $derived(markets.slice(currentIndex, currentIndex + 3));
</script>

<div
	class="flow-shell bg-background"
	class:is-active={!completed && markets.length > 0 && !loading}
>
	{#if loading}
		<div class="flex h-full w-full flex-col items-center justify-center gap-4" in:fade>
			<LoadingSpinner />
			<p class="text-muted-foreground font-medium">Preparing your Flow queue…</p>
		</div>
	{:else if completed || markets.length === 0}
		<div class="completion-bg flex h-full w-full flex-col items-center justify-center px-6">
			<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
				{#each Array(24) as _, i (i)}
					<span style="--i: {i}; --delay: {i * 0.08}s; --hue: {(i * 37) % 360}deg" class="confetti"
					></span>
				{/each}
			</div>

			<div class="relative z-10 max-w-md text-center" in:fly={{ y: 20, duration: 500 }}>
				<div
					class="bg-yes-wash text-yes mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full shadow-[0_20px_40px_rgba(79,211,161,0.2)]"
					in:scale={{ start: 0.4, duration: 600, easing: backOut, delay: 120 }}
				>
					<svg class="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M5 13l4 4L19 7"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
						/>
					</svg>
				</div>

				<h2 class="text-foreground mb-2 text-4xl font-black tracking-tighter">Flow Complete</h2>
				<p class="text-muted-foreground mb-6">
					{#if betsCount === 0}
						You reviewed all available markets.
					{:else}
						You made <span class="text-foreground font-black">{betsCount}</span>
						{betsCount === 1 ? 'prediction' : 'predictions'}. Called it.
					{/if}
				</p>

				<div class="mb-8 grid grid-cols-3 gap-3">
					<div class="bg-card border-border rounded-2xl border px-3 py-4">
						<div class="text-laurel text-[9px] font-bold tracking-widest uppercase">XP</div>
						<div class="text-foreground font-mono text-2xl font-black tabular-nums">+{xp}</div>
					</div>
					<div class="bg-card border-border rounded-2xl border px-3 py-4">
						<div class="text-laurel text-[9px] font-bold tracking-widest uppercase">Streak</div>
						<div class="text-laurel font-mono text-2xl font-black tabular-nums">
							{bestStreak}
						</div>
					</div>
					<div class="bg-card border-border rounded-2xl border px-3 py-4">
						<div class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
							Predictions
						</div>
						<div class="text-foreground font-mono text-2xl font-black tabular-nums">
							{betsCount}
						</div>
					</div>
				</div>

				<Button onclick={backToMarkets}>Back to Markets</Button>
			</div>
		</div>
	{:else}
		<header class="flow-topbar" in:fade>
			<button class="flow-icon-btn" aria-label="Exit Flow" onclick={backToMarkets}>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						d="M6 18L18 6M6 6l12 12"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2.5"
					/>
				</svg>
			</button>

			<div class="flow-progress" aria-label="Progress">
				{#each Array(MAX_BETS) as _, i (i)}
					<div class="flow-progress-seg">
						<div
							style:--p={i < betsCount ? '100%' : i === betsCount ? '30%' : '0%'}
							class="flow-progress-fill"
							class:is-current={i === betsCount}
							class:is-full={i < betsCount}
						></div>
					</div>
				{/each}
			</div>

			<div class="flow-stats">
				<div class="flow-stat flow-stat-streak" class:is-hot={streak >= 3} aria-label="Streak">
					<span class="text-[9px] font-black tracking-widest uppercase">Streak</span>
					<span class="font-mono tabular-nums">{streak}</span>
				</div>
				<div class="flow-stat flow-stat-xp" aria-label="XP">
					<span class="text-laurel text-[10px] font-black tracking-widest">XP</span>
					<span class="text-foreground font-mono tabular-nums">{xp}</span>
				</div>
			</div>
		</header>

		{#if lastStreakShown > 0}
			{#key lastStreakShown}
				<div
					class="combo-banner"
					in:fly={{ y: -8, duration: 300, easing: backOut }}
					out:fade={{ duration: 250 }}
				>
					<span>Streak ×{lastStreakShown}</span>
					<span class="combo-banner-xp">x{lastStreakShown >= 5 ? 3 : 2} XP</span>
				</div>
			{/key}
		{/if}

		<main class="flow-stage">
			<div class="flow-card-wrap">
				{#each visibleCards as market, i (market?.id)}
					{@const isCurrent = i === 0}
					<div
						style="z-index: {20 - i}; --depth: {i};"
						class="flow-card-slot"
						class:is-back={!isCurrent}
						in:fly={isCurrent && currentIndex === 0
							? { y: 300, duration: 600, easing: cubicOut }
							: { y: 30, opacity: 0, duration: 400, easing: cubicOut }}
						out:fly={{ x: exitX, y: exitY, duration: 450, opacity: 0, easing: cubicOut }}
					>
						<FlowCard
							interactive={isCurrent}
							isLimitOrderNo={isNullish(market.bestBid)}
							isLimitOrderYes={isNullish(market.bestAsk)}
							{market}
							onAction={handleAction}
							position={positions.find((p) => p.marketId === market.id)}
							signedIn={nonNullish($userStore.user)}
							{tradeAmount}
						/>
					</div>
				{/each}
			</div>

			<div class="xp-pops" aria-hidden="true">
				{#each xpPops as pop (pop.id)}
					<div
						class="xp-pop"
						class:xp-pop-no={pop.side === 'NO'}
						class:xp-pop-yes={pop.side === 'YES'}
					>
						+{pop.amount}
						<span class="xp-pop-label">XP{pop.combo > 1 ? ` · ×${pop.combo}` : ''}</span>
					</div>
				{/each}
			</div>
		</main>

		<footer class="flow-bottombar">
			<div class="flow-amount">
				<button
					class="flow-amount-btn"
					aria-label="Decrease amount"
					onclick={() => incrementAmount(-1)}
				>
					−
				</button>
				<div class="flow-amount-field">
					<input
						class="flow-amount-input"
						inputmode="decimal"
						min={isViciXp($balanceDomain) ? VXP_STAKE_STEP_VXP : 0.1}
						step={isViciXp($balanceDomain) ? VXP_STAKE_STEP_VXP : 0.1}
						type="number"
						bind:value={tradeAmount}
					/>
					<span class="flow-amount-unit">{$playgroundFlowTradeUnitLabel}</span>
				</div>
				<button
					class="flow-amount-btn"
					aria-label="Increase amount"
					onclick={() => incrementAmount(1)}
				>
					+
				</button>
			</div>

			<div class="flow-actions">
				<button
					class="flow-action flow-action-no"
					aria-label="Predict NO"
					onclick={() => handleAction('NO')}
				>
					<svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M6 18L18 6M6 6l12 12"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
						/>
					</svg>
					<span class="flow-action-label">NO</span>
				</button>

				<button
					class="flow-action flow-action-skip"
					aria-label="Skip"
					onclick={() => handleAction('SKIP')}
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M5 12l7-7 7 7M5 19l7-7 7 7"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
						/>
					</svg>
					<span class="flow-action-label">SKIP</span>
				</button>

				<button
					class="flow-action flow-action-yes"
					aria-label="Predict YES"
					onclick={() => handleAction('YES')}
				>
					<svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M5 13l4 4L19 7"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3.5"
						/>
					</svg>
					<span class="flow-action-label">YES</span>
				</button>
			</div>

			<div class="flow-kbd">
				<kbd>←</kbd> NO
				<span>·</span>
				<kbd>↑</kbd> SKIP
				<span>·</span>
				<kbd>→</kbd> YES
			</div>
		</footer>
	{/if}
</div>

<svelte:window
	onkeydown={(e) => {
		if (loading || completed) {
			return;
		}

		if (e.key === 'ArrowRight') {
			void handleAction('YES');
		}

		if (e.key === 'ArrowLeft') {
			void handleAction('NO');
		}

		if (e.key === 'ArrowUp') {
			void handleAction('SKIP');
		}
	}}
/>

<style lang="postcss">
	.flow-shell {
		position: relative;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.flow-shell.is-active {
		position: fixed;
		inset: 0;
		z-index: 50;
		overflow: hidden;
	}

	.flow-topbar {
		position: sticky;
		top: 0;
		z-index: 60;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
		padding: calc(env(safe-area-inset-top, 0px) + 0.5rem) 0.75rem 0.5rem
			calc(env(safe-area-inset-left, 0px) + 0.75rem);
		padding-right: calc(env(safe-area-inset-right, 0px) + 0.75rem);
		background: linear-gradient(to bottom, rgba(14, 13, 11, 0.95), rgba(14, 13, 11, 0.75));
		backdrop-filter: saturate(180%) blur(12px);
		-webkit-backdrop-filter: saturate(180%) blur(12px);
	}

	.flow-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 999px;
		background: var(--ink-line);
		color: var(--parchment);
		transition:
			transform 0.15s ease,
			background-color 0.2s ease;
	}
	.flow-icon-btn:active {
		transform: scale(0.985);
		background: rgba(242, 236, 220, 0.15);
	}

	.flow-progress {
		display: flex;
		align-items: center;
		gap: 3px;
		min-width: 0;
	}
	.flow-progress-seg {
		flex: 1;
		height: 4px;
		border-radius: 999px;
		background: var(--ink-line);
		overflow: hidden;
	}
	.flow-progress-fill {
		height: 100%;
		width: var(--p);
		background: linear-gradient(90deg, var(--laurel-deep), var(--laurel));
		border-radius: inherit;
		transition: width 450ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.flow-progress-fill.is-current {
		animation: progressPulse 1.6s ease-in-out infinite;
	}
	@keyframes progressPulse {
		0%,
		100% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
	}

	.flow-stats {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.flow-stat {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 9px;
		border-radius: 999px;
		font-weight: 900;
		font-size: 12px;
		line-height: 1;
	}
	.flow-stat-streak {
		background: var(--bg-surface);
		color: var(--parchment-dim);
		transition:
			transform 0.2s ease,
			background-color 0.2s ease;
	}
	.flow-stat-streak.is-hot {
		background: linear-gradient(135deg, var(--laurel-deep), var(--laurel));
		color: var(--ink);
		box-shadow: 0 4px 12px var(--laurel-glow);
		animation: hotPulse 1.4s ease-in-out infinite;
	}
	@keyframes hotPulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.06);
		}
	}
	.flow-stat-xp {
		background: var(--bg-surface);
		display: inline-flex;
		gap: 5px;
		align-items: baseline;
		font-variant-numeric: tabular-nums;
	}

	.combo-banner {
		position: fixed;
		left: 50%;
		top: calc(env(safe-area-inset-top, 0px) + 3.5rem);
		transform: translateX(-50%);
		z-index: 65;
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		padding: 10px 16px;
		border-radius: 999px;
		background: linear-gradient(135deg, var(--laurel-deep), var(--laurel));
		color: var(--ink);
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 0.02em;
		box-shadow: 0 14px 40px rgba(226, 184, 66, 0.4);
		pointer-events: none;
	}
	.combo-banner-xp {
		padding: 3px 8px;
		border-radius: 999px;
		background: rgba(14, 13, 11, 0.2);
		font-size: 11px;
	}

	.flow-stage {
		position: relative;
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		min-height: 0;
	}

	.flow-card-wrap {
		position: relative;
		width: 100%;
		max-width: 26rem;
		height: 100%;
		max-height: 620px;
	}

	.flow-card-slot {
		position: absolute;
		inset: 0;
		transition:
			transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
			opacity 420ms ease;
	}
	.flow-card-slot.is-back {
		pointer-events: none;
		transform: translateY(calc(var(--depth) * 10px)) scale(calc(1 - var(--depth) * 0.04));
		opacity: calc(1 - var(--depth) * 0.35);
	}

	.xp-pops {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 55;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.xp-pop {
		position: absolute;
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 10px 16px;
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 22px;
		font-weight: 900;
		letter-spacing: -0.02em;
		background: var(--bg-popover);
		color: var(--laurel);
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
		animation: xpPop 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}
	.xp-pop-label {
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.7;
	}
	.xp-pop-yes {
		color: var(--yes);
		border: 2px solid var(--yes);
	}
	.xp-pop-no {
		color: var(--no);
		border: 2px solid var(--no);
	}
	@keyframes xpPop {
		0% {
			transform: translateY(0) scale(0.6);
			opacity: 0;
		}
		20% {
			transform: translateY(-10px) scale(1.1);
			opacity: 1;
		}
		100% {
			transform: translateY(-120px) scale(0.9);
			opacity: 0;
		}
	}

	.flow-bottombar {
		position: sticky;
		bottom: 0;
		z-index: 60;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem calc(env(safe-area-inset-bottom, 0px) + 0.75rem);
		background: linear-gradient(to top, rgba(14, 13, 11, 1) 50%, rgba(14, 13, 11, 0));
	}

	.flow-amount {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px;
		border-radius: 999px;
		background: var(--bg-surface);
		box-shadow: inset 0 0 0 1px var(--border-base);
	}
	.flow-amount-btn {
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		background: var(--bg-popover);
		color: var(--parchment);
		font-size: 18px;
		font-weight: 900;
		line-height: 1;
		transition: transform 0.12s ease;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
	}
	.flow-amount-btn:active {
		transform: scale(0.985);
	}
	.flow-amount-field {
		display: inline-flex;
		align-items: baseline;
		gap: 4px;
		padding: 0 10px;
		min-width: 5.5rem;
		justify-content: center;
	}
	.flow-amount-input {
		width: 3.5rem;
		background: transparent;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 15px;
		font-weight: 900;
		color: var(--parchment);
		outline: none;
		font-variant-numeric: tabular-nums;
		-moz-appearance: textfield;
	}
	.flow-amount-input::-webkit-outer-spin-button,
	.flow-amount-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.flow-amount-unit {
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.08em;
		color: var(--parchment-mute);
	}

	.flow-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
	}
	.flow-action {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0;
		border-radius: 999px;
		background: var(--bg-surface);
		transition:
			transform 0.12s ease,
			box-shadow 0.2s ease;
		position: relative;
	}
	.flow-action:active {
		transform: scale(0.985);
	}
	.flow-action-label {
		position: absolute;
		bottom: -1.25rem;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.18em;
		color: var(--parchment-mute);
	}

	.flow-action-no {
		width: 3.75rem;
		height: 3.75rem;
		border: 3px solid rgba(255, 107, 107, 0.25);
		color: var(--no);
		box-shadow: 0 10px 24px var(--no-wash);
	}
	.flow-action-skip {
		width: 3rem;
		height: 3rem;
		border: 3px solid var(--border-strong);
		color: var(--parchment-mute);
		box-shadow: 0 6px 14px rgba(0, 0, 0, 0.15);
	}
	.flow-action-yes {
		width: 3.75rem;
		height: 3.75rem;
		border: 3px solid rgba(79, 211, 161, 0.25);
		color: var(--yes);
		box-shadow: 0 10px 24px rgba(79, 211, 161, 0.15);
	}

	/* Desktop only keyboard hints */
	.flow-kbd {
		display: none;
		align-items: center;
		gap: 8px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.14em;
		color: var(--parchment-mute);
		text-transform: uppercase;
		margin-top: 0.25rem;
	}
	.flow-kbd kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 4px;
		border: 1.5px solid var(--border-strong);
		border-radius: 6px;
		background: var(--bg-surface);
		color: var(--parchment);
		font-family: inherit;
		font-size: 11px;
		line-height: 1;
	}

	@media (hover: hover) and (pointer: fine) {
		.flow-kbd {
			display: flex;
		}
	}

	.completion-bg {
		position: relative;
		background:
			radial-gradient(circle at 20% 10%, rgba(226, 184, 66, 0.08), transparent 40%),
			radial-gradient(circle at 80% 90%, rgba(79, 211, 161, 0.06), transparent 40%);
		overflow: hidden;
	}
	.confetti {
		position: absolute;
		top: -40px;
		left: calc((var(--i) * 4.16%));
		width: 8px;
		height: 14px;
		border-radius: 2px;
		background: hsl(var(--hue), 80%, 60%);
		animation: fall 3.2s linear var(--delay) forwards;
		opacity: 0.9;
	}
	@keyframes fall {
		0% {
			transform: translateY(-50px) rotate(0deg);
			opacity: 0;
		}
		10% {
			opacity: 1;
		}
		100% {
			transform: translateY(110vh) rotate(720deg);
			opacity: 0.3;
		}
	}
</style>
