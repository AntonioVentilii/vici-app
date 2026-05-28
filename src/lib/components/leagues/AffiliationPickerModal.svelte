<script lang="ts">
	import { Search, X } from 'lucide-svelte/icons';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import {
		WORLDS_COUNTRIES,
		WORLDS_UNIVERSITIES,
		type WorldsAffiliationOption
	} from '$lib/constants/worlds-affiliations.constants';
	import { joinAffiliation } from '$lib/services/worlds.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { AffiliationKind } from '$lib/types/affiliation';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Affiliation picker — full-bleed bottom sheet with a large
	 * display-font title, a searchable roster, and a bottom-anchored
	 * CTA pill. The caller chooses the `kind` (one sheet per
	 * affiliation slot) — there's no in-sheet toggle.
	 *
	 * Selection is a two-step gesture: tap a row to mark it, then tap
	 * the CTA to commit via `joinAffiliation`. Same satellite path as
	 * the inline grid on `WorldsPage`.
	 */
	interface Props {
		isOpen: boolean;
		kind: AffiliationKind;
		/** Caller's currently-joined affiliations (best-effort). Used to
		 *  surface the "you're already on this leaderboard" message
		 *  without round-tripping when the user taps their current
		 *  affiliation. The catch path still defends against stale state
		 *  via the `already-affiliated` reject from `joinAffiliation`. */
		current?: { university?: string; country?: string };
		onClose: () => void;
		onPicked?: () => void;
	}

	const { isOpen, kind, current, onClose, onPicked }: Props = $props();

	const roster = $derived<readonly WorldsAffiliationOption[]>(
		kind === 'university' ? WORLDS_UNIVERSITIES : WORLDS_COUNTRIES
	);

	const titleKey = $derived<MessageKey>(
		kind === 'university' ? 'worlds.picker.title_university' : 'worlds.picker.title_country'
	);
	const subKey: MessageKey = 'worlds.picker.lock_hint';
	const searchPlaceholderKey = $derived<MessageKey>(
		kind === 'university' ? 'worlds.picker.search_university' : 'worlds.picker.search_country'
	);
	const ctaKey = $derived<MessageKey>(
		kind === 'university' ? 'worlds.picker.cta_university' : 'worlds.picker.cta_country'
	);

	let query = $state('');
	let selected = $state<string | null>(null);
	let saving = $state(false);
	let errorMessage = $state<string | null>(null);

	const currentForKind = $derived<string | undefined>(current?.[kind]);

	const filtered = $derived.by(() => {
		const trimmed = query.trim().toLowerCase();

		if (trimmed.length === 0) {
			return roster.slice(0, 20);
		}

		return roster
			.filter(
				(opt) =>
					opt.name.toLowerCase().includes(trimmed) || opt.glyph.toLowerCase().includes(trimmed)
			)
			.slice(0, 40);
	});

	const handleSelect = (option: WorldsAffiliationOption) => {
		errorMessage = null;

		// Tap on the already-joined row: surface the friendly "you're
		// already on this leaderboard" message instead of letting the
		// user commit and get rejected at the satellite. Defence in
		// depth — `handleCommit` still catches the server `already-
		// affiliated` reject for stale-state cases.
		if (currentForKind !== undefined && currentForKind === option.id) {
			selected = null;
			errorMessage = t({
				locale: $localeStore,
				key: 'worlds.picker.error_already_affiliated'
			});

			return;
		}

		selected = selected === option.id ? null : option.id;
	};

	const handleCommit = async () => {
		if (selected === null || saving) {
			return;
		}

		saving = true;
		errorMessage = null;

		try {
			await joinAffiliation({ kind, affiliationIdentifier: selected });
			onPicked?.();
			onClose();
		} catch (err) {
			// Three branches that need distinct UI:
			//  - "Already affiliated" — `current` was stale and the
			//    server rejected. Show the friendly "you're already on
			//    this leaderboard" copy.
			//  - Timeout — `joinAffiliation` wrapped the round-trip in a
			//    15s race; the pick may or may not have committed.
			//  - Anything else — generic fallback, error logged.
			const message = err instanceof Error ? err.message : '';
			const isAlreadyAffiliated = message.includes('Already affiliated');
			const isTimeout = message.includes('timed out');
			console.error('AffiliationPickerModal: joinAffiliation failed', err);
			errorMessage = t({
				locale: $localeStore,
				key: isAlreadyAffiliated
					? 'worlds.picker.error_already_affiliated'
					: isTimeout
						? 'worlds.picker.error_timeout'
						: 'common.error.generic'
			});
		} finally {
			saving = false;
		}
	};

	const handleClose = () => {
		query = '';
		selected = null;
		errorMessage = null;
		onClose();
	};
</script>

