<script lang="ts">
	import type { Doc } from '@junobuild/core';
	import { Check, ChevronRight, Copy, Plus, Share2 } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import FriendsEmptyState from '$lib/components/social/FriendsEmptyState.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { REFERRAL_MAX_PAID } from '$lib/constants/referral.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { leaderboard } from '$lib/derived/leaderboard.derived';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getMyReferralCode } from '$lib/services/referral.services';
	import {
		acceptFriendRequest,
		cancelFriendRequest,
		rejectFriendRequest,
		sendFriendRequest,
		unfriendUser
	} from '$lib/services/relation.services';
	import {
		friendRequestsStore,
		friendsListStore,
		friendsRelationsLoadedStore,
		refreshFriendRelations,
		sentFriendRequestsStore
	} from '$lib/stores/friends.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { profilesStore } from '$lib/stores/profiles.store';
	import { userStore } from '$lib/stores/user.store';
	import type { UserProfile } from '$lib/types/profile';
	import type { Relation } from '$lib/types/relation';
	import { writeToClipboard } from '$lib/utils/clipboard.utils';
	import { shortenWithMiddleEllipsis } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';

	/**
	 * Friends — the Social tab. Lives only inside Social; there is no
	 * standalone `/friends` route.
	 *
	 * Sections (top → bottom):
	 *  1. Invite hero — +500 VXP eyebrow, remaining-invites cap line,
	 *     social-proof row when referrals are paid, Share + Copy CTA row.
	 *  2. Outgoing invites — friend requests this user has sent that
	 *     are still pending the recipient's first call.
	 *  3. Incoming friend requests — each expandable to Accept / Reject.
	 *  4. Friends-ranked list — rank 01, 02, …, h2h accuracy delta chip,
	 *     sticky YOU row pinned at the bottom of the rank list.
	 *  5. Friends feed — placeholder until a friend activity service
	 *     lands; today renders quiet serif-italic copy.
	 *  6. Global ranking link — viewer's leaderboard rank with chevron;
	 *     rank-delta chip deferred until the satellite ships a
	 *     historical-rank snapshot.
	 *  7. Friend mini-profile bottom sheet — opens on row tap; surfaces
	 *     stats + h2h accuracy delta + Remove.
	 *  8. Add-by-handle bottom sheet — `@`-prefixed input. Today writes
	 *     through to `sendFriendRequest` which expects a principal text;
	 *     the visual handle prefix is the user-facing affordance until
	 *     the satellite gains nickname-based lookup.
	 *
	 * The component reuses the existing `friendsListStore` /
	 * `friendRequestsStore` infrastructure rather than re-fetching, so the
	 * inbox bell + Social tab badge stay in lockstep.
	 */

	const VXP_DECIMALS = VXP_TOKEN.decimals;
	const REFERRAL_BONUS_VXP = 500n * 10n ** BigInt(VXP_DECIMALS);

	const userPrincipal = $derived($authPrincipal ?? '');
	const myProfile = $derived($userStore.profile);

	const activeRelations = $derived($friendsListStore);
	const pendingReceived = $derived($friendRequestsStore);
	const pendingSent = $derived($sentFriendRequestsStore);
	const friendProfiles = $derived($profilesStore);
	const loading = $derived(!$friendsRelationsLoadedStore);

	const otherParticipant = (relation: Relation): string | undefined =>
		relation.participants.find((p) => p !== userPrincipal);

	let inviteCode = $state<string | undefined>(undefined);

	onMount(() => {
		void refreshFriendRelations();

		// Fetch the viewer's referral code so the hero can render the canonical
		// `vici.market/i/{code}` URL. The code is assigned by the satellite profile hook
		// on first profile create; if missing today the next profile save backfills it
		// (see `referral.services.ts`).
		void (async () => {
			try {
				inviteCode = await getMyReferralCode();
			} catch {
				inviteCode = undefined;
			}
		})();
	});

	// ── Invite hero ──────────────────────────────────────────────────
	// Single canonical URL — `https://{origin}/i/{code}`. Same string for preview, copy,
	// and native-share so what the user sees is exactly what gets pasted.
	const inviteUrl = $derived(
		inviteCode !== undefined && typeof window !== 'undefined'
			? `${window.location.origin}/i/${inviteCode}`
			: undefined
	);
	const inviteUrlDisplay = $derived(
		inviteUrl !== undefined ? inviteUrl.replace(/^https?:\/\//, '') : undefined
	);
	const bonusLabel = $derived(formatVxpBalance({ value: REFERRAL_BONUS_VXP }));

	// Social-proof line above the invite buttons —
	// `{N} friends joined · +{N*500} VXP earned`. The satellite doesn't
	// yet expose a "referral redemptions" counter, so we approximate
	// using the visible friends count as a reasonable lower-bound;
	// the bonus per redemption is fixed at 500 VXP.
	const referralFriendsCount = $derived(activeRelations.length);
	const referralVxpEarned = $derived(referralFriendsCount * 500);
	const referralsRemaining = $derived(Math.max(0, REFERRAL_MAX_PAID - referralFriendsCount));
	let copied = $state(false);
	let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

	const triggerCopyFeedback = () => {
		copied = true;

		if (copyResetTimer) {
			clearTimeout(copyResetTimer);
		}

		copyResetTimer = setTimeout(() => {
			copied = false;
		}, 1800);
	};

	const handleCopy = async () => {
		if (!inviteUrl) {
			return;
		}

		const ok = await writeToClipboard(inviteUrl);

		if (ok) {
			triggerCopyFeedback();
		} else {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'social.friends.title' }),
				message: t({
					locale: $localeStore,
					key: 'profile.dashboard.referrals.code_pending_failed'
				}),
				type: 'error',
				duration: 2000
			});
		}
	};

	const handleShare = async () => {
		if (!inviteUrl || !inviteCode) {
			return;
		}

		const shareText = t({
			locale: $localeStore,
			key: 'profile.dashboard.referrals.share_text',
			params: { code: inviteCode, amount: bonusLabel }
		});
		const shareTitle = t({
			locale: $localeStore,
			key: 'profile.dashboard.referrals.share_title'
		});

		if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
			try {
				await navigator.share({ title: shareTitle, text: shareText, url: inviteUrl });

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

	// ── Friends ranked list ─────────────────────────────────────────
	const myAccuracy = $derived(myProfile?.accuracy ?? 0);

	interface RankedFriend {
		relation: Relation;
		friendId: string;
		profile: UserProfile | undefined;
		accuracy: number;
		streak: number;
		points: number;
	}

	const rankedFriends = $derived.by(() => {
		const rows: RankedFriend[] = [];

		for (const relation of activeRelations) {
			const friendId = otherParticipant(relation);

			if (friendId) {
				const profile = friendProfiles.get(friendId);
				rows.push({
					relation,
					friendId,
					profile,
					accuracy: profile?.accuracy ?? 0,
					streak: profile?.streak ?? 0,
					points: profile?.points ?? 0
				});
			}
		}

		return rows.sort((a, b) => b.accuracy - a.accuracy);
	});

	let showAllRanked = $state(false);
	const visibleRanked = $derived(showAllRanked ? rankedFriends : rankedFriends.slice(0, 10));
	const hiddenRankedCount = $derived(Math.max(0, rankedFriends.length - visibleRanked.length));

	const formatPct = (value: number): string => {
		// `value` is a 0..100 accuracy percentage — see
		// `profile.services.ts` `calculateAndSyncStats`, which writes
		// `(wins / settledCount) * 100`. Render with one decimal —
		// `48.4%`.
		const pct = Math.round(value * 10) / 10;

		return `${pct}%`;
	};

	const formatH2h = (friendAccuracy: number): { value: string; ahead: boolean } => {
		// Inputs are 0..100 percentages, so the diff is in
		// percentage-point units already. One-decimal output.
		const diff = Math.round((myAccuracy - friendAccuracy) * 10) / 10;
		const ahead = diff >= 0;
		const sign = ahead && diff !== 0 ? '+' : '';

		return { value: `${sign}${diff}`, ahead };
	};

	// ── Friend mini-profile bottom sheet ────────────────────────────
	let openProfile = $state<RankedFriend | undefined>(undefined);
	let removingFriendId = $state<string | undefined>(undefined);

	const openFriendSheet = (row: RankedFriend) => {
		openProfile = row;
	};

	const closeFriendSheet = () => {
		openProfile = undefined;
	};

	const handleRemoveFriend = async () => {
		if (!openProfile) {
			return;
		}

		const { friendId } = openProfile;
		removingFriendId = friendId;

		try {
			await unfriendUser({ target: friendId, sender: userPrincipal });
			openProfile = undefined;
			await refreshFriendRelations();
		} catch (err: unknown) {
			console.error(err);
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'social.friends.title' }),
				message: t({ locale: $localeStore, key: 'social.friends.error.unfriend_failed' }),
				type: 'error'
			});
		} finally {
			removingFriendId = undefined;
		}
	};

	// ── Pending invites ─────────────────────────────────────────────
	let processingKey = $state<string | undefined>(undefined);
	let expandedPendingKey = $state<string | undefined>(undefined);

	const togglePending = (key: string) => {
		expandedPendingKey = expandedPendingKey === key ? undefined : key;
	};

	const handleAccept = async (doc: Doc<Relation>) => {
		processingKey = doc.key;

		try {
			await acceptFriendRequest({ currentRelation: doc });
			await refreshFriendRelations();
			expandedPendingKey = undefined;
		} catch (err: unknown) {
			console.error(err);
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'social.friends.title' }),
				message: t({ locale: $localeStore, key: 'social.friends.error.send_failed' }),
				type: 'error'
			});
		} finally {
			processingKey = undefined;
		}
	};

	const handleReject = async (doc: Doc<Relation>) => {
		processingKey = doc.key;

		try {
			await rejectFriendRequest({ currentRelation: doc });
			await refreshFriendRelations();
			expandedPendingKey = undefined;
		} catch (err: unknown) {
			console.error(err);
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'social.friends.title' }),
				message: t({ locale: $localeStore, key: 'social.friends.error.send_failed' }),
				type: 'error'
			});
		} finally {
			processingKey = undefined;
		}
	};

	const handleCancelSent = async (doc: Doc<Relation>) => {
		processingKey = doc.key;

		try {
			await cancelFriendRequest({ currentRelation: doc });
			await refreshFriendRelations();
		} catch (err: unknown) {
			console.error(err);
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'social.friends.title' }),
				message: t({ locale: $localeStore, key: 'social.friends.error.cancel_failed' }),
				type: 'error'
			});
		} finally {
			processingKey = undefined;
		}
	};

	// ── Add-by-handle bottom sheet ──────────────────────────────────
	let addSheetOpen = $state(false);
	let addInput = $state('');
	let adding = $state(false);

	const openAddSheet = () => {
		addSheetOpen = true;
		addInput = '';
	};

	const closeAddSheet = () => {
		addSheetOpen = false;
		addInput = '';
	};

	const handleAddSubmit = async () => {
		const trimmed = addInput.trim();

		if (!trimmed) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'social.friends.title' }),
				message: t({ locale: $localeStore, key: 'friends.add.error.empty' }),
				type: 'warning'
			});

			return;
		}

		adding = true;

		try {
			// The Friends UI accepts either `@handle` (nickname) or a raw
			// principal text; the service resolves a handle to a principal
			// via `searchProfiles` before calling the satellite, which only
			// accepts principal text. Typed errors (`not_found` / `self`)
			// are mapped to i18n strings below.
			await sendFriendRequest({ target: trimmed, sender: userPrincipal });
			await refreshFriendRelations();
			addSheetOpen = false;
			addInput = '';
		} catch (err: unknown) {
			console.error(err);

			const code = err instanceof Error ? err.message : '';
			const messageKey =
				code === 'not_found'
					? 'social.friends.error.not_found'
					: code === 'self'
						? 'social.friends.error.self'
						: 'social.friends.error.send_failed';

			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'social.friends.title' }),
				message: t({ locale: $localeStore, key: messageKey }),
				type: 'error'
			});
		} finally {
			adding = false;
		}
	};

	// ── Global ranking link ─────────────────────────────────────────
	const globalLeaderboard = $derived<UserProfile[]>($leaderboard);
	const myRank = $derived.by(() => {
		const idx = globalLeaderboard.findIndex((entry) => entry.owner === userPrincipal);

		return idx === -1 ? undefined : idx + 1;
	});

	const goToLeaderboard = () => {
		// Leaderboard lives at /social/leaderboard; this keeps the user inside
		// the Social shell instead of forking to a sibling tab.
		void goto(resolve(`${AppPath.Social}/leaderboard`));
	};
