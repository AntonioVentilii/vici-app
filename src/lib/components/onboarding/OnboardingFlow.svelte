<script lang="ts">
	import { Check, Sparkles } from 'lucide-svelte';
	import { onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import FlowArtFrame from '$lib/components/artwork/FlowArtFrame.svelte';
	import { MIN_NICKNAME_LENGTH } from '$lib/constants/profile.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { newUserVxpAmountMilestone1BaseUnits } from '$lib/constants/vxp-onboarding.constants';
	import {
		ONBOARDING_DEMO_MARKETS,
		type WelcomeMarketPreview
	} from '$lib/constants/welcome-markets.constants';
	import { checkNicknameAvailability } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { CallSide } from '$lib/types/market';
	import { categoryColor } from '$lib/utils/category-color.utils';
	import { FLOW_ART_CATEGORIES, type FlowArtCategory } from '$lib/utils/flow-art.utils';
	import { decimalFixedValueToNumber, formatProbability } from '$lib/utils/format.utils';
	import { haptic } from '$lib/utils/haptics.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface OnboardingResult {
		handle: string;
		interests: string[];
		email?: string;
	}

	interface Props {
		onComplete: (result: OnboardingResult) => void;
		onSignIn?: () => void;
	}

	const { onComplete, onSignIn }: Props = $props();

	const firstCallAdvance_ms = 2_400;
	const firstCallCelebrate_ms = 280;
	const starterPackAnimation_ms = 720;
	// Starter VXP — the visible whole-token total animated on the
	// final screen. Derived from `vxp-onboarding.constants.ts` so the
	// display amount stays in lockstep with the on-chain milestone
	// payout, with no hardcoded `1_000` literal to drift from.
	const STARTER_VXP_DISPLAY = Number(
		decimalFixedValueToNumber({
			value: newUserVxpAmountMilestone1BaseUnits(),
			decimals: VXP_TOKEN.decimals
		})
	);

	// Onboarding fixture markets — the first two (`fed-jun`, `btc-150k`)
	// drive the "first call" and "practice tap" stages; the rest back
	// the category-preview grid. Sourced from the shared
	// `ONBOARDING_DEMO_MARKETS` (one per category, derived from the
	// same SSOT as `WELCOME_MARKET_PREVIEWS`) so the landing and
	// onboarding surfaces stay in lock-step without duplicating ids
	// or yes probabilities.
	const markets: readonly WelcomeMarketPreview[] = ONBOARDING_DEMO_MARKETS;
	const [firstMarket, practiceMarket] = markets;

	const categoryOptions: readonly FlowArtCategory[] = FLOW_ART_CATEGORIES;

	const marketFieldKey = ({
		id,
		field
	}: {
		id: string;
		field: 'title' | 'subtitle' | 'resolution' | 'source';
	}): MessageKey => `onboarding.markets.${id.replace(/-/g, '_')}.${field}` as MessageKey;

	const categoryLabelKey = (id: FlowArtCategory): MessageKey => `onboarding.category.${id}.label`;

	const categoryFeedKey = (id: FlowArtCategory): MessageKey => `onboarding.category.${id}.feed`;

	let step = $state(0);
	let firstDragX = $state(0);
	let firstDragY = $state(0);
	let firstDragging = $state(false);
	let firstCoachVisible = $state(true);
	let firstCommitted = $state<CallSide | null>(null);
	let firstCelebrating = $state(false);
	let firstCallSide = $state<CallSide | null>(null);
	let firstStartX = 0;
	let firstStartY = 0;

	let practiceDragX = $state(0);
	let practiceDragY = $state(0);
	let practiceDragging = $state(false);
	let practiceFlipped = $state(false);
	let practicePhase = $state<'flip' | 'skip' | 'done'>('flip');
	let practiceCoachVisible = $state(true);
	let practiceExiting = $state(false);
	let practiceStartX = 0;
	let practiceStartY = 0;

	const interests = new SvelteSet<FlowArtCategory>();
	let handle = $state('');
	let email = $state('');
	let submitting = $state(false);
	let starterXp = $state(0);

	// Live nickname availability — debounced behind every keystroke
	// and against the same satellite validator the assertion uses, so
	// what the UI says is exactly what the next `setDoc` will accept.
	// `handleAvailability` is `undefined` until the first probe lands.
	type HandleAvailability = 'available' | 'taken' | 'too_short' | 'required' | 'check_failed';
	let handleAvailability = $state<HandleAvailability | undefined>(undefined);
	let handleChecking = $state(false);
	let handleCheckToken = 0;
	let handleCheckTimer: ReturnType<typeof setTimeout> | undefined;
	const handleCheckDebounce_ms = 350;

	// Visual feedback when the user taps the (visually) disabled
	// "enter" button without a valid handle — a brief shake + red
	// border on the input + focus, so the gesture is never silent.
	let handleErrorShake = $state(false);
	let handleErrorShakeTimer: ReturnType<typeof setTimeout> | undefined;
	let handleInputEl = $state<HTMLInputElement | undefined>(undefined);
	const handleErrorShake_ms = 480;

	const queuedTimeouts: ReturnType<typeof setTimeout>[] = [];

	const progressWidth = $derived(`${((step + 1) / 4) * 100}%`);
	const progressTone = $derived(
		step === 0 ? 'var(--text-muted)' : step === 1 ? 'var(--laurel-deep)' : 'var(--laurel)'
	);
	const progressLatin = $derived(
		step === 0
			? t({ locale: $localeStore, key: 'onboarding.latin.veni' })
			: step === 3
				? t({ locale: $localeStore, key: 'onboarding.latin.vici' })
				: ''
	);
	const firstRotation = $derived(firstDragX / 18);
	const firstYesOpacity = $derived(firstCommitted === 'YES' ? 1 : Math.max(0, firstDragX / 70));
	const firstNoOpacity = $derived(firstCommitted === 'NO' ? 1 : Math.max(0, -firstDragX / 70));
	const firstCoachOpacity = $derived(
		firstCoachVisible ? Math.max(0, 1 - Math.abs(firstDragX) / 44) : 0
	);
	const practiceRotation = $derived(practiceDragX / 20);
	const practiceSkipOpacity = $derived(Math.max(0, -practiceDragY / 72));
	const practiceCoachOpacity = $derived(
		practiceCoachVisible
			? Math.max(0, 1 - Math.max(Math.abs(practiceDragX), Math.abs(practiceDragY)) / 44)
			: 0
	);
	const selectedInterestCount = $derived(interests.size);
	const selectedInterestList = $derived.by(() => Array.from(interests));
	const previewMarkets = $derived.by(() =>
		selectedInterestList
			.map((category) => markets.find((market) => market.category === category))
			.filter((market): market is WelcomeMarketPreview => market !== undefined)
			.slice(0, 3)
	);
	const cleanEmail = $derived(email.trim().toLowerCase());
	const emailLooksValid = $derived(cleanEmail.length === 0 || /\S+@\S+\.\S+/.test(cleanEmail));
	const canSubmitIdentity = $derived(
		handle.length >= MIN_NICKNAME_LENGTH && handleAvailability === 'available' && !handleChecking
	);
	const handleInvalid = $derived(
		handleAvailability === 'taken' ||
			handleAvailability === 'too_short' ||
			handleAvailability === 'required' ||
			handleAvailability === 'check_failed'
	);

	$effect(() => {
		if (step !== 3) {
			return;
		}

		let animationFrame = 0;
		const start = performance.now();

		const tick = (now: number) => {
			const progress = Math.min(1, (now - start) / starterPackAnimation_ms);
			const eased = 1 - Math.pow(1 - progress, 3);
			starterXp = Math.round(eased * STARTER_VXP_DISPLAY);

			if (progress < 1) {
				animationFrame = requestAnimationFrame(tick);
			}
		};

		animationFrame = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(animationFrame);
		};
	});

	onDestroy(() => {
		queuedTimeouts.forEach((timeout) => {
			clearTimeout(timeout);
		});

		if (handleCheckTimer) {
			clearTimeout(handleCheckTimer);
		}

		if (handleErrorShakeTimer) {
			clearTimeout(handleErrorShakeTimer);
		}
	});

	const scheduleHandleAvailabilityCheck = (value: string) => {
		if (handleCheckTimer) {
			clearTimeout(handleCheckTimer);
		}

		handleCheckToken += 1;
		const token = handleCheckToken;

		if (value.length === 0) {
			handleAvailability = 'required';
			handleChecking = false;

			return;
		}

		if (value.length < MIN_NICKNAME_LENGTH) {
			handleAvailability = 'too_short';
			handleChecking = false;

			return;
		}

		handleChecking = true;
		handleAvailability = undefined;

		handleCheckTimer = setTimeout(() => {
			void (async () => {
				try {
					// Pre-auth: no principal to exclude — any match means taken.
					const result = await checkNicknameAvailability({ nickname: value });

					if (token !== handleCheckToken) {
						return;
					}

					handleChecking = false;
					handleAvailability = result.available ? 'available' : result.reason;
				} catch (_err: unknown) {
					if (token !== handleCheckToken) {
						return;
					}

					handleChecking = false;
					handleAvailability = 'check_failed';
				}
			})();
		}, handleCheckDebounce_ms);
	};

	const queueTimeout = ({ callback, delay_ms }: { callback: () => void; delay_ms: number }) => {
		const timeout = setTimeout(callback, delay_ms);
		queuedTimeouts.push(timeout);
	};

	const noProbability = (market: WelcomeMarketPreview): number => 1 - market.yesProbability;

	const capturePointer = (event: PointerEvent) => {
		if (event.currentTarget instanceof HTMLElement) {
			event.currentTarget.setPointerCapture(event.pointerId);
		}
	};

	const stopPointer = (event: PointerEvent) => {
		event.stopPropagation();
	};

	const startFirstDrag = (event: PointerEvent) => {
		if (firstCommitted !== null) {
			return;
		}

		capturePointer(event);
		firstStartX = event.clientX;
		firstStartY = event.clientY;
		firstDragging = true;
		firstCoachVisible = false;
	};

	const moveFirstDrag = (event: PointerEvent) => {
		if (!firstDragging || firstCommitted !== null) {
			return;
		}

		firstDragX = event.clientX - firstStartX;
		firstDragY = event.clientY - firstStartY;
	};

	const endFirstDrag = () => {
		if (!firstDragging || firstCommitted !== null) {
			return;
		}

		firstDragging = false;

		if (firstDragX > 80) {
			commitFirstCall('YES');

			return;
		}

		if (firstDragX < -80) {
			commitFirstCall('NO');

			return;
		}

		firstDragX = 0;
		firstDragY = 0;
		firstCoachVisible = true;
	};

	const commitFirstCall = (side: CallSide) => {
		if (firstCommitted !== null) {
			return;
		}

		firstCallSide = side;
		firstCommitted = side;
		firstDragging = false;
		firstDragX = side === 'YES' ? 520 : -520;
		firstDragY = 0;
		haptic('triple-tap');

		queueTimeout({
			callback: () => {
				firstCelebrating = true;
			},
			delay_ms: firstCallCelebrate_ms
		});
		queueTimeout({
			callback: () => {
				step = 1;
			},
			delay_ms: firstCallAdvance_ms
		});
	};

	const startPracticeDrag = (event: PointerEvent) => {
		if (practicePhase === 'done' || practiceExiting) {
			return;
		}

		capturePointer(event);
		practiceStartX = event.clientX;
		practiceStartY = event.clientY;
		practiceDragging = true;
		practiceCoachVisible = false;
	};

	const movePracticeDrag = (event: PointerEvent) => {
		if (!practiceDragging || practiceExiting || practiceFlipped) {
			return;
		}

		practiceDragX = event.clientX - practiceStartX;
		practiceDragY = event.clientY - practiceStartY;
	};

	const endPracticeDrag = () => {
		if (!practiceDragging || practicePhase === 'done') {
			return;
		}

		practiceDragging = false;

		const moved = Math.hypot(practiceDragX, practiceDragY);

		if (moved < 8) {
			handlePracticeTap();
			resetPracticeDrag();

			return;
		}

		if (
			practicePhase === 'skip' &&
			practiceDragY < -86 &&
			Math.abs(practiceDragY) > Math.abs(practiceDragX) * 1.25
		) {
			practiceExiting = true;
			practiceDragX = 0;
			practiceDragY = -620;
			haptic('soft-tick');
			queueTimeout({
				callback: () => {
					practicePhase = 'done';
					practiceExiting = false;
					resetPracticeDrag();
				},
				delay_ms: 260
			});

			return;
		}

		resetPracticeDrag();
		practiceCoachVisible = true;
	};

	const resetPracticeDrag = () => {
		practiceDragX = 0;
		practiceDragY = 0;
	};

	const handlePracticeTap = () => {
		haptic('light-tap');

		if (practiceFlipped) {
			practiceFlipped = false;

			if (practicePhase === 'flip') {
				practicePhase = 'skip';
				practiceCoachVisible = true;
			}

			return;
		}

		practiceFlipped = true;
	};

	const toggleInterest = (id: FlowArtCategory) => {
		if (interests.has(id)) {
			interests.delete(id);

			return;
		}

		interests.add(id);
	};

	const sanitizeHandle = (raw: string): string =>
		raw
			.toLowerCase()
			.replace(/[^a-z0-9_.]/g, '')
			.slice(0, 16);

	const updateHandle = (event: Event) => {
		if (event.currentTarget instanceof HTMLInputElement) {
			handle = sanitizeHandle(event.currentTarget.value);
			scheduleHandleAvailabilityCheck(handle);
		}
	};

	const updateEmail = (event: Event) => {
		if (event.currentTarget instanceof HTMLInputElement) {
			email = event.currentTarget.value;
		}
	};

	const flashHandleError = () => {
		if (handleErrorShakeTimer) {
			clearTimeout(handleErrorShakeTimer);
		}

		// Restart the keyframe even when one is already running by
		// dropping the class for a frame before re-applying it.
		handleErrorShake = false;
		requestAnimationFrame(() => {
			handleErrorShake = true;

			handleErrorShakeTimer = setTimeout(() => {
				handleErrorShake = false;
			}, handleErrorShake_ms);
		});

		haptic('low-thud');
	};

	const complete = () => {
		if (submitting) {
			return;
		}

		if (!canSubmitIdentity) {
			// Reflect the empty case in the live-region hint so the
			// shake isn't the only signal a user gets.
			if (handle.length === 0) {
				handleAvailability = 'required';
			}

			flashHandleError();
			handleInputEl?.focus();

			return;
		}

		submitting = true;
		haptic('celebration');

		const result: OnboardingResult = {
			handle,
			interests: selectedInterestList
		};

		if (emailLooksValid && cleanEmail.length > 0) {
			result.email = cleanEmail;
		}

		onComplete(result);
	};
