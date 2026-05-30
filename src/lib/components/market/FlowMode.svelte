<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount, onDestroy, untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FlowBottomBar from '$lib/components/market/FlowBottomBar.svelte';
	import FlowCard from '$lib/components/market/FlowCard.svelte';
	import FlowComboBanner from '$lib/components/market/FlowComboBanner.svelte';
	import FlowDeckSkeleton from '$lib/components/market/FlowDeckSkeleton.svelte';
	import FlowEmptyDeck from '$lib/components/market/FlowEmptyDeck.svelte';
	import FlowEnd from '$lib/components/market/FlowEnd.svelte';
	import FlowFeedback from '$lib/components/market/FlowFeedback.svelte';
	import FlowStreakBreakBanner from '$lib/components/market/FlowStreakBreakBanner.svelte';
	import FlowTopBar from '$lib/components/market/FlowTopBar.svelte';
	import FlowXpPops from '$lib/components/market/FlowXpPops.svelte';
	import MotionBeat from '$lib/components/market/MotionBeat.svelte';
	import SwipeHint from '$lib/components/market/SwipeHint.svelte';
	import FlowCoach from '$lib/components/onboarding/FlowCoach.svelte';
	import {
		BASE_XP_PER_PREDICTION,
		isAccuracyUnlocked
	} from '$lib/constants/flow-rewards.constants';
	import { primaryMarketTag, type MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import {
		isStakeLadderUnlocked,
		isVxpLadderStake,
		VXP_DEFAULT_STAKE,
		VXP_MIN_STAKE
	} from '$lib/constants/vxp-economy.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { featuredEvent, featuredEventActive } from '$lib/derived/featured-event.derived';
	import { playgroundFlowTradeUnitLabel } from '$lib/derived/playground.derived';
	import { prepareFlow, type PreparedFlow } from '$lib/services/flow-prep.services';
	import { flowTradeService } from '$lib/services/flow.services';
	import { persistDailyStreak } from '$lib/services/profile.services';
	import { showCompanion } from '$lib/stores/companion.store';
	import { advanceFlow, peekFlow } from '$lib/stores/flow.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { flowSessionMaxBets, preferencesStore } from '$lib/stores/preferences.store';
	import { userStore } from '$lib/stores/user.store';
	import type { XpPop, XpPopKind } from '$lib/types/flow';
	import type { CallSide, FlowAction, Market, MarketId } from '$lib/types/market';
	import type { MarketMetadata } from '$lib/types/market-metadata';
	import type { UserMarketSignals } from '$lib/types/market-signals';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
	import {
		FLOW_ART_CATEGORY_SET,
		resolveFlowArtCategory,
		type FlowArtCategory
	} from '$lib/utils/flow-art.utils';
	import { haptic, hapticForBeat } from '$lib/utils/haptics.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { recordMotionSwipe, type MotionBeatPayload } from '$lib/utils/motion-engine.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';
	import {
		applyDailyStreakBump,
		FLAME_STAGE_LABEL_KEYS,
		stageForStreak,
		type FlameStage
	} from '$lib/utils/streak.utils';
	import { assertViciXpHumanPremium } from '$lib/utils/trade.utils';

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
	// Session-summary metrics. `sessionStartMs` is stamped at mount
	// AND on every "Predict 10 more" continuation — `const` here would
	// leak the time the user spent reading the previous FlowEnd into
	// the next session's duration label. `correctCallsThisSession`
	// increments each time `alignedWithCrowd` is true on a committed
	// YES / NO swipe. Together they drive the `You called N markets
	// in 1m 18s.` line and the SESSION ACC. stat on FlowEnd.
	let sessionStartMs = $state(Date.now());
	let correctCallsThisSession = $state(0);
	// Per-category call counter for this session. Drives the
	// data-driven Oracle line on FlowEnd ("You were early on {category}")
	// by surfacing the category the user leaned hardest into. Keyed by
	// resolved `FlowArtCategory` so `wc` markets are counted under
	// `wc`, not the underlying tag.
	let sessionCategoryCalls = $state<Partial<Record<FlowArtCategory, number>>>({});
	// `nowMs` ticks once per second while the session is in flight so
	// the duration label updates live before the user finishes.
	let nowMs = $state(Date.now());
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

	// Ambient post-swipe Oracle pop — used for the non-hard-pause path
	// where the user gets a brief "Nice call · +N VXP" affirmation that
	// fades on its own ~1.3 s later. Skip commits get the shorter 520 ms
	// "SKIPPED" chip variant. Hard-pause beats (`motion.beat.hardPause`)
	// still go through `MotionBeat` so we don't double-stack overlays.
	interface ActiveFeedback {
		result: FlowAction;
		xp: number;
		correct: boolean;
		streakHit: boolean;
		// monotonic key so consecutive commits remount the component.
		key: number;
	}
	let activeFeedback = $state<ActiveFeedback | null>(null);
	let feedbackKeySeq = 0;
	const flameStage: FlameStage = $derived(stageForStreak(dailyStreak));

	let xpPops = $state<XpPop[]>([]);
	let popCounter = 0;

	const comboMultiplier = $derived(streak >= 5 ? 3 : streak >= 3 ? 2 : 1);

	// Local alias — every haptic in this file maps to a named pattern
	// from `haptics.utils.ts`. Naming kept minimal so existing call
	// sites read the same way.
	const vibrate = haptic;

	// Session duration ticker. 1 s cadence is plenty — the duration
	// label renders to seconds (`Xm Ys` / `Ys`) and the user never sees
	// sub-second precision. Stops when `completed` flips true so the
	// FlowEnd label freezes at the final value.
	$effect(() => {
		if (completed) {
			return;
		}

		const id = setInterval(() => {
			nowMs = Date.now();
		}, 1000);

		return () => clearInterval(id);
	});

	const sessionDurationLabel = $derived.by(() => {
		const secs = Math.max(0, Math.floor((nowMs - sessionStartMs) / 1000));
		const m = Math.floor(secs / 60);
		const s = secs % 60;

		return m > 0 ? `${m}m ${s}s` : `${s}s`;
	});

	const sessionAccuracy = $derived(betsCount > 0 ? correctCallsThisSession / betsCount : 0);

	// Top category by call count this session. Drives the FlowEnd
	// Oracle line ("You were early on {category}"). Ties resolve to
	// the first key the user committed in — `Object.entries` preserves
	// insertion order on the plain object we mutate via spread. Returns
	// undefined when the user hasn't placed any calls yet so FlowEnd
	// can fall back to the locale-default accent.
	const topSessionCategory = $derived.by<FlowArtCategory | undefined>(() => {
		let best: FlowArtCategory | undefined;
		let bestCount = 0;

		for (const [cat, count] of Object.entries(sessionCategoryCalls) as Array<
			[FlowArtCategory, number]
		>) {
			if (count > bestCount) {
				best = cat;
				bestCount = count;
			}
		}

		return best;
	});

	// Daily goal heuristic — until the satellite exposes a per-user
	// daily target, default to 10 predictions/day. Progress is capped
	// at 100 % so the bar / percent never overflows mid-session.
	const DAILY_GOAL_TARGET = 10;
	const dailyGoalDone = $derived(Math.min(betsCount, DAILY_GOAL_TARGET));
	const dailyGoalFraction = $derived(dailyGoalDone / DAILY_GOAL_TARGET);

	onMount(async () => {
		document.body.classList.add('overflow-hidden');

		flowTradeService.startSession();

		try {
			// Pre-warmed deck from `flow.store` — populated on app
			// init and refreshed in the background on input changes.
			// `peekFlow` validates the cached payload against the
			// session's current balance domain and featured-event
			// scope; a mismatch (a rebuild for the new inputs is
			// still in flight) or a cold start falls through to an
			// on-demand build so the user never sees markets from
			// the previous scope.
			const expectedTag = $featuredEventActive ? $featuredEvent.categoryTag : undefined;
			const cached = peekFlow({
				domain: $balanceDomain,
				featuredEventTag: expectedTag
			});
			const prepared: PreparedFlow = nonNullish(cached)
				? cached
				: await prepareFlow({
						domain: $balanceDomain,
						featuredEventTag: expectedTag,
						signedIn: nonNullish($userStore.user)
					});

			({
				markets,
				tagMap: marketTagMap,
				metadataById: marketMetadataMap,
				signals: userSignals
			} = prepared);

			const { profile } = $userStore;

			if (nonNullish(profile)) {
				dailyStreak = profile.dailyStreak ?? 0;
				({ lastActiveDay } = profile);
			}

			const fromProfile = $userStore.profile?.preferences?.defaultAmount?.flow;

			if (isViciXp($balanceDomain)) {
				// Restore the user's last Flow stake from their profile,
				// but reject it (and fall back to `VXP_MIN_STAKE`) if it
				// isn't a current ladder rung — the ladder may have been
				// reshuffled since the value was persisted.
				const candidate = Number(fromProfile);

				tradeAmount = isVxpLadderStake(candidate) ? String(candidate) : String(VXP_MIN_STAKE);
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

		// Promote the pre-built follow-up deck and rebuild a fresh
		// `next` excluding the markets just shown — re-entering /flow
		// opens on an unseen deck without a network round-trip.
		//
		// Only on a session that made progress. A no-op visit (open
		// /flow, swipe nothing, leave) must not advance: `advanceFlow`
		// promotes a `next` deck that excludes the entire current deck,
		// so burning it here would surface markets the user never saw —
		// or, on a small inventory, an empty follow-up deck — the next
		// time they enter Flow.
		if (betsCount > 0) {
			advanceFlow();
		}
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
			feedbackKeySeq += 1;
			activeFeedback = {
				result: 'SKIP',
				xp: 0,
				correct: false,
				streakHit: false,
				key: feedbackKeySeq
			};
			finishCommitAdvance();

			return;
		}

		const executeTrade = async () => {
			try {
				if (isViciXp(currentMarket.balanceDomain)) {
					assertViciXpHumanPremium({ amountStr: tradeAmount });
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

		// Tally this market under its resolved category so the FlowEnd
		// Oracle line can spotlight whichever category the user leaned
		// hardest into ("You were early on crypto", etc.).
		const cat = resolveFlowCategory({
			categoryId: primaryMarketTag(
				(marketTagMap[currentMarket.id] ?? []) as ReadonlyArray<MarketTag>
			),
			marketId: currentMarket.id
		});
		sessionCategoryCalls = {
			...sessionCategoryCalls,
			[cat]: (sessionCategoryCalls[cat] ?? 0) + 1
		};

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

		if (alignedWithCrowd) {
			correctCallsThisSession += 1;
		}

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
		}

		// Single beat-aware vibrate — fires once per beat, with the
		// envelope mapped from `beat.kind`. On milestone-1 the
		// `firm-tap` swipe-commit haptic has already fired upstream;
		// the milestone-1 envelope is itself a `triple-tap`, so the
		// commit + milestone firing back-to-back is intentional.
		const beatHaptic = hapticForBeat(motion.beat?.kind);

		if (beatHaptic) {
			vibrate(beatHaptic);
		}

		if (motion.beat?.hardPause) {
			activeMotionBeat = motion.beat;
			flowPaused = true;

			return;
		}

		if (motion.beat) {
			activeMotionBeat = motion.beat;
		}

		// Ambient post-swipe feedback — only spawned on the non-hard-pause
		// path so we don't double-stack overlays with `MotionBeat`. The
		// pop self-dismisses in 1.3 s (520 ms for skip, handled above).
		feedbackKeySeq += 1;
		activeFeedback = {
			result: action,
			xp: awarded + motion.bonusXp,
			correct: alignedWithCrowd,
			streakHit: motion.bonusXp > 0 && motion.beat?.kind === 'streak-tier-up',
			key: feedbackKeySeq
		};

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

	// "Predict 10 more" CTA on FlowEnd — rebuilds a fresh deck and
	// zeroes the in-session counters. The lifetime / motion-engine
	// state stays untouched (it tracks across sessions). XP earned in
	// the prior session has already been credited via the trade flow,
	// so we don't re-award it.
	const handleContinueSession = async () => {
		const expectedTag = $featuredEventActive ? $featuredEvent.categoryTag : undefined;
		const excluded = markets.slice(0, currentIndex + 1).map((m) => m.id);

		completed = false;
		loading = true;

		try {
			const prepared = await prepareFlow({
				domain: $balanceDomain,
				featuredEventTag: expectedTag,
				signedIn: nonNullish($userStore.user),
				exclude: excluded
			});

			({
				markets,
				tagMap: marketTagMap,
				metadataById: marketMetadataMap,
				signals: userSignals
			} = prepared);
			currentIndex = 0;
			betsCount = 0;
			correctCallsThisSession = 0;
			sessionCategoryCalls = {};
			xp = 0;
			streak = 0;
			lastStreakShown = 0;
			// Reset BOTH the start and the now-tick — otherwise the next
			// FlowEnd's duration_line measures from the original mount,
			// including the time spent reading the previous FlowEnd.
			sessionStartMs = Date.now();
			nowMs = sessionStartMs;
		} catch (e: unknown) {
			console.error('Failed to refresh Flow deck', e);
		} finally {
			loading = false;
		}
	};

	const handleSeePortfolio = () => {
		goto(resolve(AppPath.Portfolio));
	};

	// The back-face peg-rail owns stake selection on the VXP balance
	// domain. The playground domains (USD / ICP) use fractional amounts
	// that the peg-rail doesn't cover, so we keep a small bottom-bar
	// stepper for those — see `playgroundOnly` gate around `FlowBottomBar`
	// in the template.
	const playgroundOnly = $derived(!isViciXp($balanceDomain));

	const incrementAmount = (direction: 1 | -1) => {
		const step = 0.1;
		const min = 0.1;
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

	// Enforce the default rung while the stake ladder is locked. Below the
	// unlock threshold the slider is hidden (FlowCardBack), so a previously
	// persisted non-default VXP stake must not leak through to the
	// committed trade — pin `tradeAmount` to the default. Only the gating
	// inputs are tracked; the stake read/write is untracked so the effect
	// can't loop on its own write.
	$effect(() => {
		const locked = isViciXp($balanceDomain) && !isStakeLadderUnlocked(lifetimeTotalTrades);

		if (!locked) {
			return;
		}

		untrack(() => {
			const pinned = String(VXP_DEFAULT_STAKE);

			if (tradeAmount !== pinned) {
				tradeAmount = pinned;
			}
		});
	});

	// Top bar deck-scope label: when the featured event is active the
	// deck is filtered to it (e.g. "WORLD CUP"); otherwise fall back
	// to a neutral all-markets label. Prefers `shortTitle` over
	// `title` so the chip stays narrow (a full "2026 FIFA WORLD CUP"
	// crowds the streak chip out of the row). Uppercased to match
	// the chip's allcaps tracking.
	const topBarCategoryLabel = $derived.by(() => {
		if ($featuredEventActive) {
			const e = $featuredEvent;

			return (e.shortTitle ?? e.title).toUpperCase();
		}

		return t({ locale: $localeStore, key: 'flow.deck.all_markets' });
	});
</script>

<div
	class="flow-shell bg-background"
	class:is-active={!completed && markets.length > 0 && !loading}
	class:is-paused={flowPaused}
>
	{#if loading}
		<div class="flow-skeleton-shell" in:fade>
			<FlowDeckSkeleton />
		</div>
	{:else if markets.length === 0}
		<FlowEmptyDeck onBackToMarkets={backToMarkets} />
	{:else if completed}
		<FlowEnd
			{accuracyUnlocked}
			archetype={$userStore.profile?.archetype}
			{betsCount}
			{dailyGoalDone}
			{dailyGoalFraction}
			dailyGoalTarget={DAILY_GOAL_TARGET}
			{dailyStreak}
			{flameStage}
			{lifetimeAccuracy}
			{lifetimeTotalTrades}
			onBackToMarkets={backToMarkets}
			onContinueSession={handleContinueSession}
			onSeePortfolio={handleSeePortfolio}
			{sessionAccuracy}
			{sessionDurationLabel}
			{topSessionCategory}
			{xp}
		/>
	{:else}
		<!-- Persistent Flow header: VICI wordmark + deck-scope chip +
		     bolt streak chip on the left; bell on the right. Secondary
		     row carries `idx / total` and `+xp VXP this session` over a
		     thin progress bar. Tapping the wordmark exits Flow. -->
		<FlowTopBar
			{betsCount}
			categoryLabel={topBarCategoryLabel}
			{dailyStreak}
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
						in:fade={{ duration: prefersReducedMotion() ? 0 : 200, easing: cubicOut }}
						out:fly={prefersReducedMotion()
							? { duration: 0 }
							: { x: exitX, y: exitY, duration: 450, opacity: 0, easing: cubicOut }}
					>
						<FlowCard
							category={flowCategory}
							{categoryAcc}
							committedAction={market.id === committedMarketId ? committedAction : null}
							{followedLean}
							interactive={isCurrent && !flowPaused}
							lifetimeCalls={lifetimeTotalTrades}
							locked={isCurrent && flowPaused}
							{market}
							{metadata}
							onAction={handleAction}
							onStakeChange={(next) => {
								tradeAmount = next;
							}}
							{priorCall}
							signedIn={nonNullish($userStore.user)}
							{tradeAmount}
						/>
					</div>
				{/each}
			</div>

			<FlowXpPops pops={xpPops} />

			<!-- Gesture coach — first-run only. Cycles through NO / YES /
			     SKIP / TAP / IDLE phases while the cards drift in
			     sympathy via the `data-coach-phase` CSS in app.css.
			     Self-dismisses on any pointer-down; persists dismissal
			     in localStorage. -->
			<FlowCoach surface="flow" />

			{#if activeMotionBeat}
				<MotionBeat
					beat={activeMotionBeat}
					bonusXp={activeMotionBeat.bonusXp}
					onDone={onMotionBeatDone}
				/>
			{/if}

			{#if activeFeedback}
				{#key activeFeedback.key}
					<FlowFeedback
						correct={activeFeedback.correct}
						onDone={() => (activeFeedback = null)}
						result={activeFeedback.result}
						streakHit={activeFeedback.streakHit}
						xp={activeFeedback.xp}
					/>
				{/key}
			{/if}
		</main>

		<!-- Bottom-of-deck affordance rail — chevrons drift outward on a
		     1.7 s ping cycle while the TAP / SKIP labels call out the
		     non-swipe gestures. Pure visual sugar; gestures are wired in
		     FlowCard. -->
		<SwipeHint />

		{#if playgroundOnly}
			<!-- Playground (USD / ICP) stake stepper. VXP uses the
			     back-face peg-rail and renders no bottom bar. -->
			<FlowBottomBar
				min={0.1}
				onAction={handleAction}
				onIncrement={incrementAmount}
				step={0.1}
				unitLabel={$playgroundFlowTradeUnitLabel}
				bind:tradeAmount
			/>
		{/if}
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
		animation: flow-fade-in 220ms var(--ease-stage) both;
	}
	@media (prefers-reduced-motion: reduce) {
		.flow-shell {
			animation: none;
		}
	}

	.flow-shell.is-active {
		position: fixed;
		inset: 0;
		z-index: 50;
		overflow: hidden;
	}

	/* Cold-load wrapper: lets FlowDeckSkeleton fill the shell so its in-slot
	   card skeleton lands in the same box the real deck will occupy. */
	.flow-skeleton-shell {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
	}

	/* Card stack: relative flex:1 container with the card absolutely
	   positioned inside so it fills the stage flush against the topbar
	   (no vertical centering, no max-height cap). */
	.flow-stage {
		position: relative;
		flex: 1 1 auto;
		padding: 0.5rem 1rem 0.75rem;
		min-height: 0;
	}

	.flow-card-wrap {
		position: absolute;
		inset: 0.5rem 0.5rem var(--bn-clear) 0.5rem;
		max-width: min(25.5rem, calc(100vw - 2rem));
		margin-inline: auto;
	}

	/* Desktop drops the floating pill, so the card no longer needs to
	   reserve `--bn-clear` clearance. */
	@media (min-width: 56rem) {
		.flow-card-wrap {
			inset: 0.5rem 0.5rem 0.75rem 0.5rem;
		}
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

	:global([data-theme='light']) .flow-card-slot.is-back,
	:global([data-theme='peach']) .flow-card-slot.is-back {
		opacity: calc(1 - var(--depth) * 0.22);
		filter: saturate(calc(1 - var(--depth) * 0.08)) drop-shadow(0 18px 32px rgba(14, 13, 11, 0.08));
	}
</style>
