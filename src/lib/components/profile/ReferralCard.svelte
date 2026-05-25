<script lang="ts">
	import { Check, Copy, Gift, Share2 } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { REFERRAL_MAX_PAID } from '$lib/constants/referral.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { loadProfilesByPrincipals, upsertProfile } from '$lib/services/profile.services';
	import { getMyReferralCode, listMyReferrals } from '$lib/services/referral.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { profilesStore } from '$lib/stores/profiles.store';
	import { userStore } from '$lib/stores/user.store';
	import type { UserProfile } from '$lib/types/profile';
	import type { ReferralListItem } from '$lib/types/referral';
	import { writeToClipboard } from '$lib/utils/clipboard.utils';
	import { shortenWithMiddleEllipsis } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';

	interface Props {
		profile: UserProfile;
	}

	const { profile }: Props = $props();

	let code = $state<string | undefined>(undefined);
	let referrals = $state<ReferralListItem[]>([]);
	let loading = $state(true);
	let loadFailed = $state(false);
	let generating = $state(false);
	let copied = $state(false);
	let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

	// VXP base units → display token amount. Keeps the copy in sync with the satellite constant
	// without re-encoding the magic `500` literal here.
	const bonusLabel = $derived(
		formatVxpBalance({ value: 500n * 10n ** BigInt(VXP_TOKEN.decimals) })
	);

	const paidCount = $derived(
		referrals.filter((r) => r.withinReferrerCap && r.referrerPayout.status !== 'none').length
	);
	const overCapCount = $derived(referrals.filter((r) => !r.withinReferrerCap).length);
	const counterLabel = $derived(
		overCapCount > 0
			? t({
					locale: $localeStore,
					key: 'profile.dashboard.referrals.counter_capped',
					params: { paid: paidCount, max: REFERRAL_MAX_PAID, extra: overCapCount }
				})
			: t({
					locale: $localeStore,
					key: 'profile.dashboard.referrals.counter',
					params: { paid: paidCount, max: REFERRAL_MAX_PAID }
				})
	);

	const refresh = async () => {
		try {
			const [fetched, list] = await Promise.all([getMyReferralCode(), listMyReferrals()]);
			code = fetched;
			referrals = list;
			loadFailed = false;

			if (list.length > 0) {
				// Best-effort hydration of the per-row nickname/avatar cache; failures are swallowed
				// inside `loadProfilesByPrincipals` so a missing profile just renders a shortened
				// principal.
				await loadProfilesByPrincipals({ principals: list.map((r) => r.referee) });
			}
		} catch {
			loadFailed = true;
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		void refresh();

		return () => {
			if (copyResetTimer) {
				clearTimeout(copyResetTimer);
			}
		};
	});

	const handleCopy = async () => {
		if (!code) {
			return;
		}

		const ok = await writeToClipboard(code);

		if (!ok) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'profile.dashboard.referrals.title' }),
				message: t({
					locale: $localeStore,
					key: 'profile.dashboard.referrals.code_pending_failed'
				}),
				type: 'error',
				duration: 2000
			});

			return;
		}

		copied = true;

		if (copyResetTimer) {
			clearTimeout(copyResetTimer);
		}

		copyResetTimer = setTimeout(() => {
			copied = false;
		}, 1800);
	};

	const handleShare = async () => {
		if (!code) {
			return;
		}

		const shareText = t({
			locale: $localeStore,
			key: 'profile.dashboard.referrals.share_text',
			params: { code, amount: bonusLabel }
		});
		const shareTitle = t({
			locale: $localeStore,
			key: 'profile.dashboard.referrals.share_title'
		});
		const url =
			typeof window !== 'undefined' ? `${window.location.origin}/signup?ref=${code}` : undefined;

		// `navigator.share` is mobile-first and we don't want a desktop polyfill cascade — fall
		// back to clipboard immediately when the API isn't available. `AbortError` (user
		// dismissed the system share sheet) is also a no-op, not a fallback.
		if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
			try {
				await navigator.share({ title: shareTitle, text: shareText, url });

				return;
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message.toLowerCase() : '';

				if (message.includes('abort')) {
					return;
				}
			}
		}

		await handleCopy();
	};

	const handleGenerate = async () => {
		generating = true;

		try {
			// Re-saving the profile re-triggers the satellite profile hook, which assigns a referral
			// code on first observation. The hook is idempotent and never overwrites an existing
			// code, so this is safe for everyone (returning users without a code, brand-new users,
			// and users who already have one).
			await upsertProfile({ key: profile.owner, data: profile });
			await refresh();

			if (!code) {
				notificationsStore.add({
					title: t({
						locale: $localeStore,
						key: 'profile.dashboard.referrals.code_pending_failed'
					}),
					message: t({
						locale: $localeStore,
						key: 'profile.dashboard.referrals.code_pending'
					}),
					type: 'error'
				});
			}
		} catch {
			notificationsStore.add({
				title: t({
					locale: $localeStore,
					key: 'profile.dashboard.referrals.code_pending_failed'
				}),
				message: t({
					locale: $localeStore,
					key: 'profile.dashboard.referrals.code_pending'
				}),
				type: 'error'
			});
		} finally {
			generating = false;
		}
	};

	const rowStatusKey = (referral: ReferralListItem): MessageKey => {
		if (!referral.withinReferrerCap) {
			return 'profile.dashboard.referrals.row_uncounted';
		}

		const { status } = referral.referrerPayout;

		if (status === 'paid') {
			return 'profile.dashboard.referrals.row_paid';
		}

		if (status === 'processing') {
			return 'profile.dashboard.referrals.row_processing';
		}

		if (status === 'owed') {
			return 'profile.dashboard.referrals.row_owed';
		}

		return 'profile.dashboard.referrals.row_pending';
	};

	const dateFormatter = $derived(
		new Intl.DateTimeFormat($localeStore, { month: 'short', day: 'numeric' })
	);
	const formatRedeemedAt = (ms: number): string => dateFormatter.format(new Date(ms));

	const isViewer = $derived(profile.owner === $userStore.profile?.owner);