</script>

<div class="onboarding-shell" data-tid={TestId.OnboardingFlow}>
	{#if onSignIn && step === 0}
		<div class="signin-switch">
			<span>{t({ locale: $localeStore, key: 'onboarding.signin_prompt' })}</span>
			<button onclick={onSignIn} type="button">
				{t({ locale: $localeStore, key: 'signin.footer.cta.signin' })}
			</button>
		</div>
	{/if}

	<header class="progress-head">
		<div class="progress-meta">
			<span class="serif-italic latin">{progressLatin}</span>
			<span class="num step-count">
				{t({
					locale: $localeStore,
					key: 'onboarding.step_count',
					params: { current: step + 1 }
				})}
			</span>
		</div>
		<div class="progress-track" aria-hidden="true">
			<div style:background={progressTone} style:width={progressWidth} class="progress-fill"></div>
		</div>
	</header>

	<main class="step-frame">
		{#if step === 0}
			<section class="step step-first" aria-labelledby="first-call-title">
				<div class="step-copy">
					<p class="eyebrow">
						{t({ locale: $localeStore, key: 'onboarding.eyebrow.first_call' })}
					</p>
					<h1 id="first-call-title">
						{t({ locale: $localeStore, key: 'onboarding.step1.title' })}
					</h1>
					<p>{t({ locale: $localeStore, key: 'onboarding.step1.sub' })}</p>
				</div>

				<div class="card-stage">
					<div class="shadow-card" aria-hidden="true"></div>
					<div
						style:opacity={firstCommitted ? 0 : 1}
						style:transform="translate3d({firstDragX}px, {firstDragY}px, 0) rotate({firstRotation}deg)"
						class="market-card {firstDragging ? 'dragging' : ''} {firstCommitted !== null
							? 'committed'
							: ''}"
						aria-label={t({ locale: $localeStore, key: 'onboarding.aria.swipe_first_call' })}
						data-tid={TestId.OnboardingFirstCallCard}
						onpointercancel={endFirstDrag}
						onpointerdown={startFirstDrag}
						onpointermove={moveFirstDrag}
						onpointerup={endFirstDrag}
						role="group"
					>
						<div class="market-head">
							<div class="market-meta">
								<span style:color={categoryColor(firstMarket.category)} class="allcaps">
									{t({ locale: $localeStore, key: categoryLabelKey(firstMarket.category) })}
								</span>
								<span class="num muted">{firstMarket.days}d</span>
								<span class="allcaps first-flag">
									{t({ locale: $localeStore, key: 'onboarding.first_call_badge' })}
								</span>
							</div>
							<h2>
								{t({
									locale: $localeStore,
									key: marketFieldKey({ id: firstMarket.id, field: 'title' })
								})}
							</h2>
							<p>
								{t({
									locale: $localeStore,
									key: marketFieldKey({ id: firstMarket.id, field: 'subtitle' })
								})}
							</p>
						</div>

						<div class="art-slot">
							<FlowArtFrame
								category={firstMarket.category}
								frame
								seed={firstMarket.id}
								size={260}
							/>
						</div>

						<div class="prob-grid">
							<button
								class="prob-button no"
								onclick={() => commitFirstCall('NO')}
								onpointerdown={stopPointer}
								type="button"
							>
								<span>{t({ locale: $localeStore, key: 'outcome.no' })}</span>
								<strong class="num">{formatProbability(noProbability(firstMarket))}</strong>
							</button>
							<button
								class="prob-button yes"
								onclick={() => commitFirstCall('YES')}
								onpointerdown={stopPointer}
								type="button"
							>
								<span>{t({ locale: $localeStore, key: 'outcome.yes' })}</span>
								<strong class="num">{formatProbability(firstMarket.yesProbability)}</strong>
							</button>
						</div>

						<div class="call-rail">
							<span>{t({ locale: $localeStore, key: 'onboarding.call_rail.left' })}</span>
							<span>
								{t({
									locale: $localeStore,
									key: 'card.call_count',
									params: { count: firstMarket.calls }
								})}
							</span>
							<span>{t({ locale: $localeStore, key: 'onboarding.call_rail.right' })}</span>
						</div>

						<div style:opacity={Math.min(firstYesOpacity, 1)} class="edge-tint yes"></div>
						<div style:opacity={Math.min(firstNoOpacity, 1)} class="edge-tint no"></div>
						<span style:opacity={Math.min(firstYesOpacity, 1)} class="stamp yes">
							{t({ locale: $localeStore, key: 'outcome.yes' })}
						</span>
						<span style:opacity={Math.min(firstNoOpacity, 1)} class="stamp no">
							{t({ locale: $localeStore, key: 'outcome.no' })}
						</span>
					</div>

					<div style:opacity={firstCoachOpacity} class="coach" aria-hidden={!firstCoachVisible}>
						<div class="coach-row">
							<span class="coach-arrow no">←</span>
							<span>
								{t({ locale: $localeStore, key: 'onboarding.coach.swipe' })}
								<em class="serif-italic no">
									{t({ locale: $localeStore, key: 'onboarding.coach.left' })}
								</em>
								{t({ locale: $localeStore, key: 'onboarding.coach.or' })}
								<em class="serif-italic yes">
									{t({ locale: $localeStore, key: 'onboarding.coach.right' })}
								</em>
							</span>
							<span class="coach-arrow yes">→</span>
						</div>
						<p>{t({ locale: $localeStore, key: 'onboarding.coach.right_yes_left_no' })}</p>
					</div>

					<div
						class="celebration {firstCelebrating ? 'fire' : ''}"
						aria-hidden={!firstCelebrating}
						aria-live="polite"
					>
						<div class="rings" aria-hidden="true"><span></span><span></span><span></span></div>
						<div class="sparks" aria-hidden="true">
							{#each Array.from({ length: 10 }) as _, i (i)}
								<span style:--spark-index={i} style:--spark-rotation={`${i * 36}deg`}></span>
							{/each}
						</div>
						<div class="celebration-copy">
							<span class="allcaps">
								{t({ locale: $localeStore, key: 'onboarding.first_call_badge' })}
							</span>
							<strong class="serif-italic">
								{t({ locale: $localeStore, key: 'onboarding.celebration.called_it' })}
							</strong>
							<span class="num">
								{t({ locale: $localeStore, key: 'onboarding.celebration.bonus' })}
								<small>{t({ locale: $localeStore, key: 'leaderboard.row.xp' })}</small>
							</span>
						</div>
					</div>
				</div>
			</section>
		{:else if step === 1}
			<section class="step step-gestures" aria-labelledby="gestures-title">
				<div class="step-copy">
					<p class="eyebrow">{t({ locale: $localeStore, key: 'onboarding.eyebrow.gestures' })}</p>
					<h1 id="gestures-title">{t({ locale: $localeStore, key: 'onboarding.step2.title' })}</h1>
					<p>{t({ locale: $localeStore, key: 'onboarding.step2.sub' })}</p>
				</div>

				{#if practicePhase === 'done'}
					<div class="done-panel" aria-live="polite">
						<span class="eyebrow">
							{t({ locale: $localeStore, key: 'onboarding.eyebrow.two_gestures_learned' })}
						</span>
						<ul>
							<li>
								<Check class="done-check" aria-hidden="true" size={15} strokeWidth={2.5} />
								{t({ locale: $localeStore, key: 'onboarding.step2.done.tap_details' })}
							</li>
							<li>
								<Check class="done-check" aria-hidden="true" size={15} strokeWidth={2.5} />
								{t({ locale: $localeStore, key: 'onboarding.step2.done.swipe_skip' })}
							</li>
						</ul>
						<p class="serif-italic">
							{t({ locale: $localeStore, key: 'onboarding.step2.done.ready' })}
						</p>
					</div>
					<button
						class="primary-action"
						data-tid={TestId.OnboardingPrimary}
						onclick={() => (step = 2)}
						type="button"
					>
						{t({ locale: $localeStore, key: 'onboarding.action.got_it' })}
					</button>
				{:else}
					<div class="card-stage">
						<div class="shadow-card" aria-hidden="true"></div>
						<div
							style:opacity={practiceExiting ? 0 : 1}
							style:transform="translate3d({practiceDragX}px, {practiceDragY}px, 0) rotate({practiceRotation}deg)"
							class="market-card practice-card {practiceDragging ? 'dragging' : ''} {practiceFlipped
								? 'flipped'
								: ''} {practiceExiting ? 'exiting' : ''}"
							aria-label={practicePhase === 'flip'
								? t({ locale: $localeStore, key: 'onboarding.aria.tap_show_details' })
								: t({ locale: $localeStore, key: 'onboarding.aria.swipe_up_skip' })}
							data-tid={TestId.OnboardingPracticeCard}
							onpointercancel={endPracticeDrag}
							onpointerdown={startPracticeDrag}
							onpointermove={movePracticeDrag}
							onpointerup={endPracticeDrag}
							role="group"
						>
							<div class="card-face front">
								<div class="market-head">
									<div class="market-meta">
										<span style:color={categoryColor(practiceMarket.category)} class="allcaps">
											{t({ locale: $localeStore, key: categoryLabelKey(practiceMarket.category) })}
										</span>
										<span class="num muted">{practiceMarket.days}d</span>
									</div>
									<h2>
										{t({
											locale: $localeStore,
											key: marketFieldKey({ id: practiceMarket.id, field: 'title' })
										})}
									</h2>
									<p>
										{t({
											locale: $localeStore,
											key: marketFieldKey({ id: practiceMarket.id, field: 'subtitle' })
										})}
									</p>
								</div>

								<div class="art-slot">
									<FlowArtFrame
										category={practiceMarket.category}
										frame
										seed={practiceMarket.id}
										size={260}
									/>
								</div>

								<div class="prob-grid">
									<div class="prob-button no static">
										<span>{t({ locale: $localeStore, key: 'outcome.no' })}</span>
										<strong class="num">{formatProbability(noProbability(practiceMarket))}</strong>
									</div>
									<div class="prob-button yes static">
										<span>{t({ locale: $localeStore, key: 'outcome.yes' })}</span>
										<strong class="num">{formatProbability(practiceMarket.yesProbability)}</strong>
									</div>
								</div>
							</div>

							<div class="card-face back" aria-hidden={!practiceFlipped}>
								<div class="depth-head">
									<span style:color={categoryColor(practiceMarket.category)} class="allcaps">
										{t({ locale: $localeStore, key: categoryLabelKey(practiceMarket.category) })}
									</span>
									<span class="eyebrow">
										{t({ locale: $localeStore, key: 'onboarding.eyebrow.depth' })}
									</span>
								</div>
								<div class="depth-body">
									<h2>
										{t({
											locale: $localeStore,
											key: marketFieldKey({ id: practiceMarket.id, field: 'title' })
										})}
									</h2>
									<div>
										<span class="eyebrow">
											{t({ locale: $localeStore, key: 'onboarding.eyebrow.resolution' })}
										</span>
										<p>
											{t({
												locale: $localeStore,
												key: marketFieldKey({ id: practiceMarket.id, field: 'resolution' })
											})}
										</p>
										<small class="num">
											{t({
												locale: $localeStore,
												key: 'onboarding.depth.source',
												params: {
													source: t({
														locale: $localeStore,
														key: marketFieldKey({ id: practiceMarket.id, field: 'source' })
													})
												}
											})}
										</small>
									</div>
									<div>
										<span class="eyebrow">
											{t({ locale: $localeStore, key: 'onboarding.eyebrow.consensus' })}
										</span>
										<div class="consensus-bar">
											<i style:width={formatProbability(practiceMarket.yesProbability)}></i>
										</div>
										<p>
											{t({ locale: $localeStore, key: 'onboarding.depth.yes_sits_at' })}
											<strong class="num">{formatProbability(practiceMarket.yesProbability)}</strong
											>.
										</p>
									</div>
									<div class="tap-return">
										{t({ locale: $localeStore, key: 'onboarding.depth.tap_return' })}
									</div>
								</div>
							</div>

							<span style:opacity={Math.min(practiceSkipOpacity, 1)} class="stamp skip">
								{t({ locale: $localeStore, key: 'onboarding.skip_stamp' })}
							</span>
						</div>

						<div style:opacity={practiceCoachOpacity} class="coach coach-practice">
							{#if practicePhase === 'flip'}
								<div class="coach-row">
									<span class="coach-dot" aria-hidden="true"></span>
									<span>
										{t({ locale: $localeStore, key: 'onboarding.coach.tap_show' })}
										<em class="serif-italic acc">
											{t({ locale: $localeStore, key: 'onboarding.coach.details' })}
										</em>
									</span>
								</div>
								<p>{t({ locale: $localeStore, key: 'onboarding.coach.tap_again_return' })}</p>
							{:else}
								<div class="coach-row vertical">
									<span class="coach-arrow up">↑</span>
									<span>
										{t({ locale: $localeStore, key: 'onboarding.coach.swipe' })}
										<em class="serif-italic acc">
											{t({ locale: $localeStore, key: 'onboarding.coach.up' })}
										</em>
										{t({ locale: $localeStore, key: 'onboarding.coach.to_skip' })}
									</span>
								</div>
								<p>{t({ locale: $localeStore, key: 'onboarding.coach.not_your_call' })}</p>
							{/if}
						</div>
					</div>
				{/if}
			</section>
		{:else if step === 2}
			<section class="step step-categories" aria-labelledby="categories-title">
				<div class="step-copy">
					<p class="eyebrow">
						{t({ locale: $localeStore, key: 'onboarding.eyebrow.categories' })}
					</p>
					<h1 id="categories-title">
						{t({ locale: $localeStore, key: 'onboarding.step3.title' })}
					</h1>
					<p>{t({ locale: $localeStore, key: 'onboarding.step3.sub' })}</p>
				</div>

				<div class="category-grid">
					{#each categoryOptions as category (category)}
						{@const selected = interests.has(category)}
						<button
							style:--cat-color={categoryColor(category)}
							class={selected ? 'category-tile selected' : 'category-tile'}
							aria-pressed={selected}
							data-tid={TestId.OnboardingInterest}
							onclick={() => toggleInterest(category)}
							type="button"
						>
							<FlowArtFrame {category} seed={`category-${category}`} size={64} />
							<span>
								<strong>{t({ locale: $localeStore, key: categoryLabelKey(category) })}</strong>
								<small>{t({ locale: $localeStore, key: categoryFeedKey(category) })}</small>
							</span>
						</button>
					{/each}
				</div>

				<div class="category-count {selectedInterestCount >= 3 ? 'ready' : ''}">
					{selectedInterestCount >= 3
						? t({
								locale: $localeStore,
								key: 'onboarding.step3.ready_count',
								params: { count: selectedInterestCount }
							})
						: t({
								locale: $localeStore,
								key: 'onboarding.step3.count',
								params: {
									count: selectedInterestCount,
									total: FLOW_ART_CATEGORIES.length
								}
							})}
				</div>

				{#if selectedInterestCount >= 3}
					<div class="deck-preview" aria-live="polite">
						<span class="eyebrow">
							{t({ locale: $localeStore, key: 'onboarding.eyebrow.first_deck' })}
						</span>
						<div>
							{#each previewMarkets as market (market.id)}
								<article>
									<FlowArtFrame category={market.category} seed={market.id} size={52} />
									<p>
										{t({
											locale: $localeStore,
											key: marketFieldKey({ id: market.id, field: 'title' })
										})}
									</p>
								</article>
							{/each}
						</div>
					</div>
				{/if}

				<button
					class="primary-action {selectedInterestCount < 3 ? 'disabled-look' : ''}"
					data-tid={TestId.OnboardingPrimary}
					disabled={selectedInterestCount < 3}
					onclick={() => (step = 3)}
					type="button"
				>
					{selectedInterestCount >= 3
						? t({ locale: $localeStore, key: 'onboarding.action.continue' })
						: t({ locale: $localeStore, key: 'onboarding.action.pick_three' })}
				</button>
			</section>
		{:else}
			<section class="step step-identity" aria-labelledby="identity-title">
				<div class="step-copy">
					<p class="serif-italic latin">
						{t({ locale: $localeStore, key: 'onboarding.latin.vici' })}
					</p>
					<h1 id="identity-title">
						{t({ locale: $localeStore, key: 'onboarding.step4.title_a' })}
						<em class="serif-italic">
							{t({ locale: $localeStore, key: 'onboarding.step4.title_b' })}
						</em>
					</h1>
					<p>{t({ locale: $localeStore, key: 'onboarding.step4.sub' })}</p>
				</div>

				<div class="starter-pack">
					<div class="pack-top">
						<span class="eyebrow">
							{t({ locale: $localeStore, key: 'onboarding.eyebrow.starter_pack' })}
						</span>
						<span class="pack-gift">
							{t({ locale: $localeStore, key: 'onboarding.starter.vxp_label' })}
							<Sparkles class="pack-spark" aria-hidden="true" size={15} strokeWidth={2} />
						</span>
					</div>
					<div class="pack-xp">
						<strong class="num">{starterXp.toLocaleString($localeStore)}</strong>
						<span>{t({ locale: $localeStore, key: 'onboarding.starter.vxp_label' })}</span>
					</div>
					<ul>
						<li>
							<span>{t({ locale: $localeStore, key: 'onboarding.starter.markets' })}</span>
							<small>{t({ locale: $localeStore, key: 'onboarding.starter.markets_meta' })}</small>
						</li>
						<li>
							<span>{t({ locale: $localeStore, key: 'onboarding.starter.grace' })}</span>
							<small>{t({ locale: $localeStore, key: 'onboarding.starter.grace_meta' })}</small>
						</li>
						{#if firstCallSide}
							<li>
								<span>
									{t({ locale: $localeStore, key: 'onboarding.starter.first_call_bonus' })}
								</span>
								<small>
									{t({ locale: $localeStore, key: 'onboarding.starter.first_call_bonus_meta' })}
								</small>
							</li>
						{/if}
					</ul>
				</div>

				<label class="field {handleInvalid ? 'field-invalid' : ''}">
					<span class="eyebrow"
						>{t({ locale: $localeStore, key: 'onboarding.eyebrow.handle' })}</span
					>
					<span
						class="handle-row {handleInvalid ? 'invalid' : ''} {handleErrorShake ? 'shake' : ''}"
					>
						<span aria-hidden="true">@</span>
						<input
							bind:this={handleInputEl}
							aria-describedby="onboarding-handle-status"
							aria-invalid={handleInvalid}
							data-tid={TestId.OnboardingHandleInput}
							inputmode="text"
							maxlength="16"
							oninput={updateHandle}
							placeholder={t({ locale: $localeStore, key: 'onboarding.handle.placeholder' })}
							spellcheck="false"
							type="text"
							value={handle}
						/>
					</span>
					<small
						id="onboarding-handle-status"
						class={handleInvalid
							? 'num warning'
							: handleAvailability === 'available'
								? 'num ok'
								: 'num'}
						aria-live="polite"
					>
						{#if handleAvailability === 'required'}
							{t({ locale: $localeStore, key: 'onboarding.handle.required' })}
						{:else if handle.length === 0}
							{t({ locale: $localeStore, key: 'onboarding.handle.hint' })}
						{:else if handle.length < MIN_NICKNAME_LENGTH}
							{t({
								locale: $localeStore,
								key: 'onboarding.handle.too_short',
								params: { count: MIN_NICKNAME_LENGTH }
							})}
						{:else if handleChecking}
							{t({ locale: $localeStore, key: 'onboarding.handle.checking' })}
						{:else if handleAvailability === 'taken'}
							{t({
								locale: $localeStore,
								key: 'onboarding.handle.taken',
								params: { handle }
							})}
						{:else if handleAvailability === 'check_failed'}
							{t({ locale: $localeStore, key: 'onboarding.handle.error_check_failed' })}
						{:else if handleAvailability === 'available'}
							{t({
								locale: $localeStore,
								key: 'onboarding.handle.available',
								params: { handle }
							})}
						{:else}
							{t({
								locale: $localeStore,
								key: 'onboarding.handle.url',
								params: { handle }
							})}
						{/if}
					</small>
				</label>

				<label class="field">
					<span class="eyebrow">{t({ locale: $localeStore, key: 'onboarding.eyebrow.email' })}</span
					>
					<input
						data-tid={TestId.OnboardingEmailInput}
						oninput={updateEmail}
						placeholder={t({ locale: $localeStore, key: 'onboarding.email.placeholder' })}
						type="email"
						value={email}
					/>
					<small class={emailLooksValid ? 'num' : 'num warning'}>
						{emailLooksValid
							? t({ locale: $localeStore, key: 'onboarding.email.saved_note' })
							: t({ locale: $localeStore, key: 'onboarding.email.optional_note' })}
					</small>
				</label>

				<div class="social-proof">
					<span class="avatars" aria-hidden="true"><i></i><i></i><i></i></span>
					<span>
						{t({ locale: $localeStore, key: 'onboarding.social_proof.join' })}
						<strong class="num">
							{t({ locale: $localeStore, key: 'onboarding.social_proof.count' })}
						</strong>
						{t({ locale: $localeStore, key: 'onboarding.social_proof.predictors' })}
					</span>
				</div>

				<button
					class="primary-action {!canSubmitIdentity || submitting ? 'disabled-look' : ''}"
					aria-disabled={!canSubmitIdentity || submitting}
					data-tid={TestId.OnboardingPrimary}
					disabled={submitting}
					onclick={complete}
					type="button"
				>
					{submitting
						? t({ locale: $localeStore, key: 'onboarding.action.entering' })
						: t({ locale: $localeStore, key: 'onboarding.action.enter' })}
				</button>
			</section>
		{/if}
	</main>
</div>

<style lang="postcss">
	.onboarding-shell {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background:
			radial-gradient(circle at 50% -10%, rgba(226, 184, 66, 0.12), transparent 34rem),
			var(--bg-base);
		color: var(--text-base);
	}

	.signin-switch {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: flex-end;
		gap: 0.4rem;
		padding: 0.875rem 1.5rem 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.signin-switch button {
		border: 0;
		background: transparent;
		color: var(--laurel);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.progress-head {
		flex: 0 0 auto;
		padding: 1rem 1.5rem 0;
	}

	.progress-meta {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.latin {
		min-height: 1.5rem;
		color: var(--laurel);
		font-size: var(--t-20);
	}

	.step-count {
		color: var(--text-muted);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.progress-track {
		overflow: hidden;
		height: 3px;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-base) 8%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-base) 4%, transparent);
	}

	.progress-fill {
		height: 100%;
		border-radius: inherit;
		box-shadow: 0 0 18px color-mix(in srgb, var(--laurel) 24%, transparent);
		transition:
			width var(--d-enter) var(--ease-vici),
			background var(--d-enter) var(--ease-vici);
	}

	.step-frame {
		display: flex;
		flex: 1 1 auto;
		min-height: 0;
		padding: 1.25rem 1.5rem calc(env(safe-area-inset-bottom, 0px) + 1.25rem);
	}

	.step {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-height: 0;
		width: 100%;
		max-width: 30rem;
		margin: 0 auto;
	}

	.step-copy {
		display: flex;
		flex: 0 0 auto;
		flex-direction: column;
		gap: 0.5rem;
	}

	.step-copy h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 8vw, 2.75rem);
		font-weight: 650;
		line-height: var(--leading-tight);
		letter-spacing: -0.035em;
		text-wrap: balance;
	}

	.step-copy p {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-14);
		line-height: var(--leading-normal);
	}

	.step-copy em {
		color: var(--laurel);
	}

	.card-stage {
		position: relative;
		flex: 1 1 auto;
		min-height: 22rem;
		margin-top: 1.1rem;
	}

	.shadow-card {
		position: absolute;
		inset: 1rem 0.9rem -0.2rem;
		z-index: 1;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--laurel) 8%, transparent), transparent),
			var(--bg-surface);
		opacity: 0.46;
		transform: rotate(-2deg);
	}

	.market-card {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-12);
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--text-base) 3%, transparent),
				transparent 42%
			),
			var(--bg-popover);
		box-shadow:
			var(--inset-hi-strong),
			0 18px 50px -18px rgba(0, 0, 0, 0.72);
		touch-action: none;
		user-select: none;
		cursor: grab;
		transition:
			transform 360ms cubic-bezier(0.2, 0.7, 0.2, 1),
			opacity 260ms var(--ease-vici);
		will-change: transform, opacity;
	}

	.market-card.dragging {
		cursor: grabbing;
		transition: none;
	}

	.market-card.flipped {
		touch-action: pan-y;
		cursor: default;
	}

	.market-card.committed,
	.market-card.exiting {
		pointer-events: none;
	}

	.market-head {
		display: flex;
		flex: 0 0 auto;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1rem 1.125rem 0.75rem;
		background:
			linear-gradient(155deg, rgba(226, 184, 66, 0.11), transparent 70%),
			color-mix(in srgb, var(--text-base) 2%, transparent);
		border-bottom: 1px solid var(--border-base);
	}

	.market-meta {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.market-meta .muted {
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.first-flag {
		margin-left: auto;
		color: var(--laurel);
		font-size: 0.65rem;
	}

	.market-head h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.25rem, 5.5vw, 1.75rem);
		font-weight: 650;
		line-height: var(--leading-snug);
		letter-spacing: var(--tracking-snug);
		text-wrap: balance;
	}

	.market-head p {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-13);
	}

	.art-slot {
		display: flex;
		flex: 1 1 auto;
		align-items: center;
		justify-content: center;
		min-height: 0;
		padding: clamp(0.55rem, 2vw, 0.85rem);
		border-bottom: 1px solid var(--border-base);
	}

	.art-slot :global(.flow-art-frame) {
		width: min(100%, 260px) !important;
		height: auto !important;
		aspect-ratio: 1;
	}

	.prob-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.625rem;
		padding: 0.875rem 1.125rem 0.5rem;
	}

	.prob-button {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		align-items: flex-start;
		padding: 0.75rem 0.875rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--text-base) 3%, transparent);
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
	}

	.prob-button.static {
		cursor: default;
	}

	.prob-button span {
		font-family: var(--font-display);
		font-size: var(--t-12);
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
	}

	.prob-button strong {
		font-size: var(--t-32);
		line-height: 1;
	}

	.prob-button.yes {
		align-items: flex-end;
		border-color: rgba(79, 211, 161, 0.2);
		color: var(--yes);
	}

	.prob-button.no {
		border-color: rgba(255, 107, 107, 0.2);
		color: var(--no);
	}

	.call-rail {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: space-between;
		padding: 0 1.125rem 0.875rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.edge-tint,
	.stamp {
		position: absolute;
		pointer-events: none;
	}

	.edge-tint {
		inset: 0;
		z-index: 5;
		border-radius: inherit;
		transition: opacity 100ms linear;
	}

	.edge-tint.yes {
		background: linear-gradient(270deg, rgba(79, 211, 161, 0.5), transparent 54%);
	}

	.edge-tint.no {
		background: linear-gradient(90deg, rgba(255, 107, 107, 0.5), transparent 54%);
	}

	.stamp {
		z-index: 6;
		top: 1.4rem;
		padding: 0.35rem 0.75rem;
		border: 2px solid currentColor;
		border-radius: var(--r-4);
		font-family: var(--font-display);
		font-size: var(--t-16);
		font-weight: 900;
		letter-spacing: 0.18em;
	}

	.stamp.yes {
		right: 1.4rem;
		color: var(--yes);
		transform: rotate(8deg);
	}

	.stamp.no {
		left: 1.4rem;
		color: var(--no);
		transform: rotate(-8deg);
	}

	.stamp.skip {
		top: 1.1rem;
		left: 50%;
		color: var(--text-base);
		background: rgba(14, 13, 11, 0.7);
		transform: translateX(-50%);
	}

	.coach {
		position: absolute;
		z-index: 8;
		top: 50%;
		right: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0 1rem;
		text-align: center;
		pointer-events: none;
		transition: opacity 180ms var(--ease-vici);
	}

	.coach-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.8rem;
		color: var(--parchment);
		font-family: var(--font-display);
		font-size: clamp(1.35rem, 6.5vw, 2rem);
		font-weight: 700;
		line-height: var(--leading-snug);
		text-shadow:
			0 1px 10px rgba(0, 0, 0, 0.42),
			0 0 22px rgba(0, 0, 0, 0.28);
	}

	.coach-row.vertical {
		flex-direction: column;
		gap: 0.35rem;
	}

	.coach p {
		margin: 0.4rem 0 0;
		color: var(--parchment-dim);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.coach-arrow {
		font-size: 1.4em;
		font-weight: 400;
	}

	.coach-arrow.yes,
	em.yes {
		color: var(--yes);
	}

	.coach-arrow.no,
	em.no {
		color: var(--no);
	}

	.coach-arrow.up,
	em.acc {
		color: var(--laurel);
	}

	.coach-dot {
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 999px;
		background: var(--laurel);
		box-shadow: 0 0 0 0 rgba(226, 184, 66, 0.6);
		animation: coach-tap 1.5s ease-in-out infinite;
	}

	.celebration {
		position: absolute;
		z-index: 9;
		top: 50%;
		left: 50%;
		display: grid;
		width: 17.5rem;
		height: 17.5rem;
		place-items: center;
		opacity: 0;
		pointer-events: none;
		transform: translate(-50%, -50%) scale(0.9);
		transition: opacity var(--d-state) var(--ease-vici);
	}

	.celebration.fire {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1);
	}

	.rings,
	.sparks {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
	}

	.rings span {
		position: absolute;
		width: 7rem;
		height: 7rem;
		border: 1.5px solid var(--laurel);
		border-radius: 999px;
		opacity: 0;
	}

	.celebration.fire .rings span {
		animation: ring-pulse 1500ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}

	.celebration.fire .rings span:nth-child(2) {
		animation-delay: 220ms;
	}

	.celebration.fire .rings span:nth-child(3) {
		animation-delay: 440ms;
	}

	.sparks span {
		position: absolute;
		width: 4px;
		height: 4px;
		border-radius: 999px;
		background: var(--laurel);
		opacity: 0;
		transform: rotate(var(--spark-rotation)) translateY(-3rem);
	}

	.celebration.fire .sparks span {
		animation: spark-out 1000ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
		animation-delay: calc(80ms + var(--spark-index) * 24ms);
	}

	.celebration-copy {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		text-align: center;
		filter: drop-shadow(0 8px 22px rgba(0, 0, 0, 0.55));
	}

	.celebration-copy strong {
		color: var(--laurel);
		font-size: var(--t-32);
		line-height: 1;
	}

	.celebration-copy .num {
		color: var(--parchment);
		font-size: 2.35rem;
		font-weight: 800;
	}

	.celebration-copy small {
		color: var(--laurel);
		font-size: var(--t-14);
		letter-spacing: var(--tracking-allcaps);
	}

	.practice-card {
		perspective: 1200px;
	}

	.card-face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: inherit;
		transition: opacity 180ms var(--ease-vici);
	}

	.card-face.front {
		opacity: 1;
	}

	.card-face.back {
		z-index: 4;
		border-radius: inherit;
		background:
			linear-gradient(180deg, rgba(226, 184, 66, 0.1), transparent 52%), var(--bg-popover);
		opacity: 0;
		pointer-events: none;
	}

	.practice-card.flipped .card-face.front {
		opacity: 0;
		pointer-events: none;
	}

	.practice-card.flipped .card-face.back {
		opacity: 1;
		pointer-events: auto;
	}

	.depth-head,
	.depth-body {
		padding: 1rem 1.125rem;
	}

	.depth-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--border-base);
	}

	.depth-body {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 1rem;
		overflow-y: auto;
		touch-action: pan-y;
		overscroll-behavior: contain;
	}

	.depth-body h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-20);
		line-height: var(--leading-snug);
	}

	.depth-body p {
		margin: 0.25rem 0 0;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-normal);
	}

	.depth-body small {
		display: block;
		margin-top: 0.4rem;
		color: var(--text-muted);
		font-size: 0.68rem;
	}

	.consensus-bar {
		overflow: hidden;
		height: 0.35rem;
		margin-top: 0.5rem;
		border-radius: var(--r-pill);
		background: var(--no-wash);
	}

	.consensus-bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--yes);
	}

	.tap-return {
		margin-top: auto;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-align: center;
		text-transform: uppercase;
	}

	.done-panel {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		text-align: center;
	}

	.done-panel ul {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.done-panel li {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		color: var(--text-base);
		font-weight: 650;
	}

	.done-panel :global(.done-check) {
		padding: 0.2rem;
		border-radius: 999px;
		background: var(--yes-wash);
		color: var(--yes);
		box-sizing: content-box;
	}

	.done-panel p {
		margin: 0;
		color: var(--laurel);
		font-size: var(--t-20);
	}

	.category-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.category-tile {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		min-height: 5.25rem;
		padding: 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--text-base) 3%, transparent), transparent),
			var(--bg-surface);
		color: var(--text-muted);
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--d-state) var(--ease-vici),
			background var(--d-state) var(--ease-vici),
			color var(--d-state) var(--ease-vici);
	}

	.category-tile :global(.flow-art-frame) {
		width: 3.5rem !important;
		height: 3.5rem !important;
		border-radius: var(--r-8);
	}

	.category-tile span {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.category-tile strong {
		color: inherit;
		font-size: var(--t-14);
	}

	.category-tile small {
		color: var(--text-muted);
		font-size: 0.72rem;
		line-height: var(--leading-snug);
	}

	.category-tile.selected {
		border-color: color-mix(in srgb, var(--cat-color), transparent 52%);
		background:
			radial-gradient(
				circle at 18% 18%,
				color-mix(in srgb, var(--cat-color) 18%, transparent),
				transparent 56%
			),
			color-mix(in srgb, var(--cat-color), transparent 92%);
		color: var(--text-base);
	}

	.category-count {
		margin-top: 0.75rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.category-count.ready {
		color: var(--laurel);
	}

	.deck-preview {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		margin-top: 0.85rem;
		padding: 0.85rem;
		border: 1px solid rgba(226, 184, 66, 0.24);
		border-radius: var(--r-12);
		background:
			linear-gradient(180deg, rgba(226, 184, 66, 0.08), rgba(226, 184, 66, 0.03)), var(--bg-surface);
		animation: preview-in 260ms var(--ease-vici) both;
	}

	.deck-preview > div {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.55rem;
	}

	.deck-preview article {
		min-width: 0;
	}

	.deck-preview :global(.flow-art-frame) {
		width: 100% !important;
		height: auto !important;
		aspect-ratio: 1;
		border-radius: var(--r-8);
	}

	.deck-preview p {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
		margin: 0.35rem 0 0;
		color: var(--text-muted);
		font-size: 0.72rem;
		line-height: var(--leading-snug);
	}

	.step-identity {
		overflow-y: auto;
		padding-bottom: 0.25rem;
	}

	.starter-pack {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		margin-top: 1rem;
		padding: 1.05rem;
		border: 1px solid rgba(226, 184, 66, 0.38);
		border-radius: var(--r-12);
		background:
			radial-gradient(circle at 82% 12%, rgba(226, 184, 66, 0.2), transparent 45%),
			linear-gradient(155deg, rgba(226, 184, 66, 0.15), rgba(226, 184, 66, 0.03));
		box-shadow:
			var(--inset-hi-strong),
			0 16px 44px -28px color-mix(in srgb, var(--laurel) 72%, transparent);
	}

	.pack-top,
	.pack-xp,
	.starter-pack li,
	.social-proof {
		display: flex;
		align-items: center;
	}

	.pack-top,
	.starter-pack li {
		justify-content: space-between;
	}

	.pack-top :global(.pack-spark) {
		color: var(--laurel);
	}

	.pack-gift {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.35rem 0.45rem;
		border-radius: var(--r-8);
		background: var(--laurel);
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.08em;
	}

	.pack-gift :global(.pack-spark) {
		color: currentColor;
	}

	.pack-xp {
		gap: 0.55rem;
	}

	.pack-xp strong {
		color: var(--laurel);
		font-size: var(--t-44);
		line-height: 1;
	}

	.pack-xp span {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-12);
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
	}

	.starter-pack ul {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin: 0;
		padding: 0.75rem 0 0;
		border-top: 1px solid rgba(226, 184, 66, 0.18);
		list-style: none;
	}

	.starter-pack li {
		gap: 0.5rem;
		font-size: var(--t-13);
	}

	.starter-pack li::before {
		color: var(--laurel);
		font-family: var(--font-mono);
		font-weight: 800;
		content: '+';
	}

	.starter-pack small {
		margin-left: auto;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: var(--tracking-wide);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin-top: 0.75rem;
		padding: 0.85rem 0.9rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--text-base) 3%, transparent);
	}

	.field:focus-within {
		border-color: color-mix(in srgb, var(--laurel) 48%, transparent);
		background: color-mix(in srgb, var(--laurel) 5%, transparent);
	}

	.field.field-invalid,
	.field.field-invalid:focus-within {
		border-color: color-mix(in srgb, var(--no) 55%, transparent);
		background: color-mix(in srgb, var(--no) 6%, transparent);
	}

	.field input {
		width: 100%;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--text-base);
		font: inherit;
	}

	.handle-row {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
		color: var(--text-muted);
		transition: color var(--d-state) var(--ease-vici);
	}

	.handle-row.invalid {
		color: var(--no);
	}

	.handle-row.shake {
		animation: handle-shake var(--shake-duration, 480ms) cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}

	@keyframes handle-shake {
		10%,
		90% {
			transform: translateX(-2px);
		}
		20%,
		80% {
			transform: translateX(4px);
		}
		30%,
		50%,
		70% {
			transform: translateX(-7px);
		}
		40%,
		60% {
			transform: translateX(7px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.handle-row.shake {
			animation: none;
		}
	}

	.handle-row input {
		font-family: var(--font-mono);
		font-size: var(--t-20);
		font-weight: 700;
	}

	.field small {
		color: var(--text-muted);
		font-size: 0.68rem;
		line-height: var(--leading-normal);
	}

	.field small.warning {
		color: var(--no);
	}

	.field small.ok {
		color: var(--yes);
	}

	.social-proof {
		justify-content: center;
		gap: 0.6rem;
		margin: 0.9rem 0 0.75rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.social-proof strong {
		color: var(--text-base);
	}

	.avatars {
		display: inline-flex;
	}

	.avatars i {
		width: 1.125rem;
		height: 1.125rem;
		border: 2px solid var(--bg-base);
		border-radius: 999px;
		background: linear-gradient(135deg, oklch(0.45 0.08 245), oklch(0.27 0.05 245));
	}

	.avatars i:not(:first-child) {
		margin-left: -0.4rem;
	}

	.avatars i:nth-child(2) {
		background: linear-gradient(135deg, oklch(0.48 0.1 310), oklch(0.29 0.06 310));
	}

	.avatars i:nth-child(3) {
		background: linear-gradient(135deg, oklch(0.52 0.11 45), oklch(0.32 0.07 45));
	}

	.primary-action {
		width: 100%;
		margin-top: auto;
		padding: 0.95rem 1.2rem;
		border: 0;
		border-radius: var(--r-12);
		background: var(--laurel);
		color: var(--ink);
		font-family: var(--font-display);
		font-size: var(--t-16);
		font-weight: 750;
		cursor: pointer;
		box-shadow: var(--inset-hi-strong);
		transition:
			transform var(--d-hover) var(--ease-vici),
			opacity var(--d-state) var(--ease-vici);
	}

	.primary-action:active {
		transform: scale(0.985);
	}

	.primary-action.disabled-look {
		opacity: 0.45;
		cursor: default;
	}

	@keyframes coach-tap {
		0%,
		100% {
			transform: scale(1);
			box-shadow: 0 0 0 0 rgba(226, 184, 66, 0.6);
		}
		50% {
			transform: scale(1.18);
			box-shadow: 0 0 0 8px rgba(226, 184, 66, 0);
		}
	}

	@keyframes ring-pulse {
		0% {
			opacity: 0;
			transform: scale(0.4);
		}
		30% {
			opacity: 0.85;
		}
		100% {
			opacity: 0;
			transform: scale(2.4);
		}
	}

	@keyframes spark-out {
		0% {
			opacity: 0;
			transform: rotate(var(--spark-rotation)) translateY(-1.25rem) scale(0.6);
		}
		35% {
			opacity: 1;
			transform: rotate(var(--spark-rotation)) translateY(-5rem) scale(1.1);
		}
		100% {
			opacity: 0;
			transform: rotate(var(--spark-rotation)) translateY(-7.5rem) scale(0.5);
		}
	}

	@keyframes preview-in {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (min-width: 768px) {
		.step-frame {
			padding-top: 1.75rem;
		}

		.card-stage {
			min-height: 28rem;
		}

		.category-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-height: 690px) {
		.step-copy h1 {
			font-size: clamp(1.65rem, 7vw, 2.15rem);
		}

		.card-stage {
			margin-top: 0.75rem;
			min-height: 19rem;
		}

		.market-head {
			padding: 0.8rem 1rem 0.65rem;
		}

		.prob-button strong {
			font-size: var(--t-24);
		}

		.art-slot {
			padding: 0.5rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			animation-duration: 1ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 1ms !important;
		}
	}
</style>
