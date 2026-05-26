<script lang="ts">
	import { Search, X } from 'lucide-svelte/icons';
	import Modal from '$lib/components/ui/Modal.svelte';
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
	 * Affiliation picker modal. Searchable list of either universities
	 * or countries, with a 90-day-lock heads-up on top. Selecting an
	 * option commits via `joinAffiliation` (which server-validates the
	 * lock + binds the caller).
	 *
	 * The inline grid on `WorldsPage` is fine for short rosters; this
	 * modal is the canonical picker once the affiliation roster grows
	 * past one screen.
	 */
	interface Props {
		isOpen: boolean;
		kind: AffiliationKind;
		onClose: () => void;
		onPicked?: () => void;
	}

	const { isOpen, kind, onClose, onPicked }: Props = $props();

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

	let query = $state('');
	let saving = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

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

	const handlePick = async (option: WorldsAffiliationOption) => {
		if (saving !== null) {
			return;
		}

		saving = option.id;
		errorMessage = null;

		try {
			await joinAffiliation({ kind, affiliationId: option.id });
			onPicked?.();
			onClose();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			saving = null;
		}
	};

	const handleClose = () => {
		query = '';
		errorMessage = null;
		onClose();
	};
</script>

<Modal {isOpen} onClose={handleClose}>
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
					<li>
						<button
							class="affil-picker-row"
							disabled={saving === option.id}
							onclick={() => handlePick(option)}
							type="button"
						>
							<span class="affil-picker-glyph" aria-hidden="true">{option.glyph}</span>
							<span class="affil-picker-name">{option.name}</span>
							{#if saving === option.id}
								<span class="num allcaps affil-picker-saving">
									{t({ locale: $localeStore, key: 'worlds.cta.joining' })}
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
	</div>
</Modal>

<style lang="postcss">
	.affil-picker {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1rem 1.1rem;
	}

	.affil-picker-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.affil-picker-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-18, 1.15rem);
		font-weight: 600;
		color: var(--text-base);
	}

	.affil-picker-close {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: none;
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
		max-height: 40vh;
		overflow-y: auto;
		list-style: none;
		padding: 0;
		margin: 0;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.affil-picker-list > li + li {
		border-top: 1px solid color-mix(in srgb, var(--border-base) 60%, transparent);
	}

	.affil-picker-row {
		appearance: none;
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		padding: 0.7rem 0.85rem;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background: none;
		border: none;
		cursor: pointer;
		transition: background 140ms ease;
	}

	.affil-picker-row:hover:not(:disabled) {
		background: color-mix(in srgb, var(--laurel) 8%, var(--bg-surface));
	}

	.affil-picker-row:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.affil-picker-glyph {
		font-size: 1.15rem;
		min-width: 36px;
		text-align: center;
		font-weight: 700;
	}

	.affil-picker-name {
		flex: 1;
		font-size: var(--t-14);
		font-weight: 500;
	}

	.affil-picker-saving {
		font-size: var(--t-10, 0.65rem);
		color: var(--text-muted);
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
</style>