<BottomSheet {isOpen} onClose={handleClose}>
	<div class="affil-picker">
		<header class="affil-picker-head">
			<h2 class="affil-picker-title">{t({ locale: $localeStore, key: titleKey })}</h2>
			<button
				class="affil-picker-close"
				aria-label={t({ locale: $localeStore, key: 'worlds.picker.close' })}
				onclick={handleClose}
				type="button"
			>
				<X size={14} strokeWidth={1.8} />
			</button>
		</header>

		<p class="affil-picker-hint serif-italic">
			{t({ locale: $localeStore, key: subKey })}
		</p>

		<div class="affil-picker-search">
			<Search aria-hidden="true" size={14} strokeWidth={1.6} />
			<input
				placeholder={t({
					locale: $localeStore,
					key: searchPlaceholderKey,
					params: { count: roster.length }
				})}
				type="text"
				bind:value={query}
			/>
			{#if query}
				<button
					class="affil-picker-clear"
					aria-label={t({ locale: $localeStore, key: 'worlds.picker.clear' })}
					onclick={() => (query = '')}
					type="button"
				>
					<X size={12} strokeWidth={1.8} />
				</button>
			{/if}
		</div>

		<ul class="affil-picker-list">
			{#if filtered.length === 0}
				<li class="affil-picker-empty">
					{t({ locale: $localeStore, key: 'worlds.picker.empty' })}
				</li>
			{:else}
				{#each filtered as option (option.id)}
					{@const isJoined = currentForKind === option.id}
					{@const isSelected = selected === option.id}
					<li>
						<button
							class="affil-picker-row"
							class:is-joined={isJoined}
							class:is-selected={isSelected}
							aria-current={isJoined ? 'true' : undefined}
							aria-pressed={isSelected}
							onclick={() => handleSelect(option)}
							type="button"
						>
							<span class="affil-picker-glyph" aria-hidden="true">
								{#if kind === 'country'}
									<CountryFlag class="affil-picker-flag" countryCode={option.id} />
								{:else}
									{option.glyph}
								{/if}
							</span>
							<span class="affil-picker-name">{option.name}</span>
							{#if isJoined}
								<span class="num allcaps affil-picker-joined">
									{t({ locale: $localeStore, key: 'worlds.picker.already_joined' })}
								</span>
							{/if}
						</button>
					</li>
				{/each}
			{/if}
		</ul>

		{#if errorMessage}
			<p class="affil-picker-error" role="alert">{errorMessage}</p>
		{/if}

		<button
			class="affil-picker-cta"
			disabled={selected === null || saving}
			onclick={handleCommit}
			type="button"
		>
			{#if saving}
				{t({ locale: $localeStore, key: 'worlds.cta.joining' })}
			{:else}
				{t({ locale: $localeStore, key: ctaKey })}
			{/if}
		</button>
	</div>
</BottomSheet>

<style lang="postcss">
	.affil-picker {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 0.25rem 0 0.5rem;
	}

	.affil-picker-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.affil-picker-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-32, 2rem);
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: var(--tracking-tight);
		color: var(--text-base);
	}

	.affil-picker-close {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		color: var(--text-muted);
		cursor: pointer;
	}

	.affil-picker-hint {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.45;
		color: var(--text-muted);
	}

	.affil-picker-search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		color: var(--text-muted);
	}

	.affil-picker-search input {
		flex: 1;
		appearance: none;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-base);
		font: inherit;
	}

	.affil-picker-clear {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
	}

	.affil-picker-list {
		max-height: 38vh;
		overflow-y: auto;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.affil-picker-row {
		appearance: none;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.7rem 0.5rem;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background: none;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--border-base) 60%, transparent);
		cursor: pointer;
		transition: background 140ms ease;
	}

	.affil-picker-row:hover {
		background: color-mix(in srgb, var(--laurel) 8%, var(--bg-surface));
	}

	.affil-picker-row.is-selected {
		background: color-mix(in srgb, var(--laurel) 14%, var(--bg-surface));
	}

	.affil-picker-row.is-joined {
		background: color-mix(in srgb, var(--laurel) 10%, var(--bg-surface));
	}

	.affil-picker-glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border-radius: var(--r-8);
		background: var(--bg-surface);
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 700;
		overflow: hidden;
	}

	.affil-picker :global(.affil-picker-flag) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.affil-picker-name {
		flex: 1;
		font-size: var(--t-14);
		font-weight: 600;
	}

	.affil-picker-joined {
		font-size: var(--t-10, 0.65rem);
		color: var(--laurel);
	}

	.affil-picker-empty {
		padding: 1.4rem 1rem;
		font-size: var(--t-13);
		text-align: center;
		color: var(--text-muted);
	}

	.affil-picker-error {
		margin: 0;
		padding: 0.6rem 0.85rem;
		font-size: var(--t-12);
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
		border-radius: var(--r-12);
	}

	.affil-picker-cta {
		appearance: none;
		width: 100%;
		padding: 0.95rem 1rem;
		font: inherit;
		font-size: var(--t-14);
		font-weight: 700;
		color: var(--ink, #0e0d0b);
		background: var(--color-primary);
		border: 0;
		border-radius: var(--r-pill);
		cursor: pointer;
		transition: opacity 140ms ease;
	}

	.affil-picker-cta:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
