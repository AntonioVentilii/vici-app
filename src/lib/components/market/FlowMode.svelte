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
	import FlowDailyCap from '$lib/components/market/FlowDailyCap.svelte';
	import FlowEmptyDeck from '$lib/components/market/FlowEmptyDeck.svelte';
	import FlowEnd from '$lib/components/market/FlowEnd.svelte';
	import FlowEntry from '$lib/components/market/FlowEntry.svelte';
	import FlowStreakBreakBanner from '$lib/components/market/FlowStreakBreakBanner.svelte';
	import FlowTopBar from '$lib/components/market/FlowTopBar.svelte';
	import FlowXpPops from '$lib/components/market/FlowXpPops.svelte';
	import MotionBeat from '$lib/components/market/MotionBeat.svelte';
	import SwipeHint from '$lib/components/market/SwipeHint.svelte';
	import XpToast from '$lib/components/market/XpToast.svelte';
	import FlowCoach from '$lib/components/onboarding/FlowCoach.svelte';
	import { primaryMarketTag, type MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { isVxpLadderStake, VXP_MIN_STAKE } from '$lib/constants/vxp-economy.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { featuredEvent, featuredEventActive } from '$lib/derived/featured-event.derived';
	import { playgroundFlowTradeUnitLabel } from '$lib/derived/playground.derived';
	import { prepareFlow, type PreparedFlow } from '$lib/services/flow-prep.services';
	import { flowTradeService } from '$lib/services/flow.services';
	import { persistDailyGoal, persistDailyStreak } from '$lib/services/profile.services';
	import { showCompanion } from '$lib/stores/companion.store';
	import { advanceFlow, peekFlow } from '$lib/stores/flow.store';
	import { markResolutionsSeen, maturedResolutions } from '$lib/stores/inbox.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import { userStore } from '$lib/stores/user.store';
	import type { ResolutionRevealData, XpPop } from '$lib/types/flow';
	import type { CallSide, FlowAction, Market, MarketId } from '$lib/types/market';
	import type { MarketMetadata } from '$lib/types/market-metadata';
	import type { UserMarketSignals } from '$lib/types/market-signals';
	import { isViciXp } from '$lib/utils/balance-domain.utils';
	import {
		applyDailyGoalBump,
		DAILY_GOAL_TARGET,
		rolloverDailyGoal
	} from '$lib/utils/daily-goal.utils';
	import {
		FLOW_ART_CATEGORY_SET,
		resolveFlowArtCategory,
		type FlowArtCategory
	} from '$lib/utils/flow-art.utils';
	import {
		flowBeat,
		flowSummary,
		flowTick,
		flowWild,
		resumeFlowSound,
		unlockFlowSound
	} from '$lib/utils/flow-sound.utils';
	import { haptic, hapticForBeat } from '$lib/utils/haptics.utils';
	import { t } from '$lib/utils/i18n.utils';
	import {
		DAILY_HARD_CAP,
		recordMotionSwipe,
		type MotionBeatPayload
	} from '$lib/utils/motion-engine.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';
	import { applyDailyStreakBump, stageForStreak, type FlameStage } from '$lib/utils/streak.utils';
	import { assertViciXpHumanPremium } from '$lib/utils/trade.utils';

	// Daily goal — a per-user count of predictions committed today,
	// hydrated from the profile and rolled over to 0 on a new local day.
	// The day's target is the standard ten; the user can opt into overtime
	// (Push-to-15) to extend the SESSION to the daily hard cap. Progress is
	// capped at 100 % so the bar / percent never overflows. The day's
	// target (`DAILY_GOAL_TARGET`) is shared with the dashboard resume card.

	// Session cap — how many calls this run continues to before the FlowEnd
	// takeover. Starts at the daily ten; the "Push to 15 →" opt-in on FlowEnd
	// raises it to the daily hard cap (15) so the deck continues into overtime
	// and the engine's overtime beats (calls 11 / 13 + the overtime-complete
	// +25 VXP) fire. Replaces the removed session-length preference as the
	// session ceiling.
	let sessionTarget = $state(DAILY_GOAL_TARGET);
	const maxBets = $derived(sessionTarget);

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
	// Entry gate — the full-bleed frosted FlowEntry overlay sits over the
	// deck until the user taps the armed "Enter Flow →" CTA. It carries the
	// deck-shuffle loading state AND the "while you were away" digest. A
	// no-op digest (`count === 0`) renders the deck-shuffle mode.
	let entered = $state(false);
	// The away-digest while the entry gate is open. Tracks the live store so
	// a late trade-history fetch still populates the recap; the moment the
	// user enters, `markResolutionsSeen` empties it and the overlay unmounts
	// in the same tick, so the recap never blanks under the deck (Svelte
	// freezes the last render for the `out:fade`). `ResolutionRevealData` is
	// the shared shape the Dashboard banner / ResolutionReveal also consume.
	const liveDigest = $derived<ResolutionRevealData>($maturedResolutions);
	let tradeAmount = $state('1.0');
	let betsCount = $state(0);
	// VXP locked at risk across this session's calls — the FlowEnd "Called"
	// stat. Accumulates each committed YES / NO stake; reset on continuation.
	let sessionStaked = $state(0);
	let completed = $state(false);
	// `nowMs` ticks once per second while the session is in flight so the
	// daily-goal chip rolls over to 0 the instant a session crosses local
	// midnight (see the rollover ticker below).
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
	// Daily-goal counter + the local day it belongs to. Hydrated from the
	// profile on mount and persisted after every committed prediction, so
	// the goal survives a refresh and resets when the day rolls over.
	let dailyGoalCount = $state(0);
	let dailyGoalDate = $state<string | undefined>(undefined);
	let hasMarkedActiveThisSession = false;
	// Set on the first swipe of a session that resumes after a broken
	// streak. Drives the no-shame "comeback" opener (distinct from the
	// daily welcome-back) in the motion engine for the rest of the session,
	// and the FlowEnd "comeback" variant. `$state` so the FlowEnd prop
	// reactively picks up the mid-session flip.
	let isComeback = $state(false);
	let streakBreakBanner = $state<{ stage: FlameStage } | null>(null);
	let flowPaused = $state(false);
	let activeMotionBeat = $state<MotionBeatPayload | null>(null);

	// Per-swipe commit pop — "CALLED YES · {stake} IN PLAY (+bonus VXP)".
	// Fires on every committed YES / NO swipe (SKIP renders nothing). A
	// swipe PLACES a call; the pop confirms the act, it does not imply a
	// payout. `key` remounts the component on consecutive commits so the
	// `xp-toast-pop` envelope replays. Self-dismisses ~1 s after mount.
	interface CommitToast {
		side: CallSide;
		stake: number;
		bonus: number;
		key: number;
	}
	let commitToast = $state<CommitToast | null>(null);
	let commitToastKeySeq = 0;

	const flameStage: FlameStage = $derived(stageForStreak(dailyStreak));

	let xpPops = $state<XpPop[]>([]);
	let popCounter = 0;

	// Local alias — every haptic in this file maps to a named pattern
	// from `haptics.utils.ts`. Naming kept minimal so existing call
	// sites read the same way.
	const vibrate = haptic;

	// Day-rollover ticker. 1 s cadence keeps `nowMs` fresh so the daily-goal
	// chip rolls over to 0 the moment a session left open crosses local
	// midnight — without waiting for the next prediction. Stops when
	// `completed` flips true (the deck is done; the chip no longer updates).
	$effect(() => {
		if (completed) {
			return;
		}

		const id = setInterval(() => {
			nowMs = Date.now();
		}, 1000);

		return () => clearInterval(id);
	});

	// Daily-goal progress for the top-bar chip. Roll over against the live
	// `nowMs` tick (not just the stored values) so a session left open across
	// local midnight resets the chip to 0 without waiting for the next
	// prediction.
	const dailyGoalDone = $derived(
		rolloverDailyGoal({ done: dailyGoalCount, date: dailyGoalDate, now: new Date(nowMs) })
	);

	// Daily hard-cap gate — once the day's calls reach the hard cap (15)
	// across sessions, opening Flow shows a "come back tomorrow" takeover
	// (not a fresh deck) so the 15/day model holds. Suppressed mid-session
	// (`betsCount === 0` means this run hasn't placed a call yet).
	const dailyCapReached = $derived(dailyGoalDone >= DAILY_HARD_CAP);

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
				dailyGoalCount = profile.dailyGoalDone ?? 0;
				({ dailyGoalDate } = profile);
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

		if (gatingBeatTimer !== null) {
			clearTimeout(gatingBeatTimer);
		}

		if (riseResetTimer !== null) {
			clearTimeout(riseResetTimer);
		}

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

	// Arm the iOS Web Audio gesture-unlock for the lifetime of the Flow
	// session. Most cues (deferred beats, the summary chord) fire from
	// timers — not gestures — so priming once on the first touch is what
	// makes them audible on strict iOS WebKit. The effect returns the
	// listener-teardown, so it's removed when Flow unmounts.
	$effect(() => unlockFlowSound());

	// Resume the audio route the moment sound is re-enabled mid-session so
	// the next cue plays without waiting for a fresh gesture. Reads the
	// reactive flag directly so the effect re-runs on every toggle.
	$effect(() => {
		if ($preferencesStore.soundEnabled) {
			resumeFlowSound();
		}
	});

	// Spawns a centered VXP-grant pop. Only genuine engine mints (overtime
	// finish, lifetime milestones) reach this — a routine swipe mints
	// nothing (deflation-safe economy, see `docs/ai/frontend/design.md`
	// §7.3), so every pop carries a real VXP award.
	const spawnXpPop = ({ amount, copy }: { amount: number; copy?: string }) => {
		const id = ++popCounter;
		xpPops = [...xpPops, { id, amount, copy }];

		// Bonus pops linger (paired copy needs to read).
		setTimeout(() => {
			xpPops = xpPops.filter((p) => p.id !== id);
		}, 1800);
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

	// Set when a gating beat finishes: the next card RISES over the empty
	// slot the character just vacated (not a plain cross-fade). Consumed by
	// the entering current slot and cleared once its rise has played.
	let riseNextCard = $state(false);
	let riseResetTimer: ReturnType<typeof setTimeout> | null = null;
	let gatingBeatTimer: ReturnType<typeof setTimeout> | null = null;

	const onMotionBeatDone = () => {
		const wasPaused = flowPaused;
		activeMotionBeat = null;
		flowPaused = false;

		if (wasPaused) {
			riseNextCard = true;

			if (riseResetTimer !== null) {
				clearTimeout(riseResetTimer);
			}

			riseResetTimer = setTimeout(() => {
				riseNextCard = false;
				riseResetTimer = null;
			}, 600);

			// Advance synchronously the instant the gap closes — the committed
			// card already flew out when the deck paused, so there is no
			// commit-feedback hold to wait on here. Deferring (as the
			// non-gating commit path does) would let the just-vacated slot
			// re-render the committed card for the delay window (`flowPaused`
			// is now false) before `advance` shifts it away — a flash. Reset
			// the committed marker too so the next card never inherits it.
			committedAction = null;
			committedMarketId = null;
			advance();
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
				isComeback = true;
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
			recordMotionSwipe({
				side: 'SKIP',
				dailyDone: betsCount,
				dailyTarget: sessionTarget,
				dailyJustCompleted: false,
				dayStreak: dailyStreak
			});
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
		// Tally the stake now at risk for the FlowEnd "Called" stat.
		sessionStaked += Number(tradeAmount) || 0;

		// Daily-goal bump — every committed YES / NO counts toward the
		// day's goal (skips returned early above). Rolls over to a fresh
		// day if needed, caps at the hard cap, and persists best-effort so
		// the running total survives a refresh. This is the cross-session
		// streak / hard-cap source; the engine's beat cadence runs off the
		// per-session counter below.
		const goalBump = applyDailyGoalBump({
			done: dailyGoalCount,
			date: dailyGoalDate,
			// Count up to the daily hard cap (15) so the cross-session
			// "come back tomorrow" gate fires after a full overtime day; the
			// streak still completes at the daily ten via the streak engine.
			target: DAILY_HARD_CAP
		});
		dailyGoalCount = goalBump.done;
		dailyGoalDate = goalBump.date;

		const goalPrincipal = $userStore.user?.key;

		if (nonNullish(goalPrincipal)) {
			void persistDailyGoal({
				principal: goalPrincipal,
				dailyGoalDone: goalBump.done,
				dailyGoalDate: goalBump.date
			})
				.then((data) => {
					userStore.update((s) => ({ ...s, profile: data }));
				})
				.catch((e: unknown) => {
					console.warn('Daily-goal persistence failed (non-fatal):', e);
				});
		}

		// Per-swipe sound cue — one tick per committed call (YES / NO).
		// SKIP returned early above and is intentionally silent, mirroring
		// the haptic channel. On iOS Safari (no Vibration API) this tick is
		// the only swipe feedback the user gets.
		flowTick();

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

		// The motion engine's cadence (rhythm 3 / 5 / 8, overtime 11 / 13, and
		// the daily / overtime-complete beat) runs off the SESSION counter so
		// the rhythm and the +5 overtime beats actually fire in order. The
		// cross-session daily-goal `done` above stays the streak source; the
		// session cap (`sessionTarget`) is the engine's `dailyTarget`. When the
		// user opts into Push-to-15, `sessionTarget` becomes `DAILY_HARD_CAP`
		// (15) so `dailyTarget >= DAILY_HARD_CAP` flips the engine into overtime
		// — emitting the calls-11 / 13 beats and the overtime-complete +25 VXP.
		const sessionDone = betsCount; // this swipe included (incremented above)
		const sessionJustCompleted = sessionDone >= sessionTarget;

		const motion = recordMotionSwipe({
			side: action,
			isContrarian,
			dailyDone: sessionDone,
			dailyTarget: sessionTarget,
			dailyJustCompleted: sessionJustCompleted,
			dayStreak: dailyStreak,
			isComeback,
			// Seed the engine's lifetime-volume milestones from the REAL
			// profile count (`totalTrades`, our lifetime call count)
			// rather than the engine's persisted
			// local tally, so milestone thresholds and the milestone
			// count-up reflect actual lifetime activity. `totalTrades` is
			// the lifetime call count BEFORE this swipe; the engine adds the
			// current swipe (`+1`) internally. Falls back to the local tally
			// when the profile is not yet hydrated.
			lifetimeCalls: $userStore.profile?.totalTrades
		});

		// Whether this swipe also lands on a gating beat. When it does, the
		// centered MotionBeat already owns the slot — suppress the centered
		// bonus pop so the two don't stack in the same area.
		const hasGatingBeat = motion.beat != null && motion.beat.kind !== 'ambient-10';

		// A swipe mints no VXP — the economy is deflation-safe (see
		// `docs/ai/frontend/design.md` §7.3). Real VXP is credited only by
		// the motion engine's genuine grants (overtime finish, lifetime
		// milestones), surfaced below; the session combo drives haptics and
		// the streak banner only, never a per-swipe payout.
		if (motion.bonusXp > 0) {
			xp += motion.bonusXp;

			const popCopy =
				motion.beat?.copyKey != null
					? t({ locale: $localeStore, key: motion.beat.copyKey })
					: undefined;

			// Suppress centered bonus pop too when a gating beat will fill
			// the center; the XpToast bonus chip already carries the amount.
			if (!hasGatingBeat) {
				spawnXpPop({
					amount: motion.bonusXp,
					copy: popCopy
				});
			}
		}

		// Per-swipe commit pop — every committed YES / NO. Confirms the
		// call was placed ("CALLED YES · {stake} IN PLAY") with the stake
		// now at risk; a genuine milestone / streak bonus rides along as a
		// trailing chip. Light and non-blocking — runs over the card-out,
		// the gap beat, and the next card's rise alike.
		commitToastKeySeq += 1;
		commitToast = {
			side: action,
			stake: Number(tradeAmount) || 0,
			bonus: motion.bonusXp,
			key: commitToastKeySeq
		};

		// Beat-aware haptic envelope mapped from `beat.kind`. Fires paired
		// with the beat's REVEAL, not the swipe commit — see below. On the
		// first-call beat the `firm-tap` swipe-commit haptic has already
		// fired upstream; that envelope is itself celebratory, so the commit
		// + beat firing back-to-back is intentional.
		const beatHaptic = hapticForBeat(motion.beat?.kind);

		// The beat's haptic + sound cue are paired with the moment the
		// character is revealed, not the swipe commit, so the "thunk" lands
		// on the pop rather than on the empty-slot gap. A wildcard treat
		// plays the playful arpeggio; otherwise a gating beat (any non-ambient
		// beat) plays the bigger "hard" figure and the ambient `ambient-10`
		// pop plays the soft beat.
		const fireBeatCue = () => {
			if (beatHaptic) {
				vibrate(beatHaptic);
			}

			if (motion.beat) {
				if (motion.beat.kind === 'wildcard') {
					flowWild();
				} else {
					flowBeat(motion.beat.kind !== 'ambient-10');
				}
			}
		};

		// A real beat plays IN THE GAP. The deck holds (`flowPaused`): the
		// called card flies out, the empty slot opens, then the REAL
		// character stands large & centered in it — name · copy · coin /
		// treat chips · sub-label — before the next card rises over.
		// `flowPaused` flips now so the outgoing card hides and drag locks;
		// the centered beat is revealed 250 ms later so the card-out clears
		// the slot first — and the haptic + sound cue fire WITH that reveal.
		// Ambient (`ambient-10`) is a soft pop that never gates — it advances
		// immediately, with its cue paired to its immediate reveal. Advance is
		// deferred to `onMotionBeatDone` for gating beats.
		if (motion.beat && motion.beat.kind !== 'ambient-10') {
			const gatingBeat = motion.beat;
			flowPaused = true;

			if (gatingBeatTimer !== null) {
				clearTimeout(gatingBeatTimer);
			}

			gatingBeatTimer = setTimeout(() => {
				activeMotionBeat = gatingBeat;
				fireBeatCue();
				gatingBeatTimer = null;
			}, 250);

			return;
		}

		if (motion.beat) {
			activeMotionBeat = motion.beat;
			fireBeatCue();
		}

		// Non-gating commit: the per-swipe `XpToast` above is the feedback —
		// no full-stage overlay (it would double-stack with the toast / the
		// ambient pop). The deck advances after the short commit-feedback
		// beat. SKIP returned earlier with its own quick chip.
		finishCommitAdvance();
	};

	const advance = () => {
		if (currentIndex < markets.length - 1 && betsCount < maxBets) {
			currentIndex += 1;
		} else {
			completed = true;
			vibrate('celebration');
			// Session-summary sound cue — the rising four-note chord that
			// closes out a Flow session, played as FlowEnd takes over.
			flowSummary();
		}
	};

	// Whether the session ran into overtime — the cap was raised to the daily
	// hard cap (15) via Push-to-15. Drives the FlowEnd "overtime" variant.
	const overtimeSession = $derived(sessionTarget >= DAILY_HARD_CAP);

	// Push-to-15 is offered only on a regular (non-overtime) day that still
	// has deck inventory to continue into — never once the hard cap is in
	// play. `betsCount` reached `sessionTarget` (10) for FlowEnd to show.
	// Also gated on `dailyGoalDone < DAILY_HARD_CAP`: a user who entered
	// Flow with prior-day calls already counted toward the cap has no
	// cross-session headroom left and must come back tomorrow.
	const canExtend = $derived(
		!overtimeSession && currentIndex < markets.length - 1 && dailyGoalDone < DAILY_HARD_CAP
	);

	// "Push to 15 →" — raise the session cap to cover remaining daily
	// headroom, dismiss the takeover, and rise the next card so the deck
	// continues into overtime. Sizes the new target as
	// `betsCount + (DAILY_HARD_CAP - dailyGoalDone)` so total daily calls
	// (cross-session) never exceed DAILY_HARD_CAP.
	//
	// For a fresh-day user: betsCount = 10, dailyGoalDone = 10, headroom = 5
	// → sessionTarget = 15 = DAILY_HARD_CAP, which keeps the engine in
	// overtime mode (dailyTarget >= DAILY_HARD_CAP) so the calls-11 / 13
	// beats and the overtime-complete +25 VXP fire correctly.
	//
	// For a user who already had prior calls: headroom < 5 → sessionTarget
	// < DAILY_HARD_CAP; the engine's overtime arc is proportionally shorter,
	// which is intentional — total daily calls stay ≤ 15.
	const handleExtend = () => {
		const headroom = DAILY_HARD_CAP - dailyGoalDone;
		sessionTarget = betsCount + headroom;
		completed = false;
		currentIndex += 1;
	};

	const backToMarkets = () => {
		goto(resolve(AppPath.Home));
	};

	// Enter Flow — the user tapped the armed CTA on the entry gate. Settle
	// the matured calls (acknowledge them so the Dashboard banner / bell
	// badge clear in lockstep) and reveal the deck. `markResolutionsSeen`
	// empties `liveDigest`, but flipping `entered` removes the overlay in
	// the same tick — Svelte freezes the last-rendered digest for the
	// `out:fade`, so the recap never flips to deck-shuffle mid-transition.
	const enterFlow = () => {
		markResolutionsSeen();
		entered = true;
	};

	// "Back to dashboard →" — close the takeover and return to the
	// dashboard. The session's calls are already placed (the FlowEnd is a
	// summary, not a commit step); this only picks where the user goes next.
	const handleClose = () => {
		goto(resolve(AppPath.Dash));
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
	class:is-active={!completed && (loading || markets.length > 0)}
	class:is-paused={flowPaused}
>
	{#if !loading && markets.length === 0}
		<!-- Fetch resolved to an empty deck — surface the empty state directly
		     rather than gating it behind the entry overlay. -->
		<FlowEmptyDeck onBackToMarkets={backToMarkets} />
	{:else if entered && dailyCapReached && betsCount === 0}
		<!-- Daily hard cap already met today (across sessions). Opening Flow
		     shows the "come back tomorrow" takeover, not a fresh deck. -->
		<FlowDailyCap hardCap={DAILY_HARD_CAP} onClose={handleClose} />
	{:else if completed}
		<FlowEnd
			{canExtend}
			comeback={isComeback}
			onClose={handleClose}
			onExtend={handleExtend}
			overtime={overtimeSession}
			pending={betsCount}
			staked={sessionStaked}
			streak={dailyStreak}
		/>
	{:else if entered}
		<!-- Persistent Flow header: VICI wordmark + deck-scope chip +
		     bolt streak chip on the left; bell on the right. Secondary
		     row carries `idx / total` and `+xp VXP this session` over a
		     thin progress bar. Tapping the wordmark exits Flow. -->
		<FlowTopBar
			{betsCount}
			categoryLabel={topBarCategoryLabel}
			{dailyGoalDone}
			dailyGoalTarget={sessionTarget}
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
					<!-- During a gating beat the committed card flies out and the slot
					     is held EMPTY (`flowPaused`) so the centered character plays in
					     the gap, not over a still-present card. Removing the slot here
					     (not just dimming it) triggers its `out:fly` exit — the called
					     card leaves before the beat is revealed, and the next card rises
					     into the vacated slot once `onMotionBeatDone` advances. -->
					{#if !(isCurrent && flowPaused)}
						<div
							style="z-index: {20 - i}; --depth: {i};"
							class="flow-card-slot"
							class:flow-card-rise={isCurrent && riseNextCard}
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
								interactive={isCurrent}
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
					{/if}
				{/each}
			</div>

			<FlowXpPops pops={xpPops} />

			<!-- Gesture coach — first-run only. Cycles through NO / YES /
			     SKIP / TAP / IDLE phases while the cards drift in
			     sympathy via the `data-coach-phase` CSS in app.css.
			     Self-dismisses on any pointer-down; persists dismissal
			     in localStorage. -->
			<FlowCoach />

			<!-- Per-swipe commit pop — "CALLED YES · {stake} IN PLAY". Rises
			     from the exit edge (is-yes → right, is-no → left) on every
			     committed YES / NO. Keyed so consecutive commits replay the
			     `xp-toast-pop` envelope. -->
			{#if commitToast}
				{#key commitToast.key}
					<XpToast
						bonus={commitToast.bonus}
						onDone={() => (commitToast = null)}
						side={commitToast.side}
						stake={commitToast.stake}
					/>
				{/key}
			{/if}

			<!-- Character beat, in the gap between cards. Plays centered &
			     large in the empty slot (soft 96 / hard 132) while the deck
			     holds; the next card rises over it once it finishes. -->
			{#if activeMotionBeat}
				<MotionBeat beat={activeMotionBeat} onDone={onMotionBeatDone} />
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

	<!-- Entry gate — the unified full-bleed frosted overlay (deck-shuffle
	     loading + "while you were away" digest) sits above the deck and the
	     pill-nav until the user taps the armed "Enter Flow →" CTA. Shown over
	     the in-flight fetch (deck-shuffle) and once the deck is loaded (the
	     read-the-digest gate); hidden on the empty deck and at the summary.
	     Entering settles the matured calls and reveals the deck below. -->
	{#if !entered && !completed && (loading || markets.length > 0)}
		<div out:fade={{ duration: prefersReducedMotion() ? 0 : 220 }}>
			<FlowEntry digest={liveDigest} onEnter={enterFlow} ready={!loading} />
		</div>
	{/if}
</div>

<svelte:window
	onkeydown={(e) => {
		// Ignore deck shortcuts while the entry gate is up (the overlay owns
		// the surface until the user enters), during the cold-load, and at
		// the summary.
		if (loading || completed || !entered) {
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
