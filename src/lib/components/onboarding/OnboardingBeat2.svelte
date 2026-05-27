<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { getLeaderboard } from '$lib/services/leaderboard.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding · Beat 2 — claim a handle.
	 *
	 * Verbatim port of `Beat2Handle` from `onboarding-v2.jsx` (lines
	 * 179-277). Renders the `BeatV2Header` (progress dots + "BEAT 2 OF
	 * 3"), the two-mode picker (pool / custom), the availability strip,
	 * the affiliation preview chip, the primary / ghost action row, and
	 * the "Pick later" skip link.
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

	// Roman handle pool — kept verbatim with the prototype (`onboarding-v2.jsx:27-30`).
	const ROMAN_POOL: readonly string[] = [
		'augur',
		'augustus',
		'cassandra',
		'oracle',
		'tactus',
		'vesta',
		'tiberius',
		'livia',
		'seneca',
		'cato',
		'flavia',
		'octavia',
		'lucretia',
		'nero',
		'horatius',
		'plinius',
		'cicero',
		'antonia'
	];

	const RESERVED: ReadonlySet<string> = new Set(['vici', 'admin', 'satoshi', 'oracle']);

	// Cap the live "taken handles" probe at the top N leaderboard rows.
	const TAKEN_HANDLES_PROBE_LIMIT = 50;

	type Mode = 'pool' | 'custom';
	let mode: Mode = $state('pool');
	let poolPick: string | null = $state(null);
	let custom: string = $state('');

	const takenHandles = new SvelteSet<string>(RESERVED);

	onMount(() => {
		void (async () => {
			try {
				const rows = await getLeaderboard();

				for (const row of rows.slice(0, TAKEN_HANDLES_PROBE_LIMIT)) {
					const nickname = row.nickname?.toLowerCase().trim();

					if (nickname) {
						takenHandles.add(nickname);
					}
				}
			} catch (err) {
				console.warn('Could not seed taken-handle hints from leaderboard:', err);
			}
		})();
	});

	const isHandleTaken = (name: string): boolean => takenHandles.has(name.toLowerCase());

	const selectedName = $derived(mode === 'pool' ? (poolPick ?? '') : custom.trim().toLowerCase());

	interface Availability {
		ok: boolean;
		reasonKey?: MessageKey;
	}

	const availability: Availability = $derived.by(() => {
		const name = selectedName;

		if (!name) {
			return { ok: false };
		}

		if (name.length < 3) {
			return { ok: false, reasonKey: 'onboarding.beat2.avail.too_short' };
		}

		if (name.length > 16) {
			return { ok: false, reasonKey: 'onboarding.beat2.avail.too_long' };
		}

		if (!/^[a-z0-9._-]+$/.test(name)) {
			return { ok: false, reasonKey: 'onboarding.beat2.avail.invalid' };
		}

		if (isHandleTaken(name)) {
			return { ok: false, reasonKey: 'onboarding.beat2.avail.taken' };
		}

		return { ok: true };
	});

	const canClaim = $derived(availability.ok);

	const event = $derived($featuredEvent);
	const team = $derived(
		participantId === null ? undefined : event.participants.find((p) => p.id === participantId)
	);
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
		<div class="ob2-pool-grid">
			{#each ROMAN_POOL as name (name)}
				{@const taken = isHandleTaken(name)}
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
				{team.glyph ?? ''}
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
		<button
			class="ob2-btn-primary"
			disabled={!canClaim}
			onclick={() => onAdvance(selectedName)}
			type="button"
		>
			{t({
				locale: $localeStore,
				key: 'onboarding.beat2.claim',
				params: { handle: selectedName || '...' }
			})}
		</button>
	</div>

	<button class="ob2-skip-link" onclick={() => onAdvance(null)} type="button">
		{t({ locale: $localeStore, key: 'onboarding.beat2.skip' })}
	</button>
</div>
