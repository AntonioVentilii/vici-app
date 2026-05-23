<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount, onDestroy } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FlowBottomBar from '$lib/components/market/FlowBottomBar.svelte';
	import FlowCard from '$lib/components/market/FlowCard.svelte';
	import FlowComboBanner from '$lib/components/market/FlowComboBanner.svelte';
	import FlowEmptyDeck from '$lib/components/market/FlowEmptyDeck.svelte';
	import FlowEnd from '$lib/components/market/FlowEnd.svelte';
	import FlowStreakBreakBanner from '$lib/components/market/FlowStreakBreakBanner.svelte';
	import FlowTopBar from '$lib/components/market/FlowTopBar.svelte';
	import FlowXpPops from '$lib/components/market/FlowXpPops.svelte';
	import MotionBeat from '$lib/components/market/MotionBeat.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import {
		BASE_XP_PER_PREDICTION,
		isAccuracyUnlocked
	} from '$lib/constants/flow-rewards.constants';
	import { primaryMarketTag, type MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_STAKE_STEP_VXP } from '$lib/constants/vxp-trade.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { playgroundFlowTradeUnitLabel } from '$lib/derived/playground.derived';
	import { flowTradeService } from '$lib/services/flow.services';
	import { getMarketMetadata } from '$lib/services/market-metadata.services';
	import { getUserMarketSignals } from '$lib/services/market-signals.services';
	import { listMarketTagsBySeries } from '$lib/services/market-tags.services';
	import { getFlowQueue } from '$lib/services/market.services';
	import { getPositions } from '$lib/services/position.services';
	import { persistDailyStreak } from '$lib/services/profile.services';
	import { showCompanion } from '$lib/stores/companion.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { flowSessionMaxBets, preferencesStore } from '$lib/stores/preferences.store';
	import { userStore } from '$lib/stores/user.store';
	import type { XpPop, XpPopKind } from '$lib/types/flow';
	import type { CallSide, FlowAction, Market, MarketId } from '$lib/types/market';
	import type { MarketMetadata } from '$lib/types/market-metadata';
	import type { UserMarketSignals } from '$lib/types/market-signals';
	import type { Position } from '$lib/types/position';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
	import {
		FLOW_ART_CATEGORY_SET,
		resolveFlowArtCategory,
		type FlowArtCategory
	} from '$lib/utils/flow-art.utils';
	import { haptic } from '$lib/utils/haptics.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { recordMotionSwipe, type MotionBeatPayload } from '$lib/utils/motion-engine.utils';
	import {
		applyDailyStreakBump,
		FLAME_STAGE_LABEL_KEYS,
		stageForStreak,
		type FlameStage
	} from '$lib/utils/streak.utils';
	import {
		assertViciXpHumanPremiumAndPayout,
		resolveOutcomeExecutionPriceForSizing
	} from '$lib/utils/trade.utils';

	const MAX_MARKETS = 20;
	const maxBets = $derived(flowSessionMaxBets($preferencesStore));

	const resolveFlowCategory = ({
		categoryId,
		marketId
	}: {
		categoryId: string | undefined;
		marketId: string;
	}): FlowArtCategory => {
		if (categoryId && FLOW_ART_CATEGORY_SET.has(categoryId)) {
			return categoryId as FlowArtCategory;
		}

		return resolveFlowArtCategory({ categoryId, seed: marketId });
	};

	let markets = $state<Market[]>([]);
	let currentIndex = $state(0);
	let loading = $state(true);
	let tradeAmount = $state('1.0');
	let betsCount = $state(0);
	let completed = $state(false);
	let positions = $state<Position[]>([]);
	// `seriesId → MarketTag[]` lookup loaded once on mount; consumed by
	// the FlowCard render loop to drive the per-card generative artwork
	// (which uses the *primary* tag — see `primaryMarketTag`).
	let marketTagMap = $state<Record<string, string[]>>({});
	let marketMetadataMap = $state<Map<MarketId, MarketMetadata>>(new Map());
	let userSignals = $state<UserMarketSignals>({
		categoryAcc: {},
		priorCalls: {},
		followedLean: {}
	});

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
	let committedAction = $state<FlowAction | null>(null);
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
	let flowPaused = $state(false);
	let activeMotionBeat = $state<MotionBeatPayload | null>(null);
	const flameStage: FlameStage = $derived(stageForStreak(dailyStreak));
	const flameLabel = $derived(t({ locale: $localeStore, key: FLAME_STAGE_LABEL_KEYS[flameStage] }));

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
			const [queue, userPositions, tagMap] = await Promise.all([
				getFlowQueue($balanceDomain),
				nonNullish($userStore.user) ? getPositions($balanceDomain) : Promise.resolve([]),
				listMarketTagsBySeries().catch(() => ({}))
			]);

			markets = queue.slice(0, MAX_MARKETS);
			positions = userPositions;
			marketTagMap = tagMap;

			const metadataEntries: [MarketId, MarketMetadata][] = [];

			await Promise.all(
				markets.map(async (m) => {
					const doc = await getMarketMetadata(m.id).catch(() => undefined);

					if (doc) {
						metadataEntries.push([m.id, doc]);
					}
				})
			);
			marketMetadataMap = new Map(metadataEntries);

			if (nonNullish($userStore.user)) {
				userSignals = await getUserMarketSignals($balanceDomain).catch(() => ({
					categoryAcc: {},
					priorCalls: {},
					followedLean: {}
				}));
			}

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
		} catch (e: unknown) {
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
		side: CallSide;
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

	const finishCommitAdvance = () => {
		setTimeout(() => {
			advance();
		}, COMMIT_FEEDBACK_MS);
		setTimeout(() => {
			committedAction = null;
			committedMarketId = null;
		}, COMMIT_RESET_MS);
	};

	const onMotionBeatDone = () => {
		const wasPaused = flowPaused;
		activeMotionBeat = null;
		flowPaused = false;

		if (wasPaused) {
			finishCommitAdvance();
		}
	};

	const handleAction = (action: FlowAction) => {
		if (completed || flowPaused) {
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

		// Daily-streak bump — fires once per session on the first
		// committed swipe. Any of YES / NO / SKIP qualifies (streak
		// progresses on any swipe).
		if (!hasMarkedActiveThisSession) {
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
			}
		}

		if (action === 'SKIP') {
			// Skip is a no-op for the session combo: it doesn't bump
			// (skip isn't a call) and doesn't reset (skip is neutral —
			// it's not a win and not a loss). The daily streak still
			// bumps via `applyDailyStreakBump` above; streak progresses
			// on any swipe, YES / NO / SKIP all count at that layer.
			recordMotionSwipe({ side: 'SKIP', dailyStreak });
			finishCommitAdvance();

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
			} catch (e: unknown) {
				notificationsStore.add({
					title: t({ locale: $localeStore, key: 'flow.notification.trade_failed_title' }),
					message: t({
						locale: $localeStore,
						key: 'flow.notification.trade_failed_message',
						params: {
							title: currentMarket.title.slice(0, 30),
							error: (e as Error).message
						}
					}),
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

		const yesProb = currentMarket.yesProbability ?? 0.5;
		const isContrarian = yesProb <= 0.25 || yesProb >= 0.75;
		const alignedWithCrowd =
			(action === 'YES' && yesProb >= 0.5) || (action === 'NO' && yesProb < 0.5);

		const motion = recordMotionSwipe({
			side: action,
			isContrarian,
			correct: alignedWithCrowd,
			dailyStreak
		});

		if (motion.bonusXp > 0) {
			xp += motion.bonusXp;
			let popCopy: string | undefined;

			if (motion.beat?.copyKey != null) {
				const params: Record<string, string | number> = { ...(motion.beat.copyParams ?? {}) };

				if (
					motion.beat.copyKey === 'motion.streak_tier_up' &&
					motion.beat.flameStage !== undefined
				) {
					params.stage = t({
						locale: $localeStore,
						key: FLAME_STAGE_LABEL_KEYS[motion.beat.flameStage]
					});
				}

				popCopy = t({ locale: $localeStore, key: motion.beat.copyKey, params });
			}

			spawnXpPop({
				amount: motion.bonusXp,
				combo: 1,
				side: action,
				kind: 'bonus',
				copy: popCopy
			});
			vibrate(motion.beat?.kind === 'milestone-1' ? 'triple-tap' : 'double-pulse');
		}

		if (motion.beat?.hardPause) {
			activeMotionBeat = motion.beat;
			flowPaused = true;
			vibrate('double-pulse');

			return;
		}

		if (motion.beat) {
			activeMotionBeat = motion.beat;
		}

		finishCommitAdvance();
	};

	const advance = () => {
		if (currentIndex < markets.length - 1 && betsCount < maxBets) {
			currentIndex += 1;
		} else {
			completed = true;
			vibrate('celebration');
		}
	};

	const backToMarkets = () => {
		goto(resolve(AppPath.Home));
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
			line: t({
				locale: $localeStore,
				key: 'flow.companion.trickster',
				params: { pct: minorityPct }
			}),
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
	class:is-paused={flowPaused}
>
	{#if loading}
		<div class="flex h-full w-full flex-col items-center justify-center gap-4" in:fade>
			<LoadingSpinner />
			<p class="text-muted-foreground font-medium">
				{t({ locale: $localeStore, key: 'flow.preparing' })}
			</p>
		</div>
	{:else if markets.length === 0}
		<FlowEmptyDeck onBackToMarkets={backToMarkets} />
	{:else if completed}
		<FlowEnd
			{accuracyUnlocked}
			{betsCount}
			{dailyStreak}
			{flameLabel}
			{flameStage}
			{lifetimeAccuracy}
			{lifetimeTotalTrades}
			onBackToMarkets={backToMarkets}
			{xp}
		/>
	{:else}
		<FlowTopBar
			{betsCount}
			{dailyStreak}
			{flameLabel}
			{flameStage}
			{maxBets}
			onExit={backToMarkets}
			{xp}
		/>

		{#if lastStreakShown > 0}
			{#key lastStreakShown}
				<FlowComboBanner count={lastStreakShown} />
			{/key}
		{/if}

		{#if streakBreakBanner}
			<FlowStreakBreakBanner stage={streakBreakBanner.stage} />
		{/if}

		<main class="flow-stage">
			<div class="flow-card-wrap">
				{#each visibleCards as market, i (market?.id)}
					{@const isCurrent = i === 0}
					{@const primaryTag = primaryMarketTag(
						(marketTagMap[market.id] ?? []) as ReadonlyArray<MarketTag>
					)}
					{@const flowCategory = resolveFlowCategory({
						categoryId: primaryTag,
						marketId: market.id
					})}
					{@const metadata = marketMetadataMap.get(market.id)}
					{@const priorCall = userSignals.priorCalls[market.id]}
					{@const followedLean = userSignals.followedLean[market.id]}
					{@const categoryAcc = userSignals.categoryAcc[flowCategory]}
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
							category={flowCategory}
							{categoryAcc}
							committedAction={market.id === committedMarketId ? committedAction : null}
							{followedLean}
							interactive={isCurrent && !flowPaused}
							isLimitOrderNo={isNullish(market.bestBid)}
							isLimitOrderYes={isNullish(market.bestAsk)}
							{market}
							{metadata}
							onAction={handleAction}
							position={positions.find((p) => p.marketId === market.id)}
							{priorCall}
							signedIn={nonNullish($userStore.user)}
							{tradeAmount}
						/>
					</div>
				{/each}
			</div>

			<FlowXpPops pops={xpPops} />

			{#if activeMotionBeat}
				<MotionBeat
					beat={activeMotionBeat}
					bonusXp={activeMotionBeat.bonusXp}
					onDone={onMotionBeatDone}
				/>
			{/if}
		</main>

		<FlowBottomBar
			min={isViciXp($balanceDomain) ? VXP_STAKE_STEP_VXP : 0.1}
			onAction={handleAction}
			onIncrement={incrementAmount}
			step={isViciXp($balanceDomain) ? VXP_STAKE_STEP_VXP : 0.1}
			unitLabel={$playgroundFlowTradeUnitLabel}
			bind:tradeAmount
		/>
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
		background:
			radial-gradient(circle at 50% -10%, var(--laurel-glow), transparent 34%), var(--bg-base);
	}

	.flow-shell.is-active {
		position: fixed;
		inset: 0;
		z-index: 50;
		overflow: hidden;
	}

	.flow-stage {
		position: relative;
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem 1rem 0.5rem;
		min-height: 0;
	}

	.flow-card-wrap {
		position: relative;
		width: 100%;
		max-width: min(25.5rem, calc(100vw - 2rem));
		height: 100%;
		max-height: min(
			650px,
			calc(100dvh - 13.75rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))
		);
		min-height: min(34rem, calc(100dvh - 14.75rem));
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
		transform: translateY(calc(var(--depth) * 9px)) scale(calc(1 - var(--depth) * 0.035));
		opacity: calc(1 - var(--depth) * 0.28);
		filter: saturate(calc(1 - var(--depth) * 0.12));
	}

	@media (min-width: 640px) {
		.flow-card-wrap {
			max-height: 660px;
			min-height: 36rem;
		}
	}

	:global([data-theme='light']) .flow-card-slot.is-back,
	:global([data-theme='peach']) .flow-card-slot.is-back {
		opacity: calc(1 - var(--depth) * 0.22);
		filter: saturate(calc(1 - var(--depth) * 0.08)) drop-shadow(0 18px 32px rgba(14, 13, 11, 0.08));
	}
</style>
