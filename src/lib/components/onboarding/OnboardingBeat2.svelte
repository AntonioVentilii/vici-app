<script lang="ts">
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding V2 · Beat 2 — claim a handle.
	 *
	 * Mirrors the V1.2 prototype's two-mode picker: pool (Roman-name
	 * suggestions) and custom (free-form input). Validates against
	 * length, character set, and a small reserved set. Renders an
	 * affiliation chip preview showing the picked team beside the
	 * tentative handle so the user sees their forming identity before
	 * committing.
	 *
	 * Emits `onAdvance(handle | null)` — `null` covers the "Pick later"
	 * skip path; the orchestrator can later prompt the user again.
	 */
	interface Props {
		// Picked team id from Beat 1.a (`null` for the skip path). Drives
		// the affiliation chip preview.
		participantId: string | null;
		onAdvance: (handle: string | null) => void;
		onBack: () => void;
	}

	const { participantId, onAdvance, onBack }: Props = $props();

	// V1.2 ROMAN_POOL — kept as a literal so the visible roster matches
	// the prototype exactly. Reserved set covers the obvious squatters;
	// real availability would come from a backend lookup but is faked
	// here to keep the onboarding offline-tolerant.
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

	type Mode = 'pool' | 'custom';
	let mode: Mode = $state('pool');
	let poolPick: string | null = $state(null);
	let custom: string = $state('');

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

		if (RESERVED.has(name)) {
			return { ok: false, reasonKey: 'onboarding.beat2.avail.taken' };
		}

		return { ok: true };
	});

	const event = $derived($featuredEvent);
	const team = $derived(
		participantId === null ? undefined : event.participants.find((p) => p.id === participantId)
	);

	const claim = () => {
		if (availability.ok && selectedName) {
			onAdvance(selectedName);
		}
	};

	const skip = () => {
		onAdvance(null);
	};
</script>

