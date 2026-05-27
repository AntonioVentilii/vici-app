<script lang="ts">
	import { RefreshCw } from 'lucide-svelte/icons';
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import { HANDLE_POOL } from '$lib/constants/handle-pool.constants';
	import { MIN_NICKNAME_LENGTH } from '$lib/constants/profile.constants';
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

	// Number of suggestion chips rendered per draw.
	const SUGGESTIONS_PER_DRAW = 18;
	// Over-sample multiplier — draw 2× the target count and keep the
	// first N that come back available, so a handful of collisions
	// don't leave the grid sparse.
	const OVERSAMPLE_FACTOR = 2;
	// Bound the retry loop so a pathological run (satellite errors,
	// saturated pool) can't spin forever. One pass is enough in practice
	// — the pool is 2048 words against a far smaller claimed set.
	const MAX_RESHUFFLE_ATTEMPTS = 3;

	type Mode = 'pool' | 'custom';
	let mode: Mode = $state('pool');
	let poolPick: string | null = $state(null);
	let custom: string = $state('');

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

	const selectedName = $derived(mode === 'pool' ? (poolPick ?? '') : custom.trim().toLowerCase());

	// Clear the claim-time error whenever the selection changes — stops
	// the "just got claimed" message from sticking around after the user
	// picks a different chip. `untrack` so the write doesn't loop.
	$effect(() => {
		void selectedName;
		untrack(() => {
			claimError = null;
		});
	});

	interface Availability {
		ok: boolean;
		reasonKey?: MessageKey;
	}

	const availability: Availability = $derived.by(() => {
		const name = selectedName;

		if (!name) {
			return { ok: false };
		}

		if (name.length < MIN_NICKNAME_LENGTH) {
			return { ok: false, reasonKey: 'onboarding.beat2.avail.too_short' };
		}

		if (name.length > 16) {
			return { ok: false, reasonKey: 'onboarding.beat2.avail.too_long' };
		}

		if (!/^[a-z0-9._-]+$/.test(name)) {
			return { ok: false, reasonKey: 'onboarding.beat2.avail.invalid' };
		}

		if (claimError === 'taken') {
			return { ok: false, reasonKey: 'onboarding.beat2.avail.just_taken' };
		}

		if (sessionTaken.has(name)) {
			return { ok: false, reasonKey: 'onboarding.beat2.avail.taken' };
		}

		return { ok: true };
	});

	const canClaim = $derived(availability.ok && !isClaiming);

	const event = $derived($featuredEvent);
	const team = $derived(
		participantId === null ? undefined : event.participants.find((p) => p.id === participantId)
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
	<div class="ob2-header">
		<span class="ob2-progress">
			<span class="ob2-progress-dot filled"></span>
			<span class="ob2-progress-dot filled"></span>
			<span class="ob2-progress-dot"></span>
		</span>
		<span class="ob2-step-label">
			{t({
				locale: $localeStore,
				key: 'onboarding.beat_label',
				params: { current: 2, total: 3 }
			})}
		</span>
	</div>

	<h1 class="ob2-h1">{t({ locale: $localeStore, key: 'onboarding.beat2.title' })}</h1>
	<p class="ob2-sub">
		{t({ locale: $localeStore, key: 'onboarding.beat2.sub' })}
		<span class="serif-italic acc">
			{t({ locale: $localeStore, key: 'onboarding.beat2.sub_accent' })}
		</span>
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
						disabled={taken}
						onclick={() => !taken && (poolPick = name)}
						type="button"
					>
						<span><span class="ob2-at">@</span>{name}</span>
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
				maxlength="16"
				placeholder={t({ locale: $localeStore, key: 'onboarding.beat2.placeholder' })}
				spellcheck="false"
				type="text"
				bind:value={custom}
			/>
		</div>
	{/if}

	{#if selectedName}
		<div class="ob2-avail" class:no={!availability.ok} class:ok={availability.ok}>
			{#if availability.ok}
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
			<div style:background="{teamColor}22" style:color={teamColor} class="ob2-affil-flag">
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
