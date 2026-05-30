<script lang="ts">
	import { Search, X } from 'lucide-svelte/icons';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import {
		WORLDS_COUNTRIES,
		WORLDS_UNIVERSITIES,
		type WorldsAffiliationOption
	} from '$lib/constants/worlds-affiliations.constants';
	import {
		affiliationDaysLeft,
		joinAffiliation,
		switchAffiliation
	} from '$lib/services/worlds.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { AffiliationDoc, AffiliationKind } from '$lib/types/affiliation';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { detectUserCountryCode } from '$lib/utils/locale-country.utils';

	/**
	 * Affiliation picker — full-bleed bottom sheet with a large
	 * display-font title, a searchable roster, and a bottom-anchored
	 * CTA pill. The caller chooses the `kind` (one sheet per
	 * affiliation slot) — there's no in-sheet toggle.
	 *
	 * Selection is a two-step gesture: tap a row to mark it, then tap
	 * the CTA to commit. When the user already holds an affiliation of
	 * this kind, the picker commits via {@link switchAffiliation}
	 * (delete + re-join); otherwise it goes through
	 * {@link joinAffiliation} directly. The 90-day lock is enforced on
	 * the delete leg — when it's still active the CTA shows a
	 * "Locked for N days" disabled state instead of firing a doomed
	 * round-trip.
	 */
	interface Props {
		isOpen: boolean;
		kind: AffiliationKind;
		/** Caller's currently-joined affiliations (best-effort). The
		 *  picker reads the row of `kind` to drive switch vs join, the
		 *  "Joined" row badge, and the 90-day lock state. */
		current?: { university?: AffiliationDoc; country?: AffiliationDoc };
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

	let query = $state('');
	let selected = $state<string | null>(null);
	let saving = $state(false);
	let errorMessage = $state<string | null>(null);

	/**
	 * Region tabs (university kind only). `LATAM` / `MEA` entries have no
	 * tab — they surface only under "All" or via search. The tab `id`
	 * matches `WorldsAffiliationOption.region`; the AU tab covers both
	 * Australia and New Zealand (`region: 'AU'`).
	 */
	type RegionTab = 'ALL' | 'NA' | 'UK' | 'EU' | 'AS' | 'AU';
	const REGION_TABS: readonly { id: RegionTab; key: MessageKey }[] = [
		{ id: 'ALL', key: 'worlds.picker.region.all' },
		{ id: 'NA', key: 'worlds.picker.region.na' },
		{ id: 'UK', key: 'worlds.picker.region.uk' },
		{ id: 'EU', key: 'worlds.picker.region.eu' },
		{ id: 'AS', key: 'worlds.picker.region.as' },
		{ id: 'AU', key: 'worlds.picker.region.au' }
	];
	let region = $state<RegionTab>('ALL');

	// Best-effort home country from `navigator.language` — drives the
	// "Near you" pinning. Read once at setup: the heuristic has no
	// reactive inputs, so there's nothing to re-derive.
	const homeCountry = detectUserCountryCode();

	const currentDoc = $derived<AffiliationDoc | undefined>(current?.[kind]);
	const currentForKind = $derived<string | undefined>(currentDoc?.affiliationIdentifier);
	const lockDaysLeft = $derived(
		currentDoc ? affiliationDaysLeft({ lockedUntilMs: currentDoc.lockedUntilMs }) : 0
	);
	const isLocked = $derived(lockDaysLeft > 0);
	const isSwitching = $derived(
		currentForKind !== undefined && selected !== null && selected !== currentForKind
	);

	/**
	 * CTA copy follows the action being committed: "Switch to {name}"
	 * when a different row is selected over an existing affiliation,
	 * "Locked for N days" when the 90-day lock blocks the switch,
	 * "Pick a school/country" otherwise. Returns the resolved string,
	 * not a key — so all branches can pass through one i18n call.
	 */
	const ctaLabel = $derived.by<string>(() => {
		if (isSwitching && isLocked) {
			return t({
				locale: $localeStore,
				key: 'worlds.picker.cta_locked',
				params: { count: lockDaysLeft }
			});
		}

		if (isSwitching && selected !== null) {
			const option = roster.find((o) => o.id === selected);

			return t({
				locale: $localeStore,
				key: 'worlds.picker.cta_switch',
				params: { name: option?.name ?? '' }
			});
		}

		return t({
			locale: $localeStore,
			key: kind === 'university' ? 'worlds.picker.cta_university' : 'worlds.picker.cta_country'
		});
	});

	const ctaDisabled = $derived(selected === null || saving || (isSwitching && isLocked));

	const isUniversity = $derived(kind === 'university');
	const isSearching = $derived(query.trim().length > 0);

	const filtered = $derived.by(() => {
		const trimmed = query.trim().toLowerCase();

		if (trimmed.length > 0) {
			return roster
				.filter(
					(opt) =>
						opt.name.toLowerCase().includes(trimmed) || opt.glyph.toLowerCase().includes(trimmed)
				)
				.slice(0, 40);
		}

		// Idle, country kind: unchanged — first 20 of the roster.
		if (kind !== 'university') {
			return roster.slice(0, 20);
		}

		// Idle, university kind: apply the region tab, then pin "Near you"
		// (home-country schools) to the top. Both groups sort by QS rank;
		// entries without a rank fall to the bottom of their group.
		const scoped = region === 'ALL' ? roster : roster.filter((opt) => opt.region === region);
		// eslint-disable-next-line local-rules/prefer-object-params -- Compare functions are more readable with primitive params
		const byRank = (a: WorldsAffiliationOption, b: WorldsAffiliationOption) =>
			(a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER);
		const pinned = scoped.filter((opt) => opt.country === homeCountry).sort(byRank);
		const rest = scoped.filter((opt) => opt.country !== homeCountry).sort(byRank);

		return [...pinned, ...rest].slice(0, 40);
	});

	// Count of home-country schools in the active scope — drives the
	// "Near you · N schools" divider. Zero when there's no home country,
	// while searching, or for the country kind.
	const nearYouCount = $derived(
		!isUniversity || isSearching || homeCountry === null
			? 0
			: filtered.filter((opt) => opt.country === homeCountry).length
	);

	const handleSelect = (option: WorldsAffiliationOption) => {
		errorMessage = null;

		// Tap on the already-joined row: don't queue it as a selection
		// (there's nothing to commit). Surface the friendly hint and
		// clear any prior selection so the CTA returns to its idle
		// state.
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
			if (isSwitching && currentDoc !== undefined) {
				await switchAffiliation({
					kind,
					currentAffiliationIdentifier: currentDoc.affiliationIdentifier,
					currentLockedUntilMs: currentDoc.lockedUntilMs,
					nextAffiliationIdentifier: selected
				});
			} else {
				await joinAffiliation({ kind, affiliationIdentifier: selected });
			}

			onPicked?.();
			onClose();
		} catch (err) {
			// Four branches that need distinct UI:
			//  - Lock active — switch attempted while still inside the
			//    90-day window. `switchAffiliation` throws synchronously
			//    so this also covers a clock-skew race.
			//  - "Already affiliated" — `current` was stale and the
			//    server rejected on the join leg.
			//  - Timeout — `joinAffiliation` / `leaveAffiliation` wrap
			//    each round-trip in a 15s race; the pick may or may not
			//    have committed.
			//  - Anything else — generic fallback, error logged.
			const message = err instanceof Error ? err.message : '';
			const isLockActive = message.includes('lock active');
			const isAlreadyAffiliated = message.includes('Already affiliated');
			const isTimeout = message.includes('timed out');
			console.error('AffiliationPickerModal: commit failed', err);
			errorMessage = t({
				locale: $localeStore,
				key: isLockActive
					? 'worlds.picker.error_locked'
					: isAlreadyAffiliated
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
		region = 'ALL';
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

		{#if isUniversity && !isSearching}
			<div class="affil-picker-tabs" role="tablist">
				{#each REGION_TABS as tab (tab.id)}
					<button
						class="affil-picker-tab"
						class:is-active={region === tab.id}
						aria-selected={region === tab.id}
						onclick={() => (region = tab.id)}
						role="tab"
						type="button"
					>
						{t({ locale: $localeStore, key: tab.key })}
					</button>
				{/each}
			</div>
		{/if}

		<ul class="affil-picker-list">
			{#if filtered.length === 0}
				<li class="affil-picker-empty">
					{t({ locale: $localeStore, key: 'worlds.picker.empty' })}
				</li>
			{:else}
				{#each filtered as option, index (option.id)}
					{@const isJoined = currentForKind === option.id}
					{@const isSelected = selected === option.id}
					{@const isNearYouLead = nearYouCount > 0 && index === 0 && option.country === homeCountry}
					{#if isNearYouLead}
						<li class="affil-picker-divider" aria-hidden="true">
							{t({
								locale: $localeStore,
								key: 'worlds.picker.near_you',
								params: { count: nearYouCount }
							})}
						</li>
					{/if}
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

		<button class="affil-picker-cta" disabled={ctaDisabled} onclick={handleCommit} type="button">
			{#if saving}
				{t({ locale: $localeStore, key: 'worlds.cta.joining' })}
			{:else}
				{ctaLabel}
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

	.affil-picker-tabs {
		display: flex;
		gap: 0.35rem;
		overflow-x: auto;
		padding-bottom: 0.15rem;
		scrollbar-width: none;
	}

	.affil-picker-tabs::-webkit-scrollbar {
		display: none;
	}

	.affil-picker-tab {
		appearance: none;
		flex-shrink: 0;
		padding: 0.4rem 0.7rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 600;
		white-space: nowrap;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			background 140ms ease,
			color 140ms ease,
			border-color 140ms ease;
	}

	.affil-picker-tab:hover {
		color: var(--text-base);
	}

	.affil-picker-tab.is-active {
		color: var(--ink, #0e0d0b);
		background: var(--laurel);
		border-color: var(--laurel);
	}

	.affil-picker-list {
		max-height: 38vh;
		overflow-y: auto;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.affil-picker-divider {
		padding: 0.6rem 0.5rem 0.35rem;
		font-family: var(--font-mono);
		font-size: var(--t-10);
		font-weight: 600;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--laurel);
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
		font-size: var(--t-10);
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