<section class="ob2-beat ob2-beat-2" aria-labelledby="ob2-beat2-title">
	<header class="ob2-beat-header">
		<span class="ob2-progress" aria-hidden="true">
			<span class="ob2-progress-dot is-filled"></span>
			<span class="ob2-progress-dot is-filled"></span>
			<span class="ob2-progress-dot"></span>
		</span>
		<span class="allcaps ob2-step-label">
			{t({
				locale: $localeStore,
				key: 'onboarding.beat_label',
				params: { current: 2, total: 3 }
			})}
		</span>
	</header>

	<h1 id="ob2-beat2-title" class="ob2-h1">
		{t({ locale: $localeStore, key: 'onboarding.beat2.title' })}
	</h1>
	<p class="ob2-sub">{t({ locale: $localeStore, key: 'onboarding.beat2.sub' })}</p>

	<div class="ob2-mode-tabs" role="tablist">
		<button
			class="ob2-mode-tab"
			class:is-active={mode === 'pool'}
			aria-selected={mode === 'pool'}
			onclick={() => (mode = 'pool')}
			role="tab"
			type="button"
		>
			{t({ locale: $localeStore, key: 'onboarding.beat2.mode_pool' })}
		</button>
		<button
			class="ob2-mode-tab"
			class:is-active={mode === 'custom'}
			aria-selected={mode === 'custom'}
			onclick={() => (mode = 'custom')}
			role="tab"
			type="button"
		>
			{t({ locale: $localeStore, key: 'onboarding.beat2.mode_custom' })}
		</button>
	</div>

	{#if mode === 'pool'}
		<div class="ob2-pool-grid">
			{#each ROMAN_POOL as name (name)}
				<button
					class="ob2-pool-chip"
					class:is-picked={poolPick === name}
					onclick={() => (poolPick = name)}
					type="button"
				>
					<span class="ob2-at">@</span>{name}
				</button>
			{/each}
		</div>
	{:else}
		<label class="ob2-custom-input-wrap">
			<span class="ob2-at-large" aria-hidden="true">@</span>
			<input
				class="ob2-custom-input num"
				autocapitalize="off"
				autocomplete="off"
				maxlength="16"
				placeholder={t({ locale: $localeStore, key: 'onboarding.beat2.placeholder' })}
				spellcheck="false"
				type="text"
				bind:value={custom}
			/>
		</label>
	{/if}

	{#if selectedName}
		<p class="ob2-avail" class:is-ok={availability.ok} aria-live="polite">
			{#if availability.ok}
				{t({
					locale: $localeStore,
					key: 'onboarding.beat2.avail_ok',
					params: { handle: selectedName }
				})}
			{:else if availability.reasonKey}
				{t({ locale: $localeStore, key: availability.reasonKey })}
			{/if}
		</p>
	{/if}

	{#if team}
		<aside
			style:--team-color={team.color ?? 'var(--laurel)'}
			class="ob2-affil-preview"
			aria-label="Profile preview"
		>
			<span class="ob2-affil-flag" aria-hidden="true">{team.glyph ?? ''}</span>
			<div class="ob2-affil-text">
				<span class="allcaps ob2-affil-eyebrow">
					{t({ locale: $localeStore, key: 'onboarding.beat2.affil_eyebrow' })}
				</span>
				<span class="ob2-affil-name">
					<span class="serif-italic">
						@{selectedName || t({ locale: $localeStore, key: 'onboarding.beat2.placeholder' })}
					</span>
					<span class="ob2-affil-tag">{team.id}</span>
				</span>
			</div>
		</aside>
	{/if}

	<div class="ob2-actions">
		<button class="ob2-btn-ghost" onclick={onBack} type="button">
			{t({ locale: $localeStore, key: 'onboarding.beat2.back' })}
		</button>
		<button class="ob2-btn-primary" disabled={!availability.ok} onclick={claim} type="button">
			{t({
				locale: $localeStore,
				key: 'onboarding.beat2.claim',
				params: { handle: selectedName || '…' }
			})}
		</button>
	</div>

	<button class="ob2-skip-link" onclick={skip} type="button">
		{t({ locale: $localeStore, key: 'onboarding.beat2.skip' })}
	</button>
</section>

<style lang="postcss">
	.ob2-beat {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem 1.1rem 1.5rem;
		color: var(--text-base);
	}

	.ob2-beat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.ob2-progress {
		display: inline-flex;
		gap: 6px;
	}

	.ob2-progress-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--border-base);
		transition: background 160ms ease;
	}

	.ob2-progress-dot.is-filled {
		background: var(--laurel);
	}

	.ob2-step-label {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.ob2-h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 6vw, 2rem);
		line-height: var(--leading-tight);
		color: var(--text-base);
	}

	.ob2-sub {
		margin: 0;
		font-size: var(--t-14);
		color: var(--text-muted);
	}

	.ob2-mode-tabs {
		display: inline-flex;
		gap: 0.35rem;
		padding: 0.2rem;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		align-self: flex-start;
	}

	.ob2-mode-tab {
		appearance: none;
		padding: 0.4rem 0.85rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 600;
		color: var(--text-muted);
		background: none;
		border: none;
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			color 140ms ease,
			background 140ms ease;
	}

	.ob2-mode-tab.is-active {
		color: var(--text-base);
		background: var(--bg-surface);
		box-shadow: var(--inset-hi);
	}

	.ob2-pool-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: 0.4rem;
	}

	.ob2-pool-chip {
		appearance: none;
		display: inline-flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.05rem;
		padding: 0.55rem 0.5rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			border-color 140ms ease,
			background 140ms ease;
	}

	.ob2-pool-chip:hover {
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
	}

	.ob2-pool-chip.is-picked {
		color: var(--laurel);
		border-color: color-mix(in srgb, var(--laurel) 55%, var(--border-base));
		background: color-mix(in srgb, var(--laurel) 12%, var(--bg-surface));
	}

	.ob2-at {
		color: var(--text-muted);
		margin-right: 1px;
	}

	.ob2-custom-input-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.65rem 0.85rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.ob2-at-large {
		font-family: var(--font-display);
		font-size: 1.5rem;
		color: var(--laurel);
		line-height: 1;
	}

	.ob2-custom-input {
		appearance: none;
		flex: 1 1 auto;
		min-width: 0;
		font: inherit;
		font-size: var(--t-15, 0.95rem);
		font-weight: 600;
		color: var(--text-base);
		background: none;
		border: none;
		outline: none;
	}

	.ob2-avail {
		margin: 0;
		font-size: var(--t-13);
		color: var(--no);
	}

	.ob2-avail.is-ok {
		color: var(--yes);
	}

	.ob2-affil-preview {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.85rem;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid color-mix(in srgb, var(--team-color) 28%, var(--border-base));
		border-radius: var(--r-12);
	}

	.ob2-affil-flag {
		font-size: 1.5rem;
		line-height: 1;
		padding: 0.35rem 0.55rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--team-color) 14%, transparent);
	}

	.ob2-affil-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.ob2-affil-eyebrow {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.ob2-affil-name {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--t-15, 0.95rem);
		color: var(--text-base);
	}

	.ob2-affil-tag {
		font-size: var(--t-11, 0.7rem);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		padding: 0.15rem 0.4rem;
		border-radius: var(--r-pill);
		background: var(--team-color);
		color: var(--text-on-accent, #fff);
	}

	.ob2-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.ob2-btn-ghost,
	.ob2-btn-primary {
		appearance: none;
		flex: 1 1 auto;
		padding: 0.85rem 1rem;
		font: inherit;
		font-size: var(--t-14);
		font-weight: 700;
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			background 140ms ease,
			color 140ms ease,
			border-color 140ms ease;
	}

	.ob2-btn-ghost {
		color: var(--text-muted);
		background: none;
		border: 1px solid var(--border-base);
		flex: 0 0 auto;
	}

	.ob2-btn-ghost:hover {
		color: var(--text-base);
		border-color: var(--border-strong);
	}

	.ob2-btn-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.ob2-btn-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.ob2-btn-primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ob2-skip-link {
		appearance: none;
		align-self: center;
		margin-top: 0.25rem;
		padding: 0.4rem 0.7rem;
		font: inherit;
		font-size: var(--t-12);
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: underline;
	}

	.ob2-skip-link:hover {
		color: var(--text-base);
	}
</style>