</script>

{#if isViewer}
	<section class="referral-card" aria-labelledby="referral-card-title">
		<header class="referral-head">
			<span class="referral-icon" aria-hidden="true">
				<Gift size={16} strokeWidth={1.8} />
			</span>
			<div class="referral-head-copy">
				<h2 id="referral-card-title" class="referral-title">
					{t({ locale: $localeStore, key: 'profile.dashboard.referrals.title' })}
				</h2>
				<p class="referral-tagline">
					{t({
						locale: $localeStore,
						key: 'profile.dashboard.referrals.tagline',
						params: { amount: bonusLabel, max: REFERRAL_MAX_PAID }
					})}
				</p>
			</div>
		</header>

		{#if code}
			<div class="referral-code-row">
				<div class="referral-code-block">
					<span class="referral-code-label">
						{t({ locale: $localeStore, key: 'profile.dashboard.referrals.code_label' })}
					</span>
					<span class="num referral-code">{code}</span>
				</div>
				<div class="referral-actions">
					<BaseButton
						class="referral-action-btn"
						aria-label={t({ locale: $localeStore, key: 'profile.dashboard.referrals.copy' })}
						onclick={handleCopy}
					>
						{#if copied}
							<span class="referral-action-icon" in:fade={{ duration: 150 }}>
								<Check class="text-yes" aria-hidden="true" size={15} strokeWidth={2} />
							</span>
						{:else}
							<span class="referral-action-icon" in:fade={{ duration: 150 }}>
								<Copy aria-hidden="true" size={15} strokeWidth={1.8} />
							</span>
						{/if}
						<span class="referral-action-label">
							{t({ locale: $localeStore, key: 'profile.dashboard.referrals.copy' })}
						</span>
					</BaseButton>
					<BaseButton
						class="referral-action-btn referral-action-primary"
						aria-label={t({ locale: $localeStore, key: 'profile.dashboard.referrals.share' })}
						onclick={handleShare}
					>
						<Share2 aria-hidden="true" size={15} strokeWidth={1.8} />
						<span class="referral-action-label">
							{t({ locale: $localeStore, key: 'profile.dashboard.referrals.share' })}
						</span>
					</BaseButton>
				</div>
			</div>

			<p class="referral-counter num" aria-live="polite">{counterLabel}</p>
		{:else if loading}
			<div class="referral-placeholder" aria-busy="true">
				<span class="referral-placeholder-bar"></span>
				<span class="referral-placeholder-bar narrow"></span>
			</div>
		{:else}
			<!--
				Backfill path. Users who created their profile before the referral hook shipped
				don't have a code yet — re-saving the profile re-fires the satellite hook which
				assigns one. We never call the upsert silently because the user owns the
				decision to write back to their profile.
			-->
			<div class="referral-pending">
				<p class="referral-pending-copy">
					{t({ locale: $localeStore, key: 'profile.dashboard.referrals.code_pending' })}
				</p>
				<BaseButton
					class="referral-pending-cta"
					onclick={handleGenerate}
					status={generating ? 'pending' : 'enabled'}
				>
					{generating
						? t({
								locale: $localeStore,
								key: 'profile.dashboard.referrals.code_pending_busy'
							})
						: t({
								locale: $localeStore,
								key: 'profile.dashboard.referrals.code_pending_cta'
							})}
				</BaseButton>
			</div>
		{/if}

		{#if referrals.length > 0}
			<div class="referral-list">
				<h3 class="referral-list-title">
					{t({ locale: $localeStore, key: 'profile.dashboard.referrals.list_title' })}
				</h3>
				<ul>
					{#each referrals as referral (referral.referee)}
						{@const refereeProfile = $profilesStore.get(referral.referee)}
						{@const refereeName = refereeProfile?.nickname
							? `@${refereeProfile.nickname}`
							: shortenWithMiddleEllipsis({ text: referral.referee, splitLength: 5 })}
						<li>
							<span class="referral-row-avatar">
								<Avatar
									class="h-full w-full"
									avatar={refereeProfile?.avatar}
									nickname={refereeProfile?.nickname}
									owner={referral.referee}
								/>
							</span>
							<span class="referral-row-meta">
								<span class="referral-row-name">{refereeName}</span>
								<span class="num referral-row-date">{formatRedeemedAt(referral.redeemedAtMs)}</span>
							</span>
							<span
								class="referral-row-status"
								class:is-monitored={!referral.withinReferrerCap}
								class:is-paid={referral.withinReferrerCap &&
									referral.referrerPayout.status === 'paid'}
								class:is-pending={referral.withinReferrerCap &&
									referral.referrerPayout.status !== 'paid'}
							>
								{t({ locale: $localeStore, key: rowStatusKey(referral) })}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{:else if !loading && !loadFailed && code}
			<div class="referral-empty">
				<p class="referral-empty-title">
					{t({ locale: $localeStore, key: 'profile.dashboard.referrals.empty_title' })}
				</p>
				<p class="referral-empty-sub">
					{t({
						locale: $localeStore,
						key: 'profile.dashboard.referrals.empty_sub',
						params: { amount: bonusLabel }
					})}
				</p>
			</div>
		{/if}

		{#if loadFailed}
			<p class="referral-error">
				{t({ locale: $localeStore, key: 'profile.dashboard.referrals.load_failed' })}
			</p>
		{/if}
	</section>
{/if}

<style lang="postcss">
	.referral-card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem;
		border: 1px solid var(--border-base);
		border-radius: 1.25rem;
		background: var(--bg-popover);
	}

	.referral-head {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
	}

	.referral-icon {
		display: inline-flex;
		width: 1.85rem;
		height: 1.85rem;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.referral-head-copy {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.15rem;
	}

	.referral-title {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 700;
	}

	.referral-tagline {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: var(--leading-snug);
	}

	.referral-code-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 0.75rem;
		border: 1px dashed color-mix(in srgb, var(--color-primary) 35%, var(--border-base));
		border-radius: 0.85rem;
		background: color-mix(in srgb, var(--color-primary) 4%, var(--bg-surface));
	}

	.referral-code-block {
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
		flex-direction: column;
		gap: 0.1rem;
	}

	.referral-code-label {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.referral-code {
		color: var(--text-base);
		font-family: var(--font-mono);
		font-size: var(--t-20);
		font-weight: 800;
		letter-spacing: 0.08em;
	}

	.referral-actions {
		display: flex;
		flex-shrink: 0;
		gap: 0.4rem;
	}

	:global(.referral-action-btn) {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--text-base);
		font-size: var(--t-12);
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	:global(.referral-action-btn:hover) {
		border-color: var(--border-strong);
		background: color-mix(in srgb, var(--color-primary) 6%, var(--bg-surface));
	}

	:global(.referral-action-primary) {
		border-color: color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
		background: color-mix(in srgb, var(--color-primary) 14%, var(--bg-surface));
		color: var(--color-primary);
	}

	:global(.referral-action-primary:hover) {
		background: color-mix(in srgb, var(--color-primary) 20%, var(--bg-surface));
	}

	.referral-action-icon {
		display: inline-flex;
		align-items: center;
	}

	.referral-action-label {
		font-family: inherit;
		font-size: inherit;
	}

	.referral-counter {
		margin: 0;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.referral-pending {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.85rem;
		border: 1px dashed var(--border-base);
		border-radius: 0.85rem;
		background: var(--bg-surface);
	}

	.referral-pending-copy {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-normal);
	}

	:global(.referral-pending-cta) {
		align-self: flex-start;
		padding: 0.45rem 0.85rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--color-primary) 14%, transparent);
		color: var(--color-primary);
		font-size: var(--t-12);
		font-weight: 700;
		cursor: pointer;
	}

	.referral-placeholder {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.referral-placeholder-bar {
		height: 0.85rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--text-base) 8%, transparent);
		animation: referral-shimmer 1.4s ease-in-out infinite;
	}

	.referral-placeholder-bar.narrow {
		width: 60%;
	}

	@keyframes referral-shimmer {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 0.85;
		}
	}

	.referral-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.referral-list-title {
		margin: 0;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.referral-list ul {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.referral-list li {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border-base);
		border-radius: 0.85rem;
		background: var(--bg-surface);
	}

	.referral-row-avatar {
		display: inline-flex;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		overflow: hidden;
		border-radius: 999px;
		background: var(--bg-popover);
	}

	.referral-row-meta {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.referral-row-name {
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.referral-row-date {
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.referral-row-status {
		flex-shrink: 0;
		padding: 0.2rem 0.5rem;
		border-radius: var(--r-pill);
		background: var(--bg-popover);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.referral-row-status.is-paid {
		background: var(--yes-wash);
		color: var(--yes);
	}

	.referral-row-status.is-pending {
		background: color-mix(in srgb, var(--color-primary) 14%, transparent);
		color: var(--color-primary);
	}

	.referral-row-status.is-monitored {
		background: color-mix(in srgb, var(--text-muted) 14%, transparent);
		color: var(--text-muted);
	}

	.referral-empty {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.85rem;
		border: 1px dashed var(--border-base);
		border-radius: 0.85rem;
		background: var(--bg-surface);
	}

	.referral-empty-title {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 700;
	}

	.referral-empty-sub {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: var(--leading-snug);
	}

	.referral-error {
		margin: 0;
		color: var(--no);
		font-size: var(--t-12);
	}
</style>
