<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount, onDestroy } from 'svelte';
	import { cubicOut, backOut } from 'svelte/easing';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import ViciChar from '$lib/components/characters/ViciChar.svelte';
	import FlowCard from '$lib/components/market/FlowCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import {
		BASE_XP_PER_PREDICTION,
		findFlowMilestone,
		isAccuracyUnlocked
	} from '$lib/constants/flow-rewards.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_STAKE_STEP_VXP } from '$lib/constants/vxp-trade.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { playgroundFlowTradeUnitLabel } from '$lib/derived/playground.derived';
	import { listSeriesCategories } from '$lib/services/category.services';
	import { flowTradeService } from '$lib/services/flow.services';
	import { getFlowQueue } from '$lib/services/market.services';
	import { getPositions } from '$lib/services/position.services';
	import { persistDailyStreak } from '$lib/services/profile.services';
	import { showCompanion } from '$lib/stores/companion.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
	import { pickHighestPriorityBeat, type CompanionBeat } from '$lib/utils/flow-companion.utils';
	import { haptic } from '$lib/utils/haptics.utils';
	import {
		applyDailyStreakBump,
		FLAME_STAGE_LABELS,
		stageForStreak,
		type FlameStage
	} from '$lib/utils/streak.utils';
	import {
		assertViciXpHumanPremiumAndPayout,
		resolveOutcomeExecutionPriceForSizing
	} from '$lib/utils/trade.utils';

	const MAX_BETS = 10;
	const MAX_MARKETS = 20;

	let markets = $state<Market[]>([]);
	let currentIndex = $state(0);
	let loading = $state(true);
	let tradeAmount = $state('1.0');
	let betsCount = $state(0);
	let completed = $state(false);
	let positions = $state<Position[]>([]);
	// `seriesId → categoryId` lookup loaded once on mount; consumed by
	// the FlowCard render loop to drive the per-card generative artwork.
	let marketCategoryMap = $state<Map<string, string>>(new Map());

	let exitX = $state(0);
	let exitY = $state(0);

	// Commit-feedback beat: the outgoing card holds for 80 ms with edge
	// tint locked at full intensity before it flies off-screen. 80 ms
	// is the upper bound of the reactive-motion budget (80–150 ms); past
	// 200 ms the swipe rhythm breaks and the lag becomes the experience.
	//
	// Bound to the committed market's id so that once `advance()` shifts
	// the deck, the *next* card never inherits the committed state — the
	// outgoing card keeps it for the duration of its exit transition.
	let committedAction = $state<'YES' | 'NO' | 'SKIP' | null>(null);
	let committedMarketId = $state<string | null>(null);
	const COMMIT_FEEDBACK_MS = 80;
	const COMMIT_RESET_MS = 600;

	let streak = $state(0);
	let xp = $state(0);
	let lastStreakShown = $state(0);

	// Daily-streak engine — read from the persisted profile on entry,
	// bump locally on the first swipe of a new local day. The Flow top
	// bar shows the resulting Flame stage; on break we fire the low-thud
	// haptic and a single-line banner ("Blaze ended", etc.).
	// (Server-side persistence on session end is a separate follow-up.)
	let dailyStreak = $state(0);
	let lastActiveDay = $state<string | undefined>(undefined);
	let hasMarkedActiveThisSession = false;
	let streakBreakBanner = $state<{ stage: FlameStage } | null>(null);
	const flameStage: FlameStage = $derived(stageForStreak(dailyStreak));
	const flameLabel = $derived(FLAME_STAGE_LABELS[flameStage]);

	type XpPopKind = 'normal' | 'bonus';

	interface XpPop {
		id: number;
		amount: number;
		combo: number;
		side: 'YES' | 'NO';
		// 'bonus' = milestone reward (laurel, larger, paired copy).
		kind: XpPopKind;
		// Paired copy ("First call.", "Ten deep.") shown above the
		// number on bonus pops; undefined for normal pops.
		copy?: string;
	}

	let xpPops = $state<XpPop[]>([]);
	let popCounter = 0;

	const comboMultiplier = $derived(streak >= 5 ? 3 : streak >= 3 ? 2 : 1);

	// Local alias — every haptic in this file maps to a named pattern
	// from `haptics.utils.ts`. Naming kept minimal so existing call
	// sites read the same way.
	const vibrate = haptic;

	onMount(async () => {
		document.body.classList.add('overflow-hidden');

		flowTradeService.startSession();

		try {
			const [queue, userPositions, seriesCategories] = await Promise.all([
				getFlowQueue($balanceDomain),
				nonNullish($userStore.user) ? getPositions($balanceDomain) : Promise.resolve([]),
				listSeriesCategories()
			]);

			markets = queue.slice(0, MAX_MARKETS);
			positions = userPositions;
			marketCategoryMap = new Map(seriesCategories.map((m) => [m.seriesId, m.categoryId]));

			const { profile } = $userStore;

			if (nonNullish(profile)) {
				dailyStreak = profile.dailyStreak ?? 0;
				({ lastActiveDay } = profile);
			}

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
		side,
		kind = 'normal',
		copy
	}: {
		amount: number;
		combo: number;
		side: 'YES' | 'NO';
		kind?: XpPopKind;
		copy?: string;
	}) => {
		const id = ++popCounter;
		xpPops = [...xpPops, { id, amount, combo, side, kind, copy }];

		// Bonus pops linger longer (paired copy needs to read).
		const ttl = kind === 'bonus' ? 1800 : 1100;
		setTimeout(() => {
			xpPops = xpPops.filter((p) => p.id !== id);
		}, ttl);
	};

	const handleAction = (action: 'YES' | 'NO' | 'SKIP') => {
		if (completed) {
			return;
		}

		// Ignore double-commits during the 80 ms feedback window.
		if (nonNullish(committedMarketId)) {
			return;
		}

		const currentMarket = markets[currentIndex];

		if (!currentMarket) {
			return;
		}

		if (action === 'YES') {
			exitX = 500;
			exitY = 20;
			vibrate('firm-tap');
		} else if (action === 'NO') {
			exitX = -500;
			exitY = 20;
			vibrate('firm-tap');
		} else if (action === 'SKIP') {
			exitX = 0;
			exitY = -500;
			// Skip is a negative-state — softer beat than YES / NO so the
			// rhythm reads "passed" not "committed".
			vibrate('soft-tick');
		}

		// Lock the outgoing card into its commit-feedback beat. Drag is
		// disabled in FlowCard for the matching market.id; the matching
		// edge tint and directional label go to full opacity.
		committedAction = action;
		committedMarketId = currentMarket.id;

		// Collect candidate companion beats; the priority resolver picks
		// one at the end of this handler so a single swipe never stacks
		// character bubbles (characters are scarce — they appear at
		// milestones, not as ambient garnish).
		const beats: CompanionBeat[] = [];

		// Daily-streak bump — fires once per session on the first
		// committed swipe. Any of YES / NO / SKIP qualifies (streak
		// progresses on any swipe).
		if (!hasMarkedActiveThisSession) {
			const previousDailyStreak = dailyStreak;
			const bump = applyDailyStreakBump({ streak: dailyStreak, lastActiveDay });
			({ streak: dailyStreak, lastActiveDay } = bump);
			hasMarkedActiveThisSession = true;

			// Persist server-side once per session — survives refresh.
			// Best-effort; on failure, the local values still drive the
			// rest of the session and the next session re-runs the bump.
			if (bump.bumped) {
				const principal = $userStore.user?.key;
				const persistedDay = lastActiveDay;
				const persistedStreak = dailyStreak;

				if (nonNullish(principal) && nonNullish(persistedDay)) {
					void persistDailyStreak({
						principal,
						dailyStreak: persistedStreak,
						lastActiveDay: persistedDay
					})
						.then((data) => {
							userStore.update((s) => ({ ...s, profile: data }));
						})
						.catch((e: unknown) => {
							console.warn('Daily-streak persistence failed (non-fatal):', e);
						});
				}
			}

			if (bump.transition === 'break') {
				const previousStage = stageForStreak(Math.max(1, $userStore.profile?.dailyStreak ?? 0));
				streakBreakBanner = { stage: previousStage };
				vibrate('low-thud');
				setTimeout(() => {
					streakBreakBanner = null;
				}, 2200);
			} else if (bump.bumped) {
				const previousStage = stageForStreak(previousDailyStreak);
				const newStage = stageForStreak(bump.streak);

				if (previousStage !== newStage) {
					beats.push({
						kind: 'streak-tier',
						who: 'flame',
						line: `${FLAME_STAGE_LABELS[newStage]}. ${bump.streak} days.`,
						stage: newStage
					});
				}
			}
		}

		if (action === 'SKIP') {
			// Skip is a no-op for the session combo: it doesn't bump
			// (skip isn't a call) and doesn't reset (skip is neutral —
			// it's not a win and not a loss). The daily streak still
			// bumps via `applyDailyStreakBump` above; streak progresses
			// on any swipe, YES / NO / SKIP all count at that layer.
			setTimeout(() => {
				advance();
			}, COMMIT_FEEDBACK_MS);
			setTimeout(() => {
				committedAction = null;
				committedMarketId = null;
			}, COMMIT_RESET_MS);

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

		const awarded = BASE_XP_PER_PREDICTION * comboMultiplier;
		xp += awarded;
		spawnXpPop({ amount: awarded, combo: comboMultiplier, side: action });

		if (streak === 3 || streak === 5 || streak === 10) {
			const shown = streak;
			lastStreakShown = shown;
			vibrate('triple-tap');
			setTimeout(() => {
				if (lastStreakShown === shown) {
					lastStreakShown = 0;
				}
			}, 1600);
		}

		// Rarity-scaled bonus ladder — fires on the exact lifetime
		// committed-call count (1, 10, 50, 250, 1000). Counts across
		// all sessions, not just this one: at `MAX_BETS = 10` per
		// session the 50 / 250 / 1000 tiers would otherwise be
		// unreachable. `betsCount` is the in-session delta;
		// `profile.totalTrades` is the satellite-persisted lifetime
		// total before this session.
		const lifetimeCallCount = ($userStore.profile?.totalTrades ?? 0) + betsCount;
		const milestone = findFlowMilestone(lifetimeCallCount);

		if (nonNullish(milestone)) {
			xp += milestone.bonusXp;
			spawnXpPop({
				amount: milestone.bonusXp,
				combo: 1,
				side: action,
				kind: 'bonus',
				copy: milestone.copy
			});
			// First-call gets the strongest haptic — triple tap. Other
			// milestones use a double pulse so they don't shout louder
			// than streak tier-ups.
			vibrate(milestone.id === 'first-call' ? 'triple-tap' : 'double-pulse');

			if (milestone.id === 'first-call') {
				beats.push({
					kind: 'first-time',
					who: 'vici',
					line: 'Veni. Tap for depth, swipe to call it.',
					dwell_ms: 3600
				});
			} else {
				beats.push({
					kind: 'swipe-count',
					who: 'vici',
					line: `${milestone.copy} +${milestone.bonusXp} XP.`
				});
			}
		}

		// Resolve the highest-priority companion beat for this commit.
		// Lower-priority beats are dropped, not queued — by the next
		// swipe they're stale.
		const winningBeat = pickHighestPriorityBeat(beats);

		if (nonNullish(winningBeat)) {
			showCompanion({
				who: winningBeat.who,
				line: winningBeat.line,
				stage: winningBeat.stage,
				dwell_ms: winningBeat.dwell_ms ?? 3200,
				anchor: 'br'
			});
		}

		// Advance after the 80 ms feedback beat — Svelte's `out:fly` on
		// the keyed card then plays as it unmounts.
		setTimeout(() => {
			advance();
		}, COMMIT_FEEDBACK_MS);
		setTimeout(() => {
			committedAction = null;
			committedMarketId = null;
		}, COMMIT_RESET_MS);
	};

	const advance = () => {
		if (currentIndex < markets.length - 1 && betsCount < MAX_BETS) {
			currentIndex += 1;
		} else {
			completed = true;
			vibrate('celebration');
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

	// Trickster appears on the active card when the YES probability is
	// strongly skewed (≤ 25 % or ≥ 75 %) — i.e. when committing on this
	// card would put the user in the minority on a contrarian call.
	// Trickster owns this surface alone (defended territory) — no other
	// per-card ambient beat pre-empts it.
	const trickstered = new SvelteSet<string>();

	$effect(() => {
		const m = markets[currentIndex];

		if (isNullish(m) || trickstered.has(m.id)) {
			return;
		}

		const yes = m.yesProbability ?? 0.5;
		const consensusSide = yes >= 0.75 ? 'YES' : yes <= 0.25 ? 'NO' : null;

		if (consensusSide === null) {
			return;
		}

		const minorityPct = Math.round(Math.min(yes, 1 - yes) * 100);
		showCompanion({
			who: 'trickster',
			line: `Only ${minorityPct}% disagree. Bold.`,
			anchor: 'br',
			dwell_ms: 2800,
			lightning: true
		});
		trickstered.add(m.id);
	});

	// Accuracy is gated until the user has enough lifetime calls for
	// the percentage to mean anything. Below the gate the FlowEnd
	// summary surfaces the lifetime call count instead — calls + streak
	// are the publicly visible stats.
	const lifetimeTotalTrades = $derived($userStore.profile?.totalTrades ?? 0);
	const lifetimeAccuracy = $derived($userStore.profile?.accuracy ?? 0);
	const accuracyUnlocked = $derived(isAccuracyUnlocked(lifetimeTotalTrades));
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
	{:else if markets.length === 0}
		<!-- Empty-deck state. VICI in `thinking` mood holds the canvas,
		     single-line copy, no escalation, no celebration. -->
		<div class="empty-deck flex h-full w-full flex-col items-center justify-center px-6">
			<div class="relative z-10 max-w-md text-center" in:fly={{ y: 20, duration: 500 }}>
				<div class="empty-deck-char">
					<ViciChar mood="thinking" size={96} />
				</div>
				<h2 class="empty-deck-title">Nothing here. Yet.</h2>
				<p class="empty-deck-sub">VICI is queueing more markets.</p>
				<Button onclick={backToMarkets}>Back to Markets</Button>
			</div>
		</div>
	{:else if completed}
		<!-- FlowEnd — brand voice ("Vici." serif-italic display, terse
		     copy). No confetti / no green-check celebration; the
		     accomplishment is the laurel + the numbers, not noise. -->
		<div class="flow-end">
			<div class="flow-end-inner" in:fly={{ y: 20, duration: 500 }}>
				<h2 class="flow-end-title display">Vici.</h2>
				<p class="flow-end-sub">
					{#if betsCount === 0}
						No calls. Nothing locked in.
					{:else if betsCount === 1}
						One call. Locked in.
					{:else}
						{betsCount} calls. Locked in.
					{/if}
				</p>

				<div class="flow-end-grid">
					<div class="flow-end-cell">
						<div class="allcaps flow-end-cell-label">Session XP</div>
						<div class="num flow-end-cell-value">+{xp}</div>
					</div>
					<div class="flow-end-cell flow-end-cell-streak" class:is-hot={dailyStreak >= 7}>
						<div class="flow-end-cell-flame">
							<FlameChar animate={dailyStreak >= 1} size={28} stage={flameStage} />
						</div>
						<div class="allcaps flow-end-cell-label">{flameLabel}</div>
						<div class="num flow-end-cell-value">{dailyStreak}d</div>
					</div>
					<div class="flow-end-cell">
						{#if accuracyUnlocked}
							<div class="allcaps flow-end-cell-label">Accuracy</div>
							<div class="num flow-end-cell-value">{Math.round(lifetimeAccuracy)}%</div>
						{:else}
							<div class="allcaps flow-end-cell-label">Calls</div>
							<div class="num flow-end-cell-value">{lifetimeTotalTrades + betsCount}</div>
							<div class="flow-end-cell-foot">until accuracy</div>
						{/if}
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
				<div
					class="flow-stat flow-stat-flame"
					class:is-hot={dailyStreak >= 7}
					aria-label="Daily streak"
				>
					<FlameChar animate={dailyStreak >= 1} size={20} stage={flameStage} />
					<span class="flow-flame-meta">
						<span class="flow-flame-label">{flameLabel}</span>
						<span class="num flow-flame-count">{dailyStreak}d</span>
					</span>
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

		{#if streakBreakBanner}
			<!-- Streak-break choreography: single low thud (haptic fires in
			     handleAction), banner names the stage that ended, fresh start
			     at SPARK. No rescues, no second chances. -->
			<div class="streak-break" in:fly={{ y: -8, duration: 300, easing: backOut }} out:fade>
				<span class="serif-italic">{FLAME_STAGE_LABELS[streakBreakBanner.stage]} ended.</span>
				<span class="streak-break-sub">Fresh start.</span>
			</div>
		{/if}

		<main class="flow-stage">
			<div class="flow-card-wrap">
				{#each visibleCards as market, i (market?.id)}
					{@const isCurrent = i === 0}
					{@const category = marketCategoryMap.get(market.id)}
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
							{category}
							committedAction={market.id === committedMarketId ? committedAction : null}
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
						class:xp-pop-bonus={pop.kind === 'bonus'}
						class:xp-pop-no={pop.kind === 'normal' && pop.side === 'NO'}
						class:xp-pop-yes={pop.kind === 'normal' && pop.side === 'YES'}
					>
						{#if pop.kind === 'bonus' && pop.copy}
							<span class="xp-pop-copy serif-italic">{pop.copy}</span>
						{/if}
						<span class="xp-pop-amount num">+{pop.amount}</span>
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
	/* Daily-streak Flame chip: shows the current stage + day count.
	   Flame appears in the Flow header + home screen only (never on
	   every screen); always-visible here, never dominant. Activates
	   `is-hot` from FLAME stage upward. */
	.flow-stat-flame {
		gap: 6px;
		padding: 4px 9px 4px 6px;
		background: var(--bg-surface);
		color: var(--parchment-dim);
		transition:
			transform var(--d-state) var(--ease-vici),
			background-color var(--d-state) var(--ease-vici);
	}
	.flow-stat-flame.is-hot {
		background: linear-gradient(135deg, var(--laurel-deep), var(--laurel));
		color: var(--ink);
		box-shadow: 0 4px 12px var(--laurel-glow);
	}
	.flow-flame-meta {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1;
	}
	.flow-flame-label {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		opacity: 0.85;
	}
	.flow-flame-count {
		font-size: 11px;
		font-weight: 600;
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

	/* Empty-deck negative state. VICI in `thinking` mood owns the
	   canvas; copy is single-line; no celebration; no escalation. */
	.empty-deck {
		position: relative;
		background: var(--bg-base);
	}
	.empty-deck-char {
		margin-bottom: 1.5rem;
		display: flex;
		justify-content: center;
	}
	.empty-deck-title {
		font-family: var(--font-display);
		font-size: var(--t-32);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--parchment);
		margin: 0 0 0.5rem;
	}
	.empty-deck-sub {
		font-size: var(--t-14);
		color: var(--text-muted);
		margin: 0 0 1.5rem;
	}

	/* Streak-break banner — shows once when the previous-day gap broke
	   the streak. Mute palette (parchment-mute, no laurel celebration);
	   spec is explicit that the break is honest, not consoling. */
	.streak-break {
		position: fixed;
		left: 50%;
		top: calc(env(safe-area-inset-top, 0px) + 3.5rem);
		transform: translateX(-50%);
		z-index: 65;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 8px 16px;
		border-radius: var(--r-pill);
		background: rgba(14, 13, 11, 0.92);
		border: 1px solid var(--ink-line-strong);
		color: var(--parchment-mute);
		font-size: 13px;
		box-shadow: var(--shadow-toast);
	}
	.streak-break-sub {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--parchment-faint);
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
	/* Bonus pop — milestone reward (rarity ladder). Laurel ring, larger
	   amount, paired serif-italic copy on top, longer dwell. */
	.xp-pop-bonus {
		flex-direction: column;
		gap: 4px;
		padding: 14px 22px;
		font-size: 30px;
		color: var(--laurel);
		border: 2px solid var(--laurel);
		background: rgba(14, 13, 11, 0.92);
		box-shadow:
			0 0 32px var(--laurel-glow),
			var(--inset-hi);
		animation:
			xpPopBonus 1.8s var(--ease-vici) forwards,
			none;
	}
	.xp-pop-copy {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		font-weight: 400;
		color: var(--parchment-dim);
		letter-spacing: 0;
		text-transform: none;
		line-height: 1.1;
	}
	.xp-pop-amount {
		font-weight: 600;
	}
	@keyframes xpPopBonus {
		0% {
			transform: translateY(0) scale(0.7);
			opacity: 0;
		}
		15% {
			transform: translateY(-12px) scale(1.08);
			opacity: 1;
		}
		70% {
			transform: translateY(-90px) scale(1);
			opacity: 1;
		}
		100% {
			transform: translateY(-150px) scale(0.95);
			opacity: 0;
		}
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
		background: linear-gradient(135deg, var(--laurel-deep), var(--laurel));
		color: var(--ink);
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
		color: var(--ink);
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
		color: var(--ink);
	}
	.flow-end-cell-foot {
		font-size: 9px;
		color: var(--parchment-faint);
		font-family: var(--font-display);
		text-transform: uppercase;
		letter-spacing: var(--tracking-allcaps);
	}
</style>
