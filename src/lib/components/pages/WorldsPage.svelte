<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import AffiliationPickerModal from '$lib/components/leagues/AffiliationPickerModal.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_WORLDS_PODIUM } from '$lib/constants/vxp-economy.constants';
	import { lookupWorldsAffiliation } from '$lib/constants/worlds-affiliations.constants';
	import {
		affiliationDaysLeft,
		claimWorldsPodiumPrize,
		leaveAffiliation,
		listMyAffiliations,
		previousMonthAnchor
	} from '$lib/services/worlds.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { AffiliationDoc, AffiliationKind } from '$lib/types/affiliation';
	import { formatDate } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Worlds picker page.
	 *
	 * Two slots — university + country — each in either an empty
	 * (picker grid) or locked (countdown card) state. The 90-day
	 * lock is enforced server-side; this page mirrors the gate
	 * pre-emptively so users see "N days left" rather than the
	 * thrown error.
	 */

	let myUni: AffiliationDoc | undefined = $state();
	let myCountry: AffiliationDoc | undefined = $state();
	let loadState: 'loading' | 'ready' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);
	let pendingKey: string | null = $state(null);
	let pickerKind: AffiliationKind | null = $state(null);

	let podiumClaim = $state<{ monthAnchor: string; awardsCreated: number } | null>(null);

	const refresh = async () => {
		try {
			const result = await listMyAffiliations();
			myUni = result.university;
			myCountry = result.country;
			loadState = 'ready';
		} catch (err) {
			console.error('WorldsPage: listMyAffiliations failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
			loadState = 'error';
		}
	};

	/**
	 * On every Worlds mount, fire a claim for the previous calendar
	 * month's podium. Idempotent: if the user already claimed it
	 * (or wasn't eligible), the server-side fast-path returns
	 * cleanly. If new awards landed, we surface a one-shot toast.
	 *
	 * This is the "scheduled task without a scheduler" pattern —
	 * user visits act as the trigger.
	 */
	const tryClaimPodium = async () => {
		try {
			const monthAnchor = previousMonthAnchor();
			const result = await claimWorldsPodiumPrize({ monthAnchor });

			if (result.awardsCreated > 0) {
				podiumClaim = {
					monthAnchor: result.monthAnchor,
					awardsCreated: result.awardsCreated
				};
			}
		} catch {
			// First visit before any closed month exists, or other
			// transient failure. Silent — claim retries on next mount.
		}
	};

	onMount(async () => {
		await refresh();
		void tryClaimPodium();
	});

	const handleLeave = async ({
		kind,
		affiliationId
	}: {
		kind: AffiliationKind;
		affiliationId: string;
	}) => {
		const pending = `${kind}:${affiliationId}`;

		if (pendingKey !== null) {
			return;
		}

		pendingKey = pending;

		try {
			await leaveAffiliation({ kind, affiliationId });
			await refresh();
		} catch (err) {
			console.error('WorldsPage: leaveAffiliation failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			pendingKey = null;
		}
	};
</script>

<div class="worlds-page">
	<MobileAppBar align="left" title={t({ locale: $localeStore, key: 'worlds.title' })} />

	<p class="worlds-sub">{t({ locale: $localeStore, key: 'worlds.sub' })}</p>

	{#if podiumClaim}
		<aside class="worlds-podium-claim" role="status">
			<span class="serif-italic worlds-podium-claim-lede">
				{t({ locale: $localeStore, key: 'worlds.podium.claim.lede' })}
			</span>
			<span class="worlds-podium-claim-sub">
				{t({
					locale: $localeStore,
					key: 'worlds.podium.claim.body',
					params: {
						month: podiumClaim.monthAnchor,
						count: podiumClaim.awardsCreated
					}
				})}
			</span>
			<button
				class="worlds-podium-claim-dismiss"
				aria-label={t({ locale: $localeStore, key: 'worlds.podium.claim.dismiss' })}
				onclick={() => (podiumClaim = null)}
				type="button"
			>
				×
			</button>
		</aside>
	{/if}

	<section class="worlds-podium" aria-label="Worlds podium prizes">
		<h2 class="eyebrow worlds-podium-eyebrow">
			{t({ locale: $localeStore, key: 'worlds.podium.eyebrow' })}
		</h2>
		<div class="worlds-podium-grid">
			<div class="worlds-podium-rung worlds-podium-gold">
				<span class="worlds-podium-place allcaps">
					{t({ locale: $localeStore, key: 'worlds.podium.gold' })}
				</span>
				<span class="num worlds-podium-amount">+{VXP_WORLDS_PODIUM.gold}</span>
				<span class="allcaps worlds-podium-vxp">VXP</span>
			</div>
			<div class="worlds-podium-rung worlds-podium-silver">
				<span class="worlds-podium-place allcaps">
					{t({ locale: $localeStore, key: 'worlds.podium.silver' })}
				</span>
				<span class="num worlds-podium-amount">+{VXP_WORLDS_PODIUM.silver}</span>
				<span class="allcaps worlds-podium-vxp">VXP</span>
			</div>
			<div class="worlds-podium-rung worlds-podium-bronze">
				<span class="worlds-podium-place allcaps">
					{t({ locale: $localeStore, key: 'worlds.podium.bronze' })}
				</span>
				<span class="num worlds-podium-amount">+{VXP_WORLDS_PODIUM.bronze}</span>
				<span class="allcaps worlds-podium-vxp">VXP</span>
			</div>
		</div>
		<p class="worlds-podium-hint">
			{t({ locale: $localeStore, key: 'worlds.podium.hint' })}
		</p>
	</section>

	{#if loadState === 'loading'}
		<p class="worlds-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'worlds.loading' })}
		</p>
	{:else if loadState === 'error'}
		<p class="worlds-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'worlds.error.generic' })}
		</p>
	{:else}
		{#each [{ kind: 'university' as const, slot: myUni, eyebrowKey: 'worlds.slot.university' as const, pickKey: 'worlds.empty.pick_university' as const }, { kind: 'country' as const, slot: myCountry, eyebrowKey: 'worlds.slot.country' as const, pickKey: 'worlds.empty.pick_country' as const }] as { kind, slot, eyebrowKey, pickKey } (kind)}
			<section class="worlds-slot">
				<h2 class="eyebrow worlds-slot-eyebrow">
					{t({ locale: $localeStore, key: eyebrowKey })}
				</h2>

				{#if slot}
					{@const option = lookupWorldsAffiliation({ kind, id: slot.affiliationId })}
					{@const daysLeft = affiliationDaysLeft({ lockedUntilMs: slot.lockedUntilMs })}
					{@const canLeave = daysLeft === 0}
					<div class="worlds-locked-card">
						<button
							class="worlds-locked-identity"
							onclick={() => {
								const path = kind === 'university' ? 'school' : 'country';
								void goto(`${resolve(AppPath.Social)}/worlds/${path}/${slot.affiliationId}`);
							}}
							type="button"
						>
							<span class="worlds-locked-glyph" aria-hidden="true">
								{option?.glyph ?? slot.affiliationId}
							</span>
							<span class="worlds-locked-name">{option?.name ?? slot.affiliationId}</span>
						</button>
						<div class="worlds-locked-text">
							<span class="worlds-locked-meta num">
								{#if canLeave}
									{t({ locale: $localeStore, key: 'worlds.lock_expired' })}
								{:else}
									{t({
										locale: $localeStore,
										key: 'worlds.locked_until',
										params: {
											date: formatDate(slot.lockedUntilMs),
											days: daysLeft
										}
									})}
								{/if}
							</span>
						</div>
						<button
							class="worlds-leave"
							disabled={!canLeave || pendingKey === `${kind}:${slot.affiliationId}`}
							onclick={() => handleLeave({ kind, affiliationId: slot.affiliationId })}
							type="button"
						>
							{pendingKey === `${kind}:${slot.affiliationId}`
								? t({ locale: $localeStore, key: 'worlds.cta.leaving' })
								: t({ locale: $localeStore, key: 'worlds.cta.leave' })}
						</button>
					</div>
				{:else}
					<p class="worlds-pick-hint">{t({ locale: $localeStore, key: pickKey })}</p>
					<button class="worlds-pick-cta" onclick={() => (pickerKind = kind)} type="button">
						{t({
							locale: $localeStore,
							key: kind === 'university' ? 'worlds.cta.pick_university' : 'worlds.cta.pick_country'
						})}
					</button>
				{/if}
			</section>
		{/each}
	{/if}
</div>

{#if pickerKind !== null}
	<AffiliationPickerModal
		isOpen={true}
		kind={pickerKind}
		onClose={() => (pickerKind = null)}
		onPicked={() => {
			pickerKind = null;
			void refresh();
		}}
	/>
{/if}

<style lang="postcss">
	.worlds-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 0 1rem 6rem;
	}

	.worlds-sub {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.worlds-podium-claim {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		align-items: center;
		padding: 0.85rem 1rem;
		background: color-mix(in srgb, #f4c544 12%, var(--bg-surface));
		border: 1px solid color-mix(in srgb, #f4c544 50%, var(--border-base));
		border-radius: var(--r-12);
	}

	.worlds-podium-claim-lede {
		grid-column: 1;
		font-size: var(--t-15, 1rem);
		color: var(--text-base);
	}

	.worlds-podium-claim-sub {
		grid-column: 1;
		grid-row: 2;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.worlds-podium-claim-dismiss {
		grid-column: 2;
		grid-row: 1 / span 2;
		appearance: none;
		width: 28px;
		height: 28px;
		font-size: 1.25rem;
		color: var(--text-muted);
		background: none;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.worlds-podium {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.85rem 0.9rem;
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.worlds-podium-eyebrow {
		margin: 0;
		color: var(--text-muted);
	}

	.worlds-podium-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.5rem;
	}

	.worlds-podium-rung {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.55rem 0.45rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 94%, transparent);
	}

	.worlds-podium-place {
		font-size: var(--t-10, 0.65rem);
		color: var(--text-muted);
		letter-spacing: var(--tracking-allcaps);
	}

	.worlds-podium-amount {
		font-size: var(--t-18, 1.2rem);
		font-weight: 700;
		color: var(--text-base);
	}

	.worlds-podium-vxp {
		font-size: var(--t-10, 0.65rem);
		color: var(--text-muted);
	}

	.worlds-podium-gold {
		border-color: color-mix(in srgb, #f4c544 50%, var(--border-base));
		background: color-mix(in srgb, #f4c544 8%, var(--bg-surface));
	}

	.worlds-podium-gold .worlds-podium-amount {
		color: #a8852d;
	}

	.worlds-podium-silver {
		border-color: color-mix(in srgb, #c0c5cc 50%, var(--border-base));
		background: color-mix(in srgb, #c0c5cc 8%, var(--bg-surface));
	}

	.worlds-podium-silver .worlds-podium-amount {
		color: color-mix(in srgb, #768089 80%, var(--text-base));
	}

	.worlds-podium-bronze {
		border-color: color-mix(in srgb, #c97c4a 50%, var(--border-base));
		background: color-mix(in srgb, #c97c4a 8%, var(--bg-surface));
	}

	.worlds-podium-bronze .worlds-podium-amount {
		color: #8a4f1f;
	}

	.worlds-podium-hint {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.worlds-status,
	.worlds-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.worlds-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.worlds-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.worlds-slot {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.worlds-slot-eyebrow {
		margin: 0;
		color: var(--text-muted);
	}

	.worlds-pick-hint {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.worlds-pick-cta {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.85rem 1.25rem;
		font: inherit;
		font-size: var(--t-14);
		font-weight: 700;
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
		border-radius: var(--r-pill);
		cursor: pointer;
		transition: background 140ms ease;
	}

	.worlds-pick-cta:hover {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.worlds-locked-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.8rem;
		padding: 0.9rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border: 1px solid var(--border-base);
		border-left: 3px solid var(--laurel);
		border-radius: var(--r-12);
	}

	.worlds-locked-identity {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0;
		font: inherit;
		background: none;
		border: none;
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
	}

	.worlds-locked-identity:hover .worlds-locked-name {
		color: var(--laurel);
	}

	.worlds-locked-glyph {
		font-size: 1.65rem;
		line-height: 1;
		padding: 0.4rem 0.6rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
	}

	.worlds-locked-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.worlds-locked-name {
		font-family: var(--font-display);
		font-size: var(--t-15, 0.95rem);
		font-weight: 600;
		color: var(--text-base);
	}

	.worlds-locked-meta {
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.worlds-leave {
		appearance: none;
		padding: 0.5rem 0.85rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.worlds-leave:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
