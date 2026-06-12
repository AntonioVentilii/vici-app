<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { RefreshCw } from '@lucide/svelte/icons';
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import OnboardingStepTracker from '$lib/components/onboarding/OnboardingStepTracker.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import { HANDLE_POOL } from '$lib/constants/handle-pool.constants';
	import {
		MAX_NICKNAME_LENGTH,
		MIN_NICKNAME_LENGTH,
		NICKNAME_PATTERN,
		sanitizeNickname
	} from '$lib/constants/profile.constants';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { checkNicknameAvailability } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding · Beat 2 — claim a handle.
	 *
	 * Two-mode picker: pool (random BIP-39 word suggestions, refreshable)
	 * and custom (free-form input). The pool samples from `HANDLE_POOL`
	 * (2048 BIP-39 English words) and pre-filters each draw through the
	 * satellite `checkNicknameAvailability` query so taken handles never
	 * surface in the grid. A final claim-time re-check closes the TOCTOU
	 * window between display and submit.
	 *
	 * Emits `onAdvance(handle | null)` — `null` covers the "Pick later"
	 * skip path.
	 */
	interface Props {
		participantId: string | null;
		onAdvance: (handle: string | null) => void;
		onBack: () => void;
	}

	const { participantId, onAdvance, onBack }: Props = $props();

	// Number of suggestion chips rendered per draw. Kept deliberately
	// small and curated — the live-availability sampling below still runs
	// the full probe loop, but only this many chips surface in the grid.
	const SUGGESTIONS_PER_DRAW = 6;
	// Over-sample multiplier — draw 2× the target count and keep the
	// first N that come back available, so a handful of collisions
	// don't leave the grid sparse.
	const OVERSAMPLE_FACTOR = 2;
	// Bound the retry loop so a pathological run (satellite errors,
	// saturated pool) can't spin forever. One pass is enough in practice
	// — the pool is 2048 words against a far smaller claimed set.
	const MAX_RESHUFFLE_ATTEMPTS = 3;

	type Mode = 'pool' | 'custom';
	let mode = $state<Mode>('pool');
	let poolPick: string | null = $state(null);
	let custom: string = $state('');

	// Live availability probe for the custom input. Pool draws are already
	// pre-filtered at display time, so only the free-form path needs it.
	type LiveAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'failed';
	let liveAvailability = $state<LiveAvailability>('idle');
	let checkToken = 0;
	let checkTimer: ReturnType<typeof setTimeout> | undefined;
	const CHECK_DEBOUNCE_MS = 350;

	// Suggestions shown in the pool grid — replaced on every `reshuffle`.
	let sampled: string[] = $state([]);
	let isReshuffling = $state(false);
	// `true` while the claim-time availability re-check is in flight.
	let isClaiming = $state(false);
	// Set when the claim-time re-check finds the selected handle was
	// claimed between display and submit. Cleared on the next selection
	// change.
	let claimError = $state<'taken' | null>(null);
	// Handles the satellite confirmed as taken during this session —
	// sourced from pre-display sampling and claim-time re-checks. Used
	// to mark chips as taken without re-querying when the user retries.
	const sessionTaken = new SvelteSet<string>();

	/**
	 * Fisher–Yates partial shuffle — returns `count` unique words from
	 * `HANDLE_POOL` without mutating the source. `Math.random` is fine:
	 * these are cosmetic suggestions, not key material.
	 */
	const sampleFromPool = (count: number): string[] => {
		const target = Math.min(count, HANDLE_POOL.length);
		const indices = Array.from({ length: HANDLE_POOL.length }, (_, i) => i);

		for (let i = 0; i < target; i++) {
			const j = i + Math.floor(Math.random() * (indices.length - i));
			[indices[i], indices[j]] = [indices[j], indices[i]];
		}

		return indices.slice(0, target).map((i) => HANDLE_POOL[i]);
	};

	/**
	 * Draw a fresh batch of suggestions and pre-filter through the
	 * satellite availability query so taken handles never reach the
	 * grid. Falls back to the raw sample on probe failure — onboarding
	 * must remain offline-tolerant, and the claim-time re-check still
	 * guards the final commit.
	 */
	const reshuffle = async (): Promise<void> => {
		if (isReshuffling) {
			return;
		}

		isReshuffling = true;
		poolPick = null;
		claimError = null;

		try {
			const available: string[] = [];
			// Tracks which words we've already probed in this reshuffle
			// pass so retry draws don't re-check the same word. Uses
			// `SvelteSet` only because the project lint rule forbids
			// bare `Set` in component scope — this set is purely local.
			const seen = new SvelteSet<string>();

			for (
				let attempt = 0;
				attempt < MAX_RESHUFFLE_ATTEMPTS && available.length < SUGGESTIONS_PER_DRAW;
				attempt++
			) {
				const remaining = SUGGESTIONS_PER_DRAW - available.length;
				const draw = sampleFromPool(remaining * OVERSAMPLE_FACTOR).filter((w) => !seen.has(w));

				for (const w of draw) {
					seen.add(w);
				}

				const results = await Promise.all(
					draw.map(async (name) => {
						try {
							const res = await checkNicknameAvailability({ nickname: name });

							return { name, available: res.available };
						} catch (err) {
							console.warn(`Availability check failed for "${name}":`, err);

							// Optimistically include on probe failure — the
							// claim-time re-check is the real gate.
							return { name, available: true };
						}
					})
				);

				for (const r of results) {
					if (r.available) {
						if (available.length < SUGGESTIONS_PER_DRAW) {
							available.push(r.name);
						}
					} else {
						sessionTaken.add(r.name);
					}
				}
			}

			sampled = available;
		} finally {
			isReshuffling = false;
		}
	};

	onMount(() => {
		void reshuffle();
	});

	// Sanitised view of the free-form input — lowercased, with all
	// whitespace and out-of-charset characters stripped (no spaces can
	// survive in the middle). The input renders this cleaned value, so the
	// user never sees an invalid character stick, and it is what gets
	// probed and claimed.
	const customClean = $derived(sanitizeNickname(custom));
	const selectedName = $derived(mode === 'pool' ? (poolPick ?? '') : customClean);

	const onCustomInput = (event: Event) => {
		if (event.currentTarget instanceof HTMLInputElement) {
			custom = event.currentTarget.value;
		}
	};

	// Clear the claim-time error whenever the selection changes — stops
	// the "just got claimed" message from sticking around after the user
	// picks a different chip. `untrack` so the write doesn't loop.
	$effect(() => {
		void selectedName;
		untrack(() => {
			claimError = null;
		});
	});

	// Local format checks the live probe must clear before hitting the
	// satellite. Custom mode only — pool picks are pre-filtered.
	const customFormatValid = $derived(
		mode === 'custom' &&
			selectedName.length >= MIN_NICKNAME_LENGTH &&
			selectedName.length <= MAX_NICKNAME_LENGTH &&
			NICKNAME_PATTERN.test(selectedName)
	);

	// Debounced live probe. A monotonic token cancels the in-flight check
	// on each keystroke so stale results are dropped. Offline-tolerant: a
	// failure surfaces as `failed` but never blocks the claim — the
	// claim-time re-check and satellite assertion are the authority.
	$effect(() => {
		const candidate = selectedName;
		const probe = customFormatValid;

		if (checkTimer) {
			clearTimeout(checkTimer);
		}

		checkToken += 1;
		const token = checkToken;

		if (!probe) {
			liveAvailability = 'idle';

			return;
		}

		// Already confirmed taken this session — skip the round-trip.
		if (sessionTaken.has(candidate)) {
			liveAvailability = 'taken';

			return;
		}

		liveAvailability = 'checking';

		checkTimer = setTimeout(() => {
			void (async () => {
				try {
					const res = await checkNicknameAvailability({ nickname: candidate });

					if (token !== checkToken) {
						return;
					}

					if (res.available) {
						liveAvailability = 'available';
					} else {
						sessionTaken.add(candidate);
						liveAvailability = 'taken';
					}
				} catch (err) {
					if (token !== checkToken) {
						return;
					}

					console.warn(`Live availability check failed for "${candidate}":`, err);
					liveAvailability = 'failed';
				}
			})();
		}, CHECK_DEBOUNCE_MS);

		return () => {
			if (checkTimer) {
				clearTimeout(checkTimer);
			}
		};
	});

	interface Availability {
		// Whether the handle can be claimed.
		ok: boolean;
		// How to render the hint: confirmed-available (green), a hard error
		// (red), or a neutral in-between (probing / couldn't verify).
		tone: 'ok' | 'neutral' | 'error';
		reasonKey?: MessageKey;
	}

	const availability: Availability = $derived.by(() => {
		const name = selectedName;

		if (!name) {
			return { ok: false, tone: 'error' };
		}

		if (name.length < MIN_NICKNAME_LENGTH) {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.beat2.avail.too_short' };
		}

		if (name.length > MAX_NICKNAME_LENGTH) {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.beat2.avail.too_long' };
		}

		if (!NICKNAME_PATTERN.test(name)) {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.beat2.avail.invalid' };
		}

		if (claimError === 'taken') {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.beat2.avail.just_taken' };
		}

		if (sessionTaken.has(name)) {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.beat2.avail.taken' };
		}

		// Custom mode gates on the live probe: block while it's in flight,
		// reject a confirmed collision. On probe failure stay claimable but
		// neutral — never the green "Available", since it wasn't confirmed;
		// the claim-time re-check and satellite assertion are the authority.
		if (mode === 'custom') {
			if (liveAvailability === 'idle' || liveAvailability === 'checking') {
				return { ok: false, tone: 'neutral', reasonKey: 'onboarding.beat2.avail.checking' };
			}

			if (liveAvailability === 'taken') {
				return { ok: false, tone: 'error', reasonKey: 'onboarding.beat2.avail.taken' };
			}

			if (liveAvailability === 'failed') {
				return { ok: true, tone: 'neutral', reasonKey: 'onboarding.beat2.avail.check_failed' };
			}
		}

		return { ok: true, tone: 'ok' };
	});

	const canClaim = $derived(availability.ok && !isClaiming);

	const event = $derived($featuredEvent);
	const team = $derived(
		isNullish(participantId) ? undefined : event.participants.find((p) => p.id === participantId)
	);

	/**
	 * Run the final TOCTOU guard before advancing. Between pool sampling
	 * (or the user typing in custom mode) and the actual claim, another
	 * principal may have grabbed this handle. The satellite assertion
	 * would reject it at `setDoc` time anyway, but we re-check here for
	 * a cleaner inline error.
	 */
	const claim = async (): Promise<void> => {
		if (!availability.ok || !selectedName || isClaiming) {
			return;
		}

		isClaiming = true;

		try {
			const res = await checkNicknameAvailability({ nickname: selectedName });

			if (!res.available) {
				sessionTaken.add(selectedName);
				claimError = 'taken';

				return;
			}

			onAdvance(selectedName);
		} catch (err) {
			console.warn('Claim-time availability re-check failed:', err);
			// Fall through to advance — the satellite-side assertion is
			// the ultimate authority, and blocking on a transient probe
			// failure would strand the user.
			onAdvance(selectedName);
		} finally {
			isClaiming = false;
		}
	};
