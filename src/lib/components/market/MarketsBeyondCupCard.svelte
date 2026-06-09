<script lang="ts">
	import { Check, ChevronDown, ChevronRight, Lock } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { categoryLabel, MARKET_TAGS, type MarketTag } from '$lib/constants/market-tags.constants';
	import {
		decisiveSettledCount,
		resolvedPositionsNotInitialized
	} from '$lib/derived/resolved-positions.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { displayAccuracyPct } from '$lib/utils/accuracy.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	/**
	 * "Beyond the Cup" skill gate. During the World-Cup focus the Markets board
	 * surfaces only the World-Cup category; every other category stays locked
	 * behind a calibrated-accuracy goal. This card sits high on the board as the
	 * unlock motivator (not a waitlist — a target): it shows the viewer's
	 * calibrated accuracy and a progress bar toward {@link UNLOCK_ACC}, and
	 * expands to preview the locked categories.
	 *
	 * Accuracy source: the viewer's persisted `profile.accuracy` (a 0..100
	 * win-rate), surfaced through `displayAccuracyPct` so a user with no settled
	 * calls yet reads the same optimistic 100% the rest of their own stat
	 * surfaces show (see `accuracy.utils`) rather than a discouraging 0%.
	 *
	 * Locked categories = the closed `MARKET_TAGS` taxonomy minus `wc`. There is
	 * no buy path here — the gate only previews what unlocking opens.
	 */

	/** Calibrated-accuracy threshold (0..1) to unlock the non-World-Cup board. */
	const UNLOCK_ACC = 0.75;

	let open = $state(false);

	// Display percentage (0..100, no trailing '%'), optimistic-empty handled by
	// `displayAccuracyPct`. Round to a whole point for the headline + progress.
	const accuracyPctRaw = $derived(
		Number(
			displayAccuracyPct({
				accuracy: $userStore.profile?.accuracy ?? 0,
				settledCount: $decisiveSettledCount,
				initialized: !$resolvedPositionsNotInitialized
			})
		)
	);

	const pct = $derived(Math.round(accuracyPctRaw));
	const target = $derived(Math.round(UNLOCK_ACC * 100));
	const unlocked = $derived(accuracyPctRaw / 100 >= UNLOCK_ACC);
	const progress = $derived(Math.max(0, Math.min(1, accuracyPctRaw / 100 / UNLOCK_ACC)));
	const remaining = $derived(Math.max(0, target - pct));

	// Locked categories: the closed taxonomy minus the World-Cup category.
	const lockedCategories = $derived<MarketTag[]>(MARKET_TAGS.filter((tag) => tag !== 'wc'));

	const toggle = () => (open = !open);
</script>

