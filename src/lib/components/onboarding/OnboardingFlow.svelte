<script lang="ts">
	import { Check, Sparkles } from 'lucide-svelte';
	import { onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import FlowArtFrame from '$lib/components/artwork/FlowArtFrame.svelte';
	import { MIN_NICKNAME_LENGTH } from '$lib/constants/profile.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { categoryColor } from '$lib/utils/category-color.utils';
	import { FLOW_ART_CATEGORIES, type FlowArtCategory } from '$lib/utils/flow-art.utils';
	import { haptic } from '$lib/utils/haptics.utils';

	interface OnboardingResult {
		handle: string;
		interests: string[];
		email?: string;
	}

	interface Props {
		onComplete: (result: OnboardingResult) => void;
		onSignIn?: () => void;
	}

	interface OnboardingMarket {
		id: string;
		category: FlowArtCategory;
		title: string;
		subtitle: string;
		yesProbability: number;
		calls: string;
		days: number;
		resolution: string;
		source: string;
	}

	interface CategoryOption {
		id: FlowArtCategory;
		label: string;
		feedLine: string;
	}

	type CallSide = 'YES' | 'NO';

	const { onComplete, onSignIn }: Props = $props();

	const firstCallAdvance_ms = 2_400;
	const firstCallCelebrate_ms = 280;
	const starterPackAnimation_ms = 720;

	const markets = [
		{
			id: 'fed-jun',
			category: 'macro',
			title: 'Will the Fed cut rates in June?',
			subtitle: 'FOMC · rate-cut call',
			yesProbability: 0.64,
			calls: '2.4M',
			days: 47,
			resolution: 'Resolves YES if the FOMC announces any rate cut at the June meeting.',
			source: 'Federal Reserve press release'
		},
		{
			id: 'btc-150k',
			category: 'crypto',
			title: 'Will BTC close above $150K by year-end?',
			subtitle: 'Spot price · 7d +4.2%',
			yesProbability: 0.38,
			calls: '8.1M',
			days: 228,
			resolution: 'Resolves YES if BTC closes above $150,000 at the year-end spot close.',
			source: 'Coinbase Spot close'
		},
		{
			id: 'gpt6-2026',
			category: 'tech',
			title: 'Will OpenAI release GPT-6 before Q4?',
			subtitle: 'Model-release window',
			yesProbability: 0.22,
			calls: '620K',
			days: 135,
			resolution: 'Resolves YES if a model named GPT-6 is publicly released before Q4.',
			source: 'Public release announcement'
		},
		{
			id: 'eu-ai-act',
			category: 'politics',
			title: 'Will the EU pass the AI Liability Act this session?',
			subtitle: 'Council vote pending',
			yesProbability: 0.55,
			calls: '410K',
			days: 58,
			resolution: 'Resolves YES if the Council passes the act in the current session.',
			source: 'EU Council vote record'
		},
		{
			id: 'sb-niners',
			category: 'sports',
			title: 'Will the 49ers win the Super Bowl?',
			subtitle: 'Season market',
			yesProbability: 0.31,
			calls: '1.8M',
			days: 266,
			resolution: 'Resolves YES if San Francisco wins the championship game.',
			source: 'Official league result'
		},
		{
			id: 'taylor-tour',
			category: 'culture',
			title: 'Will Taylor Swift announce a 2027 tour by August?',
			subtitle: 'Artist announcement watch',
			yesProbability: 0.48,
			calls: '380K',
			days: 106,
			resolution: 'Resolves YES if a 2027 tour is officially announced before September.',
			source: 'Official artist announcement'
		}
	] satisfies readonly [OnboardingMarket, OnboardingMarket, ...OnboardingMarket[]];

	const categoryOptions: readonly CategoryOption[] = [
		{ id: 'macro', label: 'Macro', feedLine: 'Rates, GDP, inflation' },
		{ id: 'crypto', label: 'Crypto', feedLine: 'BTC, ETH, on-chain signals' },
		{ id: 'politics', label: 'Politics', feedLine: 'Elections, policy, courts' },
		{ id: 'tech', label: 'Tech', feedLine: 'AI, chips, platform shifts' },
		{ id: 'sports', label: 'Sports', feedLine: 'Leagues, finals, roster moves' },
		{ id: 'culture', label: 'Culture', feedLine: 'Tours, film, media moments' }
	];

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

	const queuedTimeouts: ReturnType<typeof setTimeout>[] = [];

	const [firstMarket, practiceMarket] = markets;
	const progressWidth = $derived(`${((step + 1) / 4) * 100}%`);
	const progressLatin = $derived(step === 0 ? 'Veni.' : step === 3 ? 'Vici.' : '');
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
			.filter((market): market is OnboardingMarket => market !== undefined)
			.slice(0, 3)
	);
	const cleanEmail = $derived(email.trim().toLowerCase());
	const emailLooksValid = $derived(cleanEmail.length === 0 || /\S+@\S+\.\S+/.test(cleanEmail));
	const canSubmitIdentity = $derived(handle.length >= MIN_NICKNAME_LENGTH);

	$effect(() => {
		if (step !== 3) {
			return;
		}

		let animationFrame = 0;
		const start = performance.now();

		const tick = (now: number) => {
			const progress = Math.min(1, (now - start) / starterPackAnimation_ms);
			const eased = 1 - Math.pow(1 - progress, 3);
			starterXp = Math.round(eased * 1_000);

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
	});

	const queueTimeout = ({ callback, delay_ms }: { callback: () => void; delay_ms: number }) => {
		const timeout = setTimeout(callback, delay_ms);
		queuedTimeouts.push(timeout);
	};

	const formatProbability = (probability: number): string => `${Math.round(probability * 100)}%`;

	const noProbability = (market: OnboardingMarket): number => 1 - market.yesProbability;

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
		}
	};

	const updateEmail = (event: Event) => {
		if (event.currentTarget instanceof HTMLInputElement) {
			email = event.currentTarget.value;
		}
	};

	const complete = () => {
		if (!canSubmitIdentity || submitting) {
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
			<span>Have an account?</span>
			<button onclick={onSignIn} type="button">Sign in →</button>
		</div>
	{/if}

	<header class="progress-head">
		<div class="progress-meta">
			<span class="serif-italic latin">{progressLatin}</span>
			<span class="num step-count">Step {step + 1} of 4</span>
		</div>
		<div class="progress-track" aria-hidden="true">
			<div style:width={progressWidth} class="progress-fill"></div>
		</div>
	</header>

	<main class="step-frame">
		{#if step === 0}
			<section class="step step-first" aria-labelledby="first-call-title">
				<div class="step-copy">
					<p class="eyebrow">First call</p>
					<h1 id="first-call-title">Make your first call.</h1>
				</div>

				<div class="card-stage">
					<div class="shadow-card" aria-hidden="true"></div>
					<div
						style:opacity={firstCommitted ? 0 : 1}
						style:transform="translate3d({firstDragX}px, {firstDragY}px, 0) rotate({firstRotation}deg)"
						class="market-card {firstDragging ? 'dragging' : ''} {firstCommitted !== null
							? 'committed'
							: ''}"
						aria-label="Swipe right for YES or left for NO"
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
									{firstMarket.category}
								</span>
								<span class="num muted">{firstMarket.days}d</span>
								<span class="allcaps first-flag">FIRST CALL</span>
							</div>
							<h2>{firstMarket.title}</h2>
							<p>{firstMarket.subtitle}</p>
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
								<span>NO</span>
								<strong class="num">{formatProbability(noProbability(firstMarket))}</strong>
							</button>
							<button
								class="prob-button yes"
								onclick={() => commitFirstCall('YES')}
								onpointerdown={stopPointer}
								type="button"
							>
								<span>YES</span>
								<strong class="num">{formatProbability(firstMarket.yesProbability)}</strong>
							</button>
						</div>

						<div class="call-rail">
							<span>← NO</span>
							<span>{firstMarket.calls} calls</span>
							<span>YES →</span>
						</div>

						<div style:opacity={Math.min(firstYesOpacity, 1)} class="edge-tint yes"></div>
						<div style:opacity={Math.min(firstNoOpacity, 1)} class="edge-tint no"></div>
						<span style:opacity={Math.min(firstYesOpacity, 1)} class="stamp yes">YES</span>
						<span style:opacity={Math.min(firstNoOpacity, 1)} class="stamp no">NO</span>
					</div>

					<div style:opacity={firstCoachOpacity} class="coach" aria-hidden={!firstCoachVisible}>
						<div class="coach-row">
							<span class="coach-arrow no">←</span>
							<span>
								Swipe <em class="serif-italic no">left</em> or
								<em class="serif-italic yes">right</em>
							</span>
							<span class="coach-arrow yes">→</span>
						</div>
						<p>Right for YES · left for NO</p>
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
							<span class="allcaps">FIRST CALL</span>
							<strong class="serif-italic">Called it.</strong>
							<span class="num">+50 <small>XP</small></span>
						</div>
					</div>
				</div>
			</section>
		{:else if step === 1}
			<section class="step step-gestures" aria-labelledby="gestures-title">
				<div class="step-copy">
					<p class="eyebrow">Gestures</p>
					<h1 id="gestures-title">There's more than yes and no.</h1>
				</div>

				{#if practicePhase === 'done'}
					<div class="done-panel" aria-live="polite">
						<span class="eyebrow">Two gestures learned.</span>
						<ul>
							<li>
								<Check class="done-check" aria-hidden="true" size={15} strokeWidth={2.5} />
								Tap for details
							</li>
							<li>
								<Check class="done-check" aria-hidden="true" size={15} strokeWidth={2.5} />
								Swipe to skip
							</li>
						</ul>
						<p class="serif-italic">You're ready for Flow.</p>
					</div>
					<button
						class="primary-action"
						data-tid={TestId.OnboardingPrimary}
						onclick={() => (step = 2)}
						type="button"
					>
						Got it
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
							aria-label={practicePhase === 'flip' ? 'Tap to show details' : 'Swipe up to skip'}
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
											{practiceMarket.category}
										</span>
										<span class="num muted">{practiceMarket.days}d</span>
									</div>
									<h2>{practiceMarket.title}</h2>
									<p>{practiceMarket.subtitle}</p>
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
										<span>NO</span>
										<strong class="num">{formatProbability(noProbability(practiceMarket))}</strong>
									</div>
									<div class="prob-button yes static">
										<span>YES</span>
										<strong class="num">{formatProbability(practiceMarket.yesProbability)}</strong>
									</div>
								</div>
							</div>

							<div class="card-face back" aria-hidden={!practiceFlipped}>
								<div class="depth-head">
									<span style:color={categoryColor(practiceMarket.category)} class="allcaps">
										{practiceMarket.category}
									</span>
									<span class="eyebrow">Depth</span>
								</div>
								<div class="depth-body">
									<h2>{practiceMarket.title}</h2>
									<div>
										<span class="eyebrow">Resolution</span>
										<p>{practiceMarket.resolution}</p>
										<small class="num">Source: {practiceMarket.source}</small>
									</div>
									<div>
										<span class="eyebrow">Consensus</span>
										<div class="consensus-bar">
											<i style:width={formatProbability(practiceMarket.yesProbability)}></i>
										</div>
										<p>
											YES sits at
											<strong class="num">{formatProbability(practiceMarket.yesProbability)}</strong
											>.
										</p>
									</div>
									<div class="tap-return">Tap to return</div>
								</div>
							</div>

							<span style:opacity={Math.min(practiceSkipOpacity, 1)} class="stamp skip">SKIP</span>
						</div>

						<div style:opacity={practiceCoachOpacity} class="coach coach-practice">
							{#if practicePhase === 'flip'}
								<div class="coach-row">
									<span class="coach-dot" aria-hidden="true"></span>
									<span>
										Tap to show <em class="serif-italic acc">details.</em>
									</span>
								</div>
								<p>Then tap again to return</p>
							{:else}
								<div class="coach-row vertical">
									<span class="coach-arrow up">↑</span>
									<span>
										Swipe <em class="serif-italic acc">up</em> to skip.
									</span>
								</div>
								<p>Not your call? Pass without scoring.</p>
							{/if}
						</div>
					</div>
				{/if}
			</section>
		{:else if step === 2}
			<section class="step step-categories" aria-labelledby="categories-title">
				<div class="step-copy">
					<p class="eyebrow">Categories</p>
					<h1 id="categories-title">What do you want to predict?</h1>
					<p>Pick 3 or more. We'll seed your Flow with the markets that matter.</p>
				</div>

				<div class="category-grid">
					{#each categoryOptions as category (category.id)}
						{@const selected = interests.has(category.id)}
						<button
							style:--cat-color={categoryColor(category.id)}
							class={selected ? 'category-tile selected' : 'category-tile'}
							aria-pressed={selected}
							data-tid={TestId.OnboardingInterest}
							onclick={() => toggleInterest(category.id)}
							type="button"
						>
							<FlowArtFrame category={category.id} seed={`category-${category.id}`} size={64} />
							<span>
								<strong>{category.label}</strong>
								<small>{category.feedLine}</small>
							</span>
						</button>
					{/each}
				</div>

				<div class="category-count {selectedInterestCount >= 3 ? 'ready' : ''}">
					{selectedInterestCount >= 3
						? `${selectedInterestCount} selected - your Flow is ready`
						: `${selectedInterestCount} of ${FLOW_ART_CATEGORIES.length} selected`}
				</div>

				{#if selectedInterestCount >= 3}
					<div class="deck-preview" aria-live="polite">
						<span class="eyebrow">Your first deck</span>
						<div>
							{#each previewMarkets as market (market.id)}
								<article>
									<FlowArtFrame category={market.category} seed={market.id} size={52} />
									<p>{market.title}</p>
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
					{selectedInterestCount >= 3 ? 'Continue' : 'Pick 3 to continue'}
				</button>
			</section>
		{:else}
			<section class="step step-identity" aria-labelledby="identity-title">
				<div class="step-copy">
					<p class="serif-italic latin">Vici.</p>
					<h1 id="identity-title">
						One name. <em class="serif-italic">Earned, not given.</em>
					</h1>
					<p>This is the name on the leaderboard.</p>
				</div>

				<div class="starter-pack">
					<div class="pack-top">
						<span class="eyebrow">Starter pack</span>
						<Sparkles class="pack-spark" aria-hidden="true" size={18} strokeWidth={2} />
					</div>
					<div class="pack-xp">
						<strong class="num">{starterXp.toLocaleString()}</strong>
						<span>VXP</span>
					</div>
					<ul>
						<li><span>10 starter markets</span><small>seeded</small></li>
						<li><span>3-day streak grace</span><small>forgiveness</small></li>
						{#if firstCallSide}
							<li><span>First-call bonus</span><small>+50 banked</small></li>
						{/if}
					</ul>
				</div>

				<label class="field">
					<span class="eyebrow">Your handle</span>
					<span class="handle-row">
						<span aria-hidden="true">@</span>
						<input
							data-tid={TestId.OnboardingHandleInput}
							inputmode="text"
							maxlength="16"
							oninput={updateHandle}
							placeholder="tacitus"
							spellcheck="false"
							type="text"
							value={handle}
						/>
					</span>
					<small class="num">
						{handle ? `vici.app/${handle}` : 'a-z, 0-9, dot or underscore'}
					</small>
				</label>

				<label class="field">
					<span class="eyebrow">Email (optional)</span>
					<input
						data-tid={TestId.OnboardingEmailInput}
						oninput={updateEmail}
						placeholder="you@email.com"
						type="email"
						value={email}
					/>
					<small class={emailLooksValid ? 'num' : 'num warning'}>
						{emailLooksValid
							? 'Saved after sign-in. Never required to continue.'
							: 'Email is optional; you can continue without it.'}
					</small>
				</label>

				<div class="social-proof">
					<span class="avatars" aria-hidden="true"><i></i><i></i><i></i></span>
					<span>Join <strong class="num">184,210</strong> predictors</span>
				</div>

				<button
					class="primary-action {!canSubmitIdentity || submitting ? 'disabled-look' : ''}"
					data-tid={TestId.OnboardingPrimary}
					disabled={!canSubmitIdentity || submitting}
					onclick={complete}
					type="button"
				>
					{submitting ? 'Entering...' : 'Enter VICI →'}
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
		background: var(--border-base);
	}

	.progress-fill {
		height: 100%;
		border-radius: inherit;
		background: var(--laurel);
		transition: width var(--d-enter) var(--ease-vici);
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
		gap: 0.45rem;
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
		margin-top: 1rem;
	}

	.shadow-card {
		position: absolute;
		inset: 1rem 0.75rem -0.25rem;
		z-index: 1;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
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
		background: var(--bg-popover);
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
		background: linear-gradient(155deg, rgba(226, 184, 66, 0.08), transparent 70%);
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
		padding: 0.75rem;
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
		background: var(--bg-surface);
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

	.coach::before {
		position: absolute;
		z-index: -1;
		top: 50%;
		left: 50%;
		width: 92%;
		height: 12rem;
		border-radius: 999px;
		background: radial-gradient(ellipse, rgba(14, 13, 11, 0.78), rgba(14, 13, 11, 0));
		content: '';
		transform: translate(-50%, -50%);
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
		text-shadow: 0 1px 16px rgba(0, 0, 0, 0.4);
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
		gap: 0.7rem;
		margin-top: 1rem;
	}

	.category-tile {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		padding: 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
		color: var(--text-muted);
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--d-state) var(--ease-vici),
			background var(--d-state) var(--ease-vici),
			color var(--d-state) var(--ease-vici);
	}

	.category-tile :global(.flow-art-frame) {
		width: 3.25rem !important;
		height: 3.25rem !important;
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
		background: color-mix(in srgb, var(--cat-color), transparent 92%);
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
		background: rgba(226, 184, 66, 0.05);
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
		padding: 1rem;
		border: 1px solid rgba(226, 184, 66, 0.38);
		border-radius: var(--r-12);
		background:
			radial-gradient(circle at 82% 12%, rgba(226, 184, 66, 0.2), transparent 45%),
			linear-gradient(155deg, rgba(226, 184, 66, 0.15), rgba(226, 184, 66, 0.03));
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
		padding: 0.85rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
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
		background: linear-gradient(135deg, #3d5a85, #1e2c4d);
	}

	.avatars i:not(:first-child) {
		margin-left: -0.4rem;
	}

	.avatars i:nth-child(2) {
		background: linear-gradient(135deg, #7a4fb8, #3d1f66);
	}

	.avatars i:nth-child(3) {
		background: linear-gradient(135deg, #b5462c, #6f1c20);
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