</script>

<div class="friends-tab">
	<!-- Invite hero ─────────────────────────────────────────────── -->
	<section class="invite-hero" aria-labelledby="invite-hero-title">
		<span class="invite-eyebrow">
			<span class="num invite-bonus">+{bonusLabel} VXP</span>
			<span class="invite-eyebrow-suffix">
				{t({ locale: $localeStore, key: 'social.friends.invite.eyebrow_suffix' })}
			</span>
		</span>
		<h3 id="invite-hero-title" class="invite-title">
			{t({ locale: $localeStore, key: 'social.friends.invite.title' })}
		</h3>
		<p class="invite-sub">
			{t({
				locale: $localeStore,
				key: 'social.friends.invite.sub',
				params: { amount: bonusLabel }
			})}
			<span class="num invite-cap">
				{t({
					locale: $localeStore,
					key: 'social.friends.invite.cap_remaining',
					params: { remaining: referralsRemaining }
				})}
			</span>
		</p>

		{#if referralFriendsCount > 0}
			<div class="invite-proof num">
				<span>
					<b>{referralFriendsCount}</b>
					{t({
						locale: $localeStore,
						key:
							referralFriendsCount === 1
								? 'social.friends.invite.proof_one'
								: 'social.friends.invite.proof_many'
					})}
				</span>
				<span class="invite-proof-dot" aria-hidden="true">·</span>
				<span class="invite-proof-earned">
					<b>+{referralVxpEarned.toLocaleString()}</b>
					{t({ locale: $localeStore, key: 'social.friends.invite.proof_earned' })}
				</span>
			</div>
		{/if}

		<div class="invite-row">
			<BaseButton
				class="invite-share"
				onclick={handleShare}
				status={inviteUrl ? 'enabled' : 'disabled'}
			>
				<Share2 aria-hidden="true" size={14} strokeWidth={1.8} />
				<span>
					{t({ locale: $localeStore, key: 'social.friends.invite.share' })}
				</span>
			</BaseButton>
			<BaseButton
				class="invite-copy"
				onclick={handleCopy}
				status={inviteUrl ? 'enabled' : 'disabled'}
			>
				{#if copied}
					<span class="invite-copy-inner" in:fade={{ duration: 150 }}>
						<Check aria-hidden="true" size={13} strokeWidth={1.8} />
						{t({ locale: $localeStore, key: 'social.friends.invite.copied' })}
					</span>
				{:else}
					<span class="invite-copy-inner" in:fade={{ duration: 150 }}>
						<Copy aria-hidden="true" size={13} strokeWidth={1.8} />
						{t({ locale: $localeStore, key: 'social.friends.invite.copy' })}
					</span>
				{/if}
			</BaseButton>
		</div>

		{#if inviteUrlDisplay}
			<div class="invite-url">
				<!-- Canonical share URL — exactly the string copy/share emits. The `/i/{code}`
				     path is resolved by `src/routes/i/[code]/+page.svelte`. -->
				<span class="num">{inviteUrlDisplay}</span>
			</div>
		{/if}
	</section>

	<!-- Pending sent — outgoing invites still waiting on the recipient's
	     first call. Sits directly under the invite hero. -->
	{#if pendingSent.length > 0}
		<section class="friends-section">
			<header class="section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'social.friends.sent.eyebrow' })}</span>
				<span class="num section-count">{pendingSent.length}</span>
			</header>
			<ul class="pending-list">
				{#each pendingSent as doc (doc.key)}
					{@const friendId = otherParticipant(doc.data)}
					{@const profile = friendId ? friendProfiles.get(friendId) : undefined}
					{@const isProcessing = processingKey === doc.key}
					<li>
						<div class="pending-row pending-row-sent">
							<span class="pending-avatar">
								<Avatar
									class="h-full w-full"
									avatar={profile?.avatar}
									nickname={profile?.nickname}
									owner={profile?.owner ?? friendId ?? ''}
								/>
							</span>
							<span class="pending-copy">
								<span class="pending-name">
									@{profile?.nickname ??
										t({ locale: $localeStore, key: 'social.friends.unknown_nickname' })}
								</span>
								<span class="num pending-meta">
									{friendId ? shortenWithMiddleEllipsis({ text: friendId, splitLength: 5 }) : ''}
								</span>
							</span>
							<BaseButton
								class="pending-cancel"
								onclick={() => handleCancelSent(doc)}
								status={isProcessing ? 'pending' : 'enabled'}
							>
								{t({ locale: $localeStore, key: 'social.friends.action.cancel' })}
							</BaseButton>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Incoming friend requests ────────────────────────────────── -->
	{#if pendingReceived.length > 0}
		<section class="friends-section">
			<header class="section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'social.friends.pending.eyebrow' })}</span>
				<span class="num section-count">{pendingReceived.length}</span>
			</header>
			<ul class="pending-list">
				{#each pendingReceived as doc (doc.key)}
					{@const friendId = otherParticipant(doc.data)}
					{@const profile = friendId ? friendProfiles.get(friendId) : undefined}
					{@const isProcessing = processingKey === doc.key}
					{@const isOpen = expandedPendingKey === doc.key}
					<li>
						<button
							class="pending-row"
							class:is-open={isOpen}
							onclick={() => togglePending(doc.key)}
							type="button"
						>
							<span class="pending-avatar">
								<Avatar
									class="h-full w-full"
									avatar={profile?.avatar}
									nickname={profile?.nickname}
									owner={profile?.owner ?? friendId ?? ''}
								/>
							</span>
							<span class="pending-copy">
								<span class="pending-name">
									@{profile?.nickname ??
										t({ locale: $localeStore, key: 'social.friends.unknown_nickname' })}
								</span>
								<span class="num pending-meta">
									{friendId ? shortenWithMiddleEllipsis({ text: friendId, splitLength: 5 }) : ''}
								</span>
							</span>
							<span class="num pending-state">
								{isOpen
									? t({ locale: $localeStore, key: 'social.friends.pending.close' })
									: t({ locale: $localeStore, key: 'social.friends.pending.waiting' })}
							</span>
						</button>
						{#if isOpen}
							<div class="pending-actions">
								<BaseButton
									class="pending-action pending-accept"
									onclick={() => handleAccept(doc)}
									status={isProcessing ? 'pending' : 'enabled'}
								>
									{t({ locale: $localeStore, key: 'social.friends.action.accept' })}
								</BaseButton>
								<BaseButton
									class="pending-action pending-reject"
									onclick={() => handleReject(doc)}
									status={isProcessing ? 'pending' : 'enabled'}
								>
									{t({ locale: $localeStore, key: 'social.friends.action.reject' })}
								</BaseButton>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Friends ranked ─────────────────────────────────────────── -->
	{#if loading}
		<div class="friends-loading">
			<LoadingSpinner />
		</div>
	{:else if rankedFriends.length > 0}
		<section class="friends-section">
			<header class="section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'social.friends.ranked.eyebrow' })}</span>
				<span class="ranked-head-right">
					<button
						class="ranked-add"
						aria-label={t({ locale: $localeStore, key: 'social.friends.add.cta' })}
						onclick={openAddSheet}
						type="button"
					>
						<Plus size={12} strokeWidth={2} />
						{t({ locale: $localeStore, key: 'social.friends.ranked.add' })}
					</button>
					<span class="num section-count">{rankedFriends.length}</span>
				</span>
			</header>
			<ul class="ranked-list">
				{#each visibleRanked as row, idx (row.friendId)}
					{@const h2h = formatH2h(row.accuracy)}
					<li>
						<button class="ranked-row" onclick={() => openFriendSheet(row)} type="button">
							<span class="num ranked-num">{String(idx + 1).padStart(2, '0')}</span>
							<span class="ranked-avatar">
								<Avatar
									class="h-full w-full"
									avatar={row.profile?.avatar}
									nickname={row.profile?.nickname}
									owner={row.profile?.owner ?? row.friendId}
								/>
							</span>
							<span class="ranked-copy">
								<span class="ranked-name">
									@{row.profile?.nickname ??
										t({ locale: $localeStore, key: 'social.friends.unknown_nickname' })}
								</span>
								<span class="num ranked-meta">
									{formatPct(row.accuracy)} · {row.streak}d
								</span>
							</span>
							<span class="ranked-h2h num" class:is-ahead={h2h.ahead} class:is-behind={!h2h.ahead}>
								{h2h.value}
							</span>
						</button>
					</li>
				{/each}
				{#if hiddenRankedCount > 0}
					<li>
						<button class="ranked-see-all" onclick={() => (showAllRanked = true)} type="button">
							{t({
								locale: $localeStore,
								key: 'social.friends.ranked.see_all',
								params: { count: rankedFriends.length }
							})}
						</button>
					</li>
				{/if}
				<li class="ranked-li-you">
					<div class="ranked-row ranked-row-you">
						<span class="num ranked-num is-you">
							{t({ locale: $localeStore, key: 'social.friends.ranked.you' })}
						</span>
						<span class="ranked-avatar">
							<Avatar
								class="h-full w-full"
								avatar={myProfile?.avatar}
								nickname={myProfile?.nickname}
								owner={userPrincipal}
							/>
						</span>
						<span class="ranked-copy">
							<span class="ranked-name ranked-name-you">
								@{myProfile?.nickname ??
									t({ locale: $localeStore, key: 'social.friends.unknown_nickname' })}
							</span>
							<span class="num ranked-meta">
								{formatPct(myAccuracy)} · {myProfile?.streak ?? 0}d
							</span>
						</span>
						<span class="num ranked-h2h-you">
							{formatVxpBalance({
								value: BigInt(myProfile?.points ?? 0) * 10n ** BigInt(VXP_DECIMALS)
							})}
						</span>
					</div>
				</li>
			</ul>
		</section>
	{:else}
		<FriendsEmptyState />
	{/if}

	<!-- Friends feed ──────────────────────────────────────────── -->
	<!--
		TODO: Wire a `getFriendsFeed` service once the satellite exposes a
		recent-activity stream scoped to the viewer's social graph. Until
		then we render a quiet copy block so the surface stays
		discoverable without faking data.
	-->
	{#if !loading && rankedFriends.length > 0}
		<section class="friends-section">
			<header class="section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'social.friends.feed.eyebrow' })}</span>
			</header>
			<div class="feed-empty">
				<p class="feed-empty-copy">
					{t({ locale: $localeStore, key: 'social.friends.feed.empty_a' })}
					<span class="feed-empty-italic">
						{t({ locale: $localeStore, key: 'social.friends.feed.empty_b' })}
					</span>
				</p>
			</div>
		</section>
	{/if}

	<!-- Global ranking link ─────────────────────────────────── -->
	<button class="global-link" onclick={goToLeaderboard} type="button">
		<span class="global-link-copy">
			<span class="num global-link-eyebrow">
				{t({ locale: $localeStore, key: 'social.friends.global.eyebrow' })}
			</span>
			<span class="global-link-value num">
				<span class="global-link-rank">
					{myRank !== undefined
						? `#${myRank}`
						: t({ locale: $localeStore, key: 'social.friends.global.unranked' })}
				</span>
				<!-- Rank delta (↑/↓ N this week) deferred until the satellite
				     ships a `previousRank` snapshot. -->
			</span>
		</span>
		<ChevronRight aria-hidden="true" size={18} strokeWidth={1.6} />
	</button>
</div>

<!-- Friend mini-profile bottom sheet ──────────────────────────── -->
{#if openProfile}
	{@const row = openProfile}
	{@const h2h = formatH2h(row.accuracy)}
	<div
		class="friends-sheet-scrim"
		onclick={closeFriendSheet}
		onkeydown={(e) => e.key === 'Escape' && closeFriendSheet()}
		role="presentation"
	>
		<div
			class="friends-sheet"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<div class="friends-sheet-grip" aria-hidden="true"></div>
			<div class="friends-sheet-head">
				<span class="friends-sheet-avatar">
					<Avatar
						class="h-full w-full"
						avatar={row.profile?.avatar}
						nickname={row.profile?.nickname}
						owner={row.profile?.owner ?? row.friendId}
					/>
				</span>
				<div class="friends-sheet-head-copy">
					<span class="friends-sheet-name">
						@{row.profile?.nickname ??
							t({ locale: $localeStore, key: 'social.friends.unknown_nickname' })}
					</span>
					<span class="num friends-sheet-sub">
						{shortenWithMiddleEllipsis({ text: row.friendId, splitLength: 6 })}
					</span>
				</div>
			</div>

			<div class="friends-sheet-stats">
				<div class="friends-sheet-stat">
					<span class="friends-sheet-lbl">
						{t({ locale: $localeStore, key: 'social.friends.sheet.accuracy' })}
					</span>
					<span class="friends-sheet-val num">{formatPct(row.accuracy)}</span>
				</div>
				<div class="friends-sheet-stat">
					<span class="friends-sheet-lbl">
						{t({ locale: $localeStore, key: 'social.friends.sheet.streak' })}
					</span>
					<span class="friends-sheet-val num">{row.streak}d</span>
				</div>
				<div class="friends-sheet-stat">
					<span class="friends-sheet-lbl">
						{t({ locale: $localeStore, key: 'social.friends.sheet.vxp' })}
					</span>
					<span class="friends-sheet-val num">
						{formatVxpBalance({ value: BigInt(row.points) * 10n ** BigInt(VXP_DECIMALS) })}
					</span>
				</div>
			</div>

			<div class="friends-sheet-h2h" class:is-ahead={h2h.ahead} class:is-behind={!h2h.ahead}>
				<span class="friends-sheet-lbl">
					{t({ locale: $localeStore, key: 'social.friends.sheet.h2h' })}
				</span>
				<span class="friends-sheet-val num">
					{h2h.ahead
						? t({
								locale: $localeStore,
								key: 'social.friends.sheet.h2h_ahead',
								params: { delta: h2h.value.replace('+', '') }
							})
						: t({
								locale: $localeStore,
								key: 'social.friends.sheet.h2h_behind',
								params: { delta: h2h.value.replace('-', '') }
							})}
				</span>
			</div>

			<BaseButton
				class="friends-sheet-remove"
				onclick={handleRemoveFriend}
				status={removingFriendId === row.friendId ? 'pending' : 'enabled'}
			>
				{t({ locale: $localeStore, key: 'social.friends.sheet.remove' })}
			</BaseButton>
			<BaseButton class="friends-sheet-close" onclick={closeFriendSheet}>
				{t({ locale: $localeStore, key: 'social.friends.sheet.close' })}
			</BaseButton>
		</div>
	</div>
{/if}

<!-- Add-by-handle bottom sheet ───────────────────────────────── -->
{#if addSheetOpen}
	<div
		class="friends-sheet-scrim"
		onclick={closeAddSheet}
		onkeydown={(e) => e.key === 'Escape' && closeAddSheet()}
		role="presentation"
	>
		<div
			class="friends-sheet"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<div class="friends-sheet-grip" aria-hidden="true"></div>
			<h3 class="friends-sheet-title">
				{t({ locale: $localeStore, key: 'social.friends.add.sheet_title' })}
			</h3>
			<p class="friends-sheet-blurb">
				{t({ locale: $localeStore, key: 'social.friends.add.sheet_blurb' })}
			</p>
			<div class="friends-add-input">
				<span class="friends-add-prefix" aria-hidden="true">@</span>
				<input
					class="friends-add-field num"
					aria-label={t({ locale: $localeStore, key: 'social.friends.add.cta' })}
					autocapitalize="none"
					autocomplete="off"
					autocorrect="off"
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							void handleAddSubmit();
						}
					}}
					placeholder={t({ locale: $localeStore, key: 'social.friends.add.placeholder' })}
					spellcheck="false"
					type="text"
					bind:value={addInput}
				/>
			</div>
			<p class="friends-add-footnote num">
				{t({
					locale: $localeStore,
					key: 'social.friends.add.invite_hint',
					params: { amount: bonusLabel }
				})}
			</p>
			<BaseButton
				class="friends-sheet-remove friends-sheet-primary"
				onclick={handleAddSubmit}
				status={adding ? 'pending' : addInput.trim().length === 0 ? 'disabled' : 'enabled'}
			>
				{adding
					? t({ locale: $localeStore, key: 'social.friends.add.sending' })
					: t({ locale: $localeStore, key: 'social.friends.add.cta' })}
			</BaseButton>
			<BaseButton class="friends-sheet-close" onclick={closeAddSheet}>
				{t({ locale: $localeStore, key: 'social.friends.sheet.close' })}
			</BaseButton>
		</div>
	</div>
{/if}

<style lang="postcss">
	.friends-tab {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 40rem;
		margin: 0 auto;
		padding: 0.85rem 1rem 5rem;
	}

	/* ── Invite hero ────────────────────────────────────────── */
	/* Invite hero — accent gradient wash over the raised surface,
	   gold-tinted border. */
	.invite-hero {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1.1rem 1.1rem 1rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 30%, var(--border-base));
		border-radius: var(--r-12);
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--color-primary) 10%, transparent),
				color-mix(in srgb, var(--color-primary) 2%, transparent) 70%,
				transparent
			),
			var(--bg-popover);
	}

	.invite-eyebrow {
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.invite-bonus {
		color: var(--color-primary);
		font-size: var(--t-12);
		letter-spacing: var(--tracking-wide);
	}

	/* Invite headline: display sans-serif, 20 px, weight 600, slight
	   negative tracking. NO serif-italic — the surrounding card uses
	   serif-italic for the *editorial* `Invite a friend.` lede in
	   other surfaces, but this hero block leads with a structural
	   prompt, not an editorial accent, so it stays on the display
	   stack to read as a clear call to action. */
	.invite-title {
		margin: 0 0 4px;
		color: var(--text-base);
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		letter-spacing: -0.015em;
	}

	.invite-sub {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-snug);
	}

	.invite-cap {
		margin-left: 0.35rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.invite-proof {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.4rem;
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.invite-proof b {
		color: var(--text-base);
		font-weight: 700;
	}

	.invite-proof-dot {
		color: var(--text-muted);
	}

	.invite-proof-earned {
		color: var(--color-primary);
	}

	.invite-proof-earned b {
		color: var(--color-primary);
	}

	.invite-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.25rem;
	}

	:global(.invite-share) {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.65rem 1rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
		border-radius: var(--r-pill);
		background: var(--color-primary);
		color: var(--color-primary-foreground, white);
		font-size: var(--t-13);
		font-weight: 700;
	}

	:global(.invite-copy) {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 700;
	}

	.invite-copy-inner {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	/* Dashed-border pill at the bottom of the hero — proto's
	   `.friends-invite-url` (app.css:4264). */
	.invite-url {
		padding: 0.45rem 0.6rem;
		border: 1px dashed var(--border-base);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--text-base) 3%, transparent);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-12);
	}

	/* ── Sections ──────────────────────────────────────────── */
	.friends-section {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.section-eyebrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.section-count {
		color: var(--color-primary);
	}

	.ranked-head-right {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Accent-tinted chip — proto `.friends-add-btn` (app.css:4424-4435). */
	.ranked-add {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--border-base));
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
		color: var(--color-primary);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease;
	}

	.ranked-add:hover {
		background: color-mix(in srgb, var(--color-primary) 14%, transparent);
		border-color: color-mix(in srgb, var(--color-primary) 40%, var(--border-base));
	}

	/* ── Pending list ──────────────────────────────────────── */
	/* Single unified card with internal dividers — proto pattern
	   (`.friends-pending-list`, app.css:4285-4311). Per-row borders
	   are replaced by a `border-bottom` on each `<li>` except last. */
	.pending-list {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-popover);
		overflow: hidden;
	}

	.pending-list > li + li {
		border-top: 1px solid var(--border-base);
	}

	.pending-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		padding: 0.7rem 0.85rem;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background 140ms ease;
	}

	.pending-row:hover {
		background: color-mix(in srgb, var(--text-base) 3%, transparent);
	}

	.pending-row.is-open {
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.pending-row-sent {
		cursor: default;
	}

	.pending-row-sent:hover {
		background: transparent;
	}

	.pending-avatar {
		display: inline-flex;
		overflow: hidden;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: var(--r-pill);
		background: var(--bg-popover);
	}

	.pending-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.1rem;
	}

	.pending-name {
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pending-meta {
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.pending-state {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.pending-actions {
		display: flex;
		gap: 0.4rem;
		padding: 0.5rem 0.85rem 0.7rem;
		background: color-mix(in srgb, var(--color-primary) 3%, transparent);
	}

	:global(.pending-action) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.45rem 0.85rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--text-base);
		font-size: var(--t-12);
		font-weight: 700;
	}

	:global(.pending-accept) {
		border-color: color-mix(in srgb, var(--yes) 45%, var(--border-base));
		background: color-mix(in srgb, var(--yes) 16%, var(--bg-surface));
		color: var(--yes);
	}

	:global(.pending-reject) {
		color: var(--no);
	}

	:global(.pending-cancel) {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 700;
	}

	/* ── Ranked list ───────────────────────────────────────── */
	/* Single unified card with internal dividers — proto pattern
	   (`.friends-rank-list`, app.css:4285-4311 + 4407-4411). The
	   list is its own internal-scroll container (`overflow: auto;
	   max-height: 60vh`) so the YOU `<li>` can stick to the bottom
	   of the card on scroll, instead of being trapped by the page
	   scroll context. */
	.ranked-list {
		position: relative;
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-popover);
		overflow: auto;
		max-height: 60vh;
	}

	.ranked-list > li + li {
		border-top: 1px solid var(--border-base);
	}

	.ranked-row {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto;
		gap: 0.65rem;
		align-items: center;
		width: 100%;
		padding: 0.7rem 0.85rem;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background 140ms ease;
	}

	.ranked-row:hover {
		background: color-mix(in srgb, var(--text-base) 3%, transparent);
	}

	/* Sticky YOU row — pinned to the bottom edge of the rank list
	   with a gold-tinted backdrop blur. Mirrors proto's
	   `.friends-rank-row-you` (app.css:4396-4406).
	   `position: sticky` lives on the `<li>` wrapper (not the
	   inner `<div>`): a sticky element is constrained by its
	   containing block, and the `<li>` is a direct child of the
	   scrollable `.ranked-list` — putting sticky on the inner
	   `<div>` would constrain it to the `<li>`'s own height, which
	   is the row itself, so no visible sticking. */
	.ranked-li-you {
		position: sticky;
		bottom: 0;
		z-index: 2;
	}

	.ranked-row-you {
		background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-popover));
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		box-shadow: 0 -6px 16px -8px rgba(0, 0, 0, 0.3);
		cursor: default;
	}

	.ranked-row-you:hover {
		background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-popover));
	}

	.ranked-num {
		min-width: 1.5rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-12);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
	}

	.ranked-num.is-you {
		color: var(--color-primary);
	}

	.ranked-avatar {
		display: inline-flex;
		overflow: hidden;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: var(--r-pill);
		background: var(--bg-popover);
	}

	.ranked-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.1rem;
	}

	.ranked-name {
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ranked-name-you {
		color: var(--color-primary);
	}

	.ranked-meta {
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.ranked-h2h {
		padding: 0.2rem 0.5rem;
		border-radius: var(--r-pill);
		font-size: var(--t-12);
		font-weight: 700;
	}

	.ranked-h2h.is-ahead {
		background: var(--yes-wash, color-mix(in srgb, var(--yes) 16%, transparent));
		color: var(--yes);
	}

	.ranked-h2h.is-behind {
		background: color-mix(in srgb, var(--no) 14%, transparent);
		color: var(--no);
	}

	.ranked-h2h-you {
		color: var(--color-primary);
		font-size: var(--t-13);
		font-weight: 700;
	}

	/* "See all N →" sits as the last divider-separated row inside
	   the unified ranked card. Accent text, no border (border-top
	   comes from the shared `li + li` divider rule). Mirrors proto
	   `.friends-see-all` (app.css:4445-4456). */
	.ranked-see-all {
		width: 100%;
		padding: 0.7rem 0.85rem;
		border: 0;
		background: transparent;
		color: var(--color-primary);
		font-family: var(--font-mono);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-wide);
		cursor: pointer;
		text-align: center;
		transition: background 140ms ease;
	}

	.ranked-see-all:hover {
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	/* ── Empty ─────────────────────────────────────────────── */
	.friends-loading {
		display: flex;
		justify-content: center;
		padding: 1.5rem 0;
	}

	/* ── Feed (placeholder) ────────────────────────────────── */
	.feed-empty {
		padding: 0.85rem;
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
	}

	.feed-empty-copy {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-snug);
	}

	.feed-empty-italic {
		color: var(--color-primary);
		font-family: var(--font-serif, var(--font-display, serif));
		font-style: italic;
	}

	/* ── Global link ───────────────────────────────────────── */
	.global-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--border-base);
		border-radius: 1rem;
		background: var(--bg-popover);
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
	}

	.global-link:hover {
		border-color: var(--border-strong);
	}

	.global-link-copy {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.global-link-eyebrow {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.global-link-value {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--t-18);
		font-weight: 800;
	}

	.global-link-rank {
		color: var(--color-primary);
	}

	/* ── Bottom sheet ──────────────────────────────────────── */
	.friends-sheet-scrim {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(6px);
	}

	/* Hide the floating mobile pill-nav while a friends sheet is open —
	 * it sits at the same lower edge as the sheet and clips the close /
	 * primary CTA on short viewports (e.g. with the soft keyboard
	 * open). Matches the behaviour of the shared `BottomSheet`. */
	:global(body:has(.friends-sheet-scrim) .pillnav-wrap) {
		display: none;
	}

	.friends-sheet {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 32rem;
		padding: 0.5rem 1rem 1.25rem;
		border-top-left-radius: 1.25rem;
		border-top-right-radius: 1.25rem;
		background: var(--bg-popover);
		box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.25);
		padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1.25rem);
	}

	.friends-sheet-grip {
		align-self: center;
		width: 2.5rem;
		height: 0.25rem;
		margin: 0.25rem 0 0.85rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 35%, transparent);
	}

	.friends-sheet-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.25rem 0 0.85rem;
	}

	.friends-sheet-avatar {
		display: inline-flex;
		overflow: hidden;
		width: 3rem;
		height: 3rem;
		flex-shrink: 0;
		border-radius: var(--r-pill);
		background: var(--bg-surface);
	}

	.friends-sheet-head-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.15rem;
	}

	.friends-sheet-name {
		color: var(--text-base);
		font-size: var(--t-16);
		font-weight: 700;
	}

	.friends-sheet-sub {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.friends-sheet-title {
		margin: 0.25rem 0 0.35rem;
		color: var(--text-base);
		font-size: var(--t-18);
		font-weight: 600;
	}

	.friends-sheet-blurb {
		margin: 0 0 0.75rem;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-snug);
	}

	.friends-sheet-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		margin-bottom: 0.65rem;
	}

	.friends-sheet-stat {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
	}

	.friends-sheet-lbl {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.friends-sheet-val {
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 700;
	}

	.friends-sheet-h2h {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
		margin-bottom: 0.85rem;
	}

	.friends-sheet-h2h.is-ahead .friends-sheet-val {
		color: var(--yes);
	}

	.friends-sheet-h2h.is-behind .friends-sheet-val {
		color: var(--no);
	}

	:global(.friends-sheet-remove) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--no);
		font-size: var(--t-13);
		font-weight: 700;
	}

	:global(.friends-sheet-primary) {
		border-color: color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
		background: var(--color-primary);
		color: var(--color-primary-foreground, white);
	}

	:global(.friends-sheet-close) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.65rem;
		margin-top: 0.4rem;
		border: 0;
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--text-muted);
		font-size: var(--t-13);
		font-weight: 700;
	}

	.friends-add-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 0.85rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
	}

	.friends-add-prefix {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-14);
		font-weight: 800;
	}

	.friends-add-field {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--text-base);
		font-size: var(--t-13);
		outline: none;
	}

	.friends-add-footnote {
		margin: 0.55rem 0 0.85rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}
</style>