<div class="beyond-wrap">
	<button class="card-surface beyond" aria-expanded={open} onclick={toggle} type="button">
		<!-- Compact header — always visible -->
		<div style="align-items: center; gap: 12px;" class="row between">
			<div style="gap: 10px; align-items: center; min-width: 0;" class="row">
				<span class="beyond-icon" class:unlocked aria-hidden="true">
					{#if unlocked}
						<Check size={15} />
					{:else}
						<Lock size={15} />
					{/if}
				</span>
				<div style="gap: 2px; min-width: 0;" class="col">
					<span class="beyond-eyebrow eyebrow-xs">
						{t({ locale: $localeStore, key: 'markets.beyond.eyebrow' })}
					</span>
					<span class="beyond-status t-eyebrow">
						{#if unlocked}
							{t({
								locale: $localeStore,
								key: 'markets.beyond.ready',
								params: { count: lockedCategories.length }
							})}
						{:else}
							{t({
								locale: $localeStore,
								key: 'markets.beyond.unlock_at',
								params: { pct: target }
							})}
						{/if}
					</span>
				</div>
			</div>
			<div style="gap: 8px; align-items: center; flex: 0 0 auto;" class="row">
				<span class="beyond-pct num t-body-sm fw-600" class:unlocked>{pct}%</span>
				<span class="beyond-chev" class:open aria-hidden="true">
					<ChevronDown size={16} />
				</span>
			</div>
		</div>

		<!-- Thin progress bar — always visible -->
		<div class="beyond-track">
			<div
				style:width={`${progress * 100}%`}
				class="beyond-fill"
				class:reduced={prefersReducedMotion()}
				class:unlocked
			></div>
		</div>

		<!-- Expanded detail: the unlock copy + the locked category tiles -->
		{#if open}
			<div transition:slide={{ duration: prefersReducedMotion() ? 0 : 200 }}>
				<p class="beyond-copy dim t-body-sm">
					{#if unlocked}
						{t({ locale: $localeStore, key: 'markets.beyond.unlocked_copy' })}
					{:else}
						{t({
							locale: $localeStore,
							key: 'markets.beyond.locked_copy',
							params: { pct: target, remaining }
						})}
					{/if}
				</p>
				<div class="beyond-tiles">
					{#each lockedCategories as category (category)}
						<div class="beyond-tile row between" aria-disabled="true">
							<span class="beyond-tile-label t-body-sm fw-600" class:unlocked>
								{categoryLabel({ category, variant: 'full', locale: $localeStore })}
							</span>
							<span class="beyond-tile-icon" aria-hidden="true">
								{#if unlocked}
									<ChevronRight size={14} />
								{:else}
									<Lock size={14} />
								{/if}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</button>
</div>

<style lang="postcss">
	.beyond-wrap {
		padding: 0 20px 16px;
	}

	.beyond {
		width: 100%;
		text-align: left;
		cursor: pointer;
		gap: 0;
		appearance: none;
		font: inherit;
		color: var(--text-base);
	}

	.beyond-icon {
		width: 30px;
		height: 30px;
		flex: 0 0 30px;
		border-radius: 9px;
		display: grid;
		place-items: center;
		border: 1px solid var(--border-strong);
		background: var(--bg-base);
		color: var(--fg-dim);
	}

	.beyond-icon.unlocked {
		color: var(--yes);
	}

	.beyond-eyebrow {
		white-space: nowrap;
		letter-spacing: 0.12em;
		color: var(--fg-dim);
	}

	.beyond-status {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--fg-dim);
	}

	.beyond-pct {
		color: var(--text-base);
	}

	.beyond-pct.unlocked {
		color: var(--yes);
	}

	.beyond-chev {
		color: var(--text-muted);
		display: grid;
		transition: transform 0.2s ease;
	}

	.beyond-chev.open {
		transform: rotate(180deg);
	}

	.beyond-track {
		height: 5px;
		border-radius: 999px;
		background: var(--bg-base);
		overflow: hidden;
		border: 1px solid var(--border-base);
		margin-top: 12px;
	}

	.beyond-fill {
		height: 100%;
		border-radius: 999px;
		background: var(--accent);
		transition: width 0.4s ease;
	}

	.beyond-fill.unlocked {
		background: var(--yes);
	}

	.beyond-fill.reduced {
		transition: none;
	}

	.beyond-copy {
		margin-top: 14px;
		margin-bottom: 0;
		line-height: 1.5;
		color: var(--fg-dim);
	}

	.beyond-tiles {
		margin-top: 14px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.beyond-tile {
		padding: 11px 12px;
		border-radius: 12px;
		background: var(--bg-base);
		border: 1px solid var(--border-strong);
		align-items: center;
	}

	.beyond-tile-label {
		color: var(--fg-dim);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.beyond-tile-label.unlocked {
		color: var(--text-base);
	}

	.beyond-tile-icon {
		color: var(--text-muted);
		display: grid;
		flex: 0 0 auto;
	}

	@media (prefers-reduced-motion: reduce) {
		.beyond-fill,
		.beyond-chev {
			transition: none;
		}
	}
</style>