</script>

<div class="ob2-beat ob2-beat-2">
	<OnboardingStepTracker step={2} />

	<p class="ob2-sub ob2-sub-eyebrow">
		<span class="serif-italic acc">
			{t({ locale: $localeStore, key: 'onboarding.beat2.sub_accent' })}
		</span>
	</p>
	<h1 class="ob2-h1">{t({ locale: $localeStore, key: 'onboarding.beat2.title' })}</h1>
	<p class="ob2-sub">
		{t({ locale: $localeStore, key: 'onboarding.beat2.sub' })}
	</p>

	<div class="ob2-mode-tabs">
		<button
			class="ob2-mode-tab"
			class:active={mode === 'pool'}
			onclick={() => (mode = 'pool')}
			type="button"
		>
			{t({ locale: $localeStore, key: 'onboarding.beat2.mode_pool' })}
		</button>
		<button
			class="ob2-mode-tab"
			class:active={mode === 'custom'}
			onclick={() => (mode = 'custom')}
			type="button"
		>
			{t({ locale: $localeStore, key: 'onboarding.beat2.mode_custom' })}
		</button>
	</div>

	{#if mode === 'pool'}
		<div class="ob2-pool-header">
			<span class="ob2-pool-eyebrow">
				{t({ locale: $localeStore, key: 'onboarding.beat2.pool_eyebrow' })}
			</span>
			<button
				class="ob2-pool-refresh"
				class:spinning={isReshuffling}
				aria-label={t({ locale: $localeStore, key: 'onboarding.beat2.refresh_aria' })}
				disabled={isReshuffling}
				onclick={() => void reshuffle()}
				type="button"
			>
				<RefreshCw size={14} />
			</button>
		</div>
		<div class="ob2-pool-grid" aria-busy={isReshuffling}>
			{#if isReshuffling && sampled.length === 0}
				{#each Array.from({ length: SUGGESTIONS_PER_DRAW }) as _, i (i)}
					<span class="ob2-pool-chip ob2-pool-chip-skeleton" aria-hidden="true"></span>
				{/each}
			{:else}
				{#each sampled as name (name)}
					{@const taken = sessionTaken.has(name)}
					{@const picked = poolPick === name}
					<button
						class="ob2-pool-chip"
						class:picked
						class:taken
						aria-disabled={taken}
						aria-pressed={picked}
						disabled={taken}
						onclick={() => !taken && (poolPick = name)}
						type="button"
					>
						<span class="ob2-at">@</span>{name}
						{#if taken}
							<span class="ob2-pool-taken">
								{t({ locale: $localeStore, key: 'onboarding.beat2.pool_taken' })}
							</span>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	{:else}
		<div class="ob2-custom-input-wrap">
			<span class="ob2-at-large">@</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="ob2-custom-input"
				autocapitalize="off"
				autocomplete="off"
				autofocus
				maxlength={MAX_NICKNAME_LENGTH}
				oninput={onCustomInput}
				placeholder={t({ locale: $localeStore, key: 'onboarding.beat2.placeholder' })}
				spellcheck="false"
				type="text"
				value={customClean}
			/>
		</div>
	{/if}

	{#if selectedName}
		<div
			class="ob2-avail"
			class:checking={availability.tone === 'neutral'}
			class:no={availability.tone === 'error'}
			class:ok={availability.tone === 'ok'}
			aria-live="polite"
		>
			{#if availability.tone === 'ok'}
				{t({ locale: $localeStore, key: 'onboarding.beat2.avail_ok_prefix' })}
				<span class="serif-italic">@{selectedName}</span>
			{:else if availability.reasonKey}
				{t({ locale: $localeStore, key: availability.reasonKey })}
			{/if}
		</div>
	{/if}

	{#if team}
		{@const teamColor = team.color ?? 'var(--laurel)'}
		<div class="ob2-affil-preview">
			<div class="ob2-affil-flag">
				<CountryFlag class="ob2-affil-flag-img" countryCode={team.id} />
			</div>
			<div class="ob2-affil-text">
				<span class="ob2-affil-eyebrow">
					{t({ locale: $localeStore, key: 'onboarding.beat2.affil_eyebrow' })}
				</span>
				<span class="ob2-affil-name">
					<span class="serif-italic acc">
						{#if selectedName}
							@{selectedName}
						{:else}
							@{t({ locale: $localeStore, key: 'onboarding.beat2.affil_placeholder' })}
						{/if}
					</span>
					<span style:background={teamColor} style:color="#fff" class="ob2-affil-tag">
						{team.id}
					</span>
				</span>
			</div>
		</div>
	{/if}

	<div class="ob2-actions">
		<button class="ob2-btn-ghost" onclick={onBack} type="button">
			{t({ locale: $localeStore, key: 'onboarding.beat2.back' })}
		</button>
		<button class="ob2-btn-primary" disabled={!canClaim} onclick={() => void claim()} type="button">
			{t({
				locale: $localeStore,
				key: isClaiming ? 'onboarding.beat2.claim_pending' : 'onboarding.beat2.claim',
				params: { handle: selectedName || '...' }
			})}
		</button>
	</div>

	<button class="ob2-skip-link" onclick={() => onAdvance(null)} type="button">
		{t({ locale: $localeStore, key: 'onboarding.beat2.skip' })}
	</button>
</div>
