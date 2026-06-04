<script lang="ts">
	import type { Doc } from '@junobuild/core';
	import { Check, ChevronRight, Link2, Plus, Share2, Sparkles } from '@lucide/svelte/icons';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FriendsEmptyState from '$lib/components/arena/FriendsEmptyState.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { MILLISECOND_IN_NANOSECONDS, ZERO } from '$lib/constants/app.constants';
	import { REFERRAL_MAX_PAID, referrerRewardBaseUnits } from '$lib/constants/referral.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { VXP_REFERRAL_MONTHLY_CAP } from '$lib/constants/vxp-economy.constants';
	import { globalActivities } from '$lib/derived/activities.derived';
	import { leaderboard } from '$lib/derived/leaderboard.derived';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getMyReferralCode, listMyReferrals } from '$lib/services/referral.services';
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
	import type { ReferralListItem } from '$lib/types/referral';
	import type { Relation } from '$lib/types/relation';
	import type { Activity } from '$lib/types/social';
	import { writeToClipboard } from '$lib/utils/clipboard.utils';
	import {
		formatRelativeAgoFromNs,
		safeBigInt,
		shortenWithMiddleEllipsis
	} from '$lib/utils/format.utils';
	import { haptic } from '$lib/utils/haptics.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { formatVxpBalance, vxpBaseUnitsFromPoints } from '$lib/utils/playground-display.utils';

	/**
	 * Friends — the Arena tab. Lives only inside Arena; there is no
	 * standalone `/friends` route.
	 *
	 * Sections (top → bottom):
	 *  1. Invite hero — +500 VXP eyebrow, remaining-invites cap line,
	 *     social-proof row when referrals are paid, a Share CTA, and an
	 *     inline copy field whose link line doubles as the copy button
	 *     (flips to a green check + fires a haptic on copy).
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
	 * inbox bell + Arena tab badge stay in lockstep.
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

	// The viewer's own redemption rows (newest-first), one per friend who signed up
	// with their code. Each row carries `withinReferrerCap`, which marks whether that
	// redemption actually paid the referrer under the diminishing tier curve + hard cap
	// (see `referral.constants.ts`). Loaded on mount; stays empty on failure so the hero
	// degrades to its zero-state rather than blocking the tab.
	let myReferrals = $state<ReferralListItem[]>([]);

	onMount(() => {
		let alive = true;

		void refreshFriendRelations();

		// Fetch the viewer's referral code so the hero can render the canonical
		// `vici.market/i/{code}` URL. The code is assigned by the satellite profile hook
		// on first profile create; if missing today the next profile save backfills it
		// (see `referral.services.ts`).
		void (async () => {
			try {
				const code = await getMyReferralCode();

				if (alive) {
					inviteCode = code;
				}
			} catch {
				// Guard on `alive` so a late rejection after unmount can't reset
				// state on a destroyed component.
				if (alive) {
					inviteCode = undefined;
				}
			}
		})();

		// Fetch the viewer's redemption rows so the hero's social-proof + cap lines reflect
		// the real, tiered economy rather than a flat per-friend estimate. Fail-open: an
		// error leaves the list empty and the hero falls back to its zero-state.
		void (async () => {
			try {
				const items = await listMyReferrals();

				if (alive) {
					myReferrals = items;
				}
			} catch {
				// Decorative social proof — leave the list empty on failure.
			}
		})();

		return () => {
			alive = false;
		};
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
	// `{N} friends joined · +{cumulative} VXP earned`. Derived from the viewer's actual
	// redemption rows (`listMyReferrals`).
	//
	// `joinedCount` is the TOTAL number of friends who signed up with this code — every row,
	// regardless of payout. The "joined" headline is a factual count, so it must not shrink to
	// the paid subset once a cap is hit.
	//
	// `referralPaidCount` is the CREDITED subset, derived the same way the satellite's
	// `countReferrerCredits` tally does it: a row counts as paid when its `referrerPayout.status`
	// is anything other than `none` (`owed | processing | paid` — anything in flight still
	// consumes a slot). This is the authoritative rule the server uses to feed the diminishing
	// reward curve and enforce both caps, so the hero stays in lockstep with it rather than
	// re-reading the stored `withinReferrerCap` flag.
	//
	// The earned total sums each paid redemption's tier reward by its 1-based order — the i-th
	// paid redemption pays `referrerRewardBaseUnits(i - 1)`, so the diminishing tier table (and
	// its hard cap) is honoured rather than assuming a flat 500 VXP per friend.
	const joinedCount = $derived(myReferrals.length);
	const referralPaidCount = $derived(
		myReferrals.filter(({ referrerPayout }) => referrerPayout.status !== 'none').length
	);
	const referralVxpEarnedBaseUnits = $derived.by(() => {
		let total = ZERO;

		for (let priorPaidCount = 0; priorPaidCount < referralPaidCount; priorPaidCount++) {
			total += referrerRewardBaseUnits(priorPaidCount);
		}

		return total;
	});
	const referralVxpEarnedLabel = $derived(formatVxpBalance({ value: referralVxpEarnedBaseUnits }));

	// Rewarded-invites-left line must honour BOTH the lifetime hard cap and the separate monthly
	// cap — the satellite stops paying when EITHER is hit. The FE row carries both the credited
	// flag (`referrerPayout.status`) and `redeemedAtMs`, so we can mirror the satellite's
	// `countReferrerCredits` two-tally scan locally: count this calendar month's credited rows
	// against `VXP_REFERRAL_MONTHLY_CAP`, count all credited rows against `REFERRAL_MAX_PAID`, and
	// surface the binding (smaller) remainder. Anchored on the UTC month start to match the
	// satellite's `currentMonthStartUtcMs` boundary so the two never disagree on whether the month
	// has rolled over.
	const currentMonthPaidCount = $derived.by(() => {
		const now = new Date();
		const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

		return myReferrals.filter(
			({ referrerPayout, redeemedAtMs }) =>
				referrerPayout.status !== 'none' && redeemedAtMs >= monthStartMs
		).length;
	});
	const referralsRemaining = $derived(
		Math.max(
			0,
			Math.min(
				REFERRAL_MAX_PAID - referralPaidCount,
				VXP_REFERRAL_MONTHLY_CAP - currentMonthPaidCount
			)
		)
	);
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
			// Touch-feedback on copy — pairs the visual green flip with a
			// brief buzz so the affordance reads as committed on mobile.
			haptic('light-tap');
		} else {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'arena.friends.title' }),
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
				title: t({ locale: $localeStore, key: 'arena.friends.title' }),
				message: t({ locale: $localeStore, key: 'arena.friends.error.unfriend_failed' }),
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
				title: t({ locale: $localeStore, key: 'arena.friends.title' }),
				message: t({ locale: $localeStore, key: 'arena.friends.error.send_failed' }),
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
				title: t({ locale: $localeStore, key: 'arena.friends.title' }),
				message: t({ locale: $localeStore, key: 'arena.friends.error.send_failed' }),
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
				title: t({ locale: $localeStore, key: 'arena.friends.title' }),
				message: t({ locale: $localeStore, key: 'arena.friends.error.cancel_failed' }),
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
				title: t({ locale: $localeStore, key: 'arena.friends.title' }),
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
					? 'arena.friends.error.not_found'
					: code === 'self'
						? 'arena.friends.error.self'
						: 'arena.friends.error.send_failed';

			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'arena.friends.title' }),
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
		// Leaderboard lives at /arena/leaderboard; this keeps the user inside
		// the Arena shell instead of forking to a sibling tab.
		void goto(resolve(`${AppPath.Arena}/leaderboard`));
	};

	// ── Friends activity feed ───────────────────────────────────────
	// Drinks from the same cached global activity stream that powers the
	// market trade rows + dashboard feed (populated by
	// `LoaderGlobalActivities`), filtered to the viewer's friend set so
	// no extra fetch is needed and the list stays stale-while-revalidate.
	const friendIdSet = $derived(
		new Set(rankedFriends.map((row) => row.friendId).filter((id): id is string => id.length > 0))
	);

	const friendActivities = $derived(
		$globalActivities.filter((activity) => friendIdSet.has(activity.user)).slice(0, 20)
	);

	// Clap is a local-only acknowledgement today — the satellite has no
	// reaction model, so we track tapped rows in a reactive Set keyed by
	// the row's stable `timestamp#user` id. Surfaced as a data gap.
	const clappedKeys = new SvelteSet<string>();

	const activityKey = (activity: Activity): string => `${activity.timestamp}#${activity.user}`;

	const toggleClap = (activity: Activity) => {
		const key = activityKey(activity);

		if (clappedKeys.has(key)) {
			clappedKeys.delete(key);
		} else {
			clappedKeys.add(key);
			haptic('light-tap');
		}
	};

	const goToMarket = (marketId: string | undefined) => {
		if (marketId === undefined || marketId.length === 0) {
			return;
		}

		void goto(resolve(`${AppPath.Markets}/${marketId}`));
	};

	const feedRelative = (timestampMs: number): string =>
		formatRelativeAgoFromNs({
			// Activity timestamps come from stored docs; a fractional / NaN value
			// would make a bare `BigInt(...)` throw, so coerce defensively.
			timestampNs: safeBigInt({ value: timestampMs }) * MILLISECOND_IN_NANOSECONDS,
			locale: $localeStore
		});
</script>

<div class="friends-tab">
	<!-- Invite hero ─────────────────────────────────────────────── -->
	<section class="invite-hero" aria-labelledby="invite-hero-title">
		<span class="invite-eyebrow">
			<span class="num invite-bonus">+{bonusLabel} VXP</span>
			<span class="invite-eyebrow-suffix">
				{t({ locale: $localeStore, key: 'arena.friends.invite.eyebrow_suffix' })}
			</span>
		</span>
		<h3 id="invite-hero-title" class="invite-title">
			{t({ locale: $localeStore, key: 'arena.friends.invite.title' })}
		</h3>
		<p class="invite-sub">
			{#if referralsRemaining > 0}
				{t({
					locale: $localeStore,
					key: 'arena.friends.invite.sub',
					params: { amount: bonusLabel }
				})}
				<span class="num invite-cap">
					{t({
						locale: $localeStore,
						key: 'arena.friends.invite.cap_remaining',
						params: { remaining: referralsRemaining }
					})}
				</span>
			{:else}
				{t({ locale: $localeStore, key: 'arena.friends.invite.cap_reached' })}
				<span class="num invite-cap">
					{t({ locale: $localeStore, key: 'arena.friends.invite.cap_resets' })}
				</span>
			{/if}
		</p>

		{#if joinedCount > 0}
			<div class="invite-proof num">
				<span>
					<b>{joinedCount}</b>
					{t({
						locale: $localeStore,
						key:
							joinedCount === 1
								? 'arena.friends.invite.proof_one'
								: 'arena.friends.invite.proof_many'
					})}
				</span>
				{#if referralPaidCount > 0}
					<span class="invite-proof-dot" aria-hidden="true">·</span>
					<span class="invite-proof-earned">
						<b>+{referralVxpEarnedLabel}</b>
						{t({ locale: $localeStore, key: 'arena.friends.invite.proof_earned' })}
					</span>
				{/if}
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
					{t({ locale: $localeStore, key: 'arena.friends.invite.share' })}
				</span>
			</BaseButton>
		</div>

		<!-- Inline copy field — the link line IS the copy CTA. Tapping it
		     copies the canonical share URL, flips the trailing chip to a
		     green check + "Copied", and fires a brief haptic. The `/i/{code}`
		     path is resolved by `src/routes/i/[code]/+page.svelte`. -->
		{#if inviteUrlDisplay}
			<BaseButton
				class={`invite-copyfield${copied ? ' is-copied' : ''}`}
				aria-label={copied
					? t({ locale: $localeStore, key: 'arena.friends.invite.copied' })
					: t({ locale: $localeStore, key: 'arena.friends.invite.copy' })}
				onclick={handleCopy}
				status={inviteUrl ? 'enabled' : 'disabled'}
			>
				<Link2 aria-hidden="true" size={14} strokeWidth={1.8} />
				<span class="num invite-copyurl">{inviteUrlDisplay}</span>
				<span class="invite-copychip" aria-hidden="true">
					{#if copied}
						<span class="invite-copy-inner" in:fade={{ duration: 150 }}>
							<Check size={13} strokeWidth={2.4} />
							{t({ locale: $localeStore, key: 'arena.friends.invite.copied' })}
						</span>
					{:else}
						<span class="invite-copy-inner" in:fade={{ duration: 150 }}>
							{t({ locale: $localeStore, key: 'arena.friends.invite.copy' })}
						</span>
					{/if}
				</span>
			</BaseButton>
		{/if}
	</section>

	<!-- Pending sent — outgoing invites still waiting on the recipient's
	     first call. Sits directly under the invite hero. -->
	{#if pendingSent.length > 0}
		<section class="friends-section">
			<header class="section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'arena.friends.sent.eyebrow' })}</span>
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
										t({ locale: $localeStore, key: 'arena.friends.unknown_nickname' })}
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
								{t({ locale: $localeStore, key: 'arena.friends.action.cancel' })}
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
				<span>{t({ locale: $localeStore, key: 'arena.friends.pending.eyebrow' })}</span>
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
										t({ locale: $localeStore, key: 'arena.friends.unknown_nickname' })}
								</span>
								<span class="num pending-meta">
									{friendId ? shortenWithMiddleEllipsis({ text: friendId, splitLength: 5 }) : ''}
								</span>
							</span>
							<span class="num pending-state">
								{isOpen
									? t({ locale: $localeStore, key: 'arena.friends.pending.close' })
									: t({ locale: $localeStore, key: 'arena.friends.pending.waiting' })}
							</span>
						</button>
						{#if isOpen}
							<div class="pending-actions">
								<BaseButton
									class="pending-action pending-accept"
									onclick={() => handleAccept(doc)}
									status={isProcessing ? 'pending' : 'enabled'}
								>
									{t({ locale: $localeStore, key: 'arena.friends.action.accept' })}
								</BaseButton>
								<BaseButton
									class="pending-action pending-reject"
									onclick={() => handleReject(doc)}
									status={isProcessing ? 'pending' : 'enabled'}
								>
									{t({ locale: $localeStore, key: 'arena.friends.action.reject' })}
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
	{:else}
		<section class="friends-section">
			<header class="section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'arena.friends.ranked.eyebrow' })}</span>
				<span class="ranked-head-right">
					<button
						class="ranked-add"
						aria-label={t({ locale: $localeStore, key: 'arena.friends.add.cta' })}
						onclick={openAddSheet}
						type="button"
					>
						<Plus size={12} strokeWidth={2} />
						{t({ locale: $localeStore, key: 'arena.friends.ranked.add' })}
					</button>
					<span class="num section-count">{rankedFriends.length}</span>
				</span>
			</header>
			{#if rankedFriends.length === 0}
				<FriendsEmptyState />
			{:else}
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
											t({ locale: $localeStore, key: 'arena.friends.unknown_nickname' })}
									</span>
									<span class="num ranked-meta">
										{formatPct(row.accuracy)} · {row.streak}d
									</span>
								</span>
								<span
									class="ranked-h2h num"
									class:is-ahead={h2h.ahead}
									class:is-behind={!h2h.ahead}
								>
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
									key: 'arena.friends.ranked.see_all',
									params: { count: rankedFriends.length }
								})}
							</button>
						</li>
					{/if}
					<li class="ranked-li-you">
						<div class="ranked-row ranked-row-you">
							<span class="num ranked-num is-you">
								{t({ locale: $localeStore, key: 'arena.friends.ranked.you' })}
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
										t({ locale: $localeStore, key: 'arena.friends.unknown_nickname' })}
								</span>
								<span class="num ranked-meta">
									{formatPct(myAccuracy)} · {myProfile?.streak ?? 0}d
								</span>
							</span>
							<span class="num ranked-h2h-you">
								{formatVxpBalance({ value: vxpBaseUnitsFromPoints(myProfile?.points ?? 0) })}
							</span>
						</div>
					</li>
				</ul>
			{/if}
		</section>
	{/if}

	<!-- Friends feed ──────────────────────────────────────────── -->
	<!--
		Recent calls from the viewer's friend set, sourced from the cached
		global activity stream. When the friend graph has yet to produce
		any activity we keep the quiet copy block so the surface stays
		discoverable without faking data.
	-->
	{#if !loading && friendActivities.length > 0}
		<section class="friends-section">
			<header class="section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'arena.friends.feed.eyebrow' })}</span>
			</header>
			<ul class="feed-list">
				{#each friendActivities as activity (activityKey(activity))}
					{@const profile = friendProfiles.get(activity.user)}
					{@const isClapped = clappedKeys.has(activityKey(activity))}
					<li>
						<div class="feed-row">
							<button class="feed-main" onclick={() => goToMarket(activity.marketId)} type="button">
								<span class="feed-avatar">
									<Avatar
										class="h-full w-full"
										avatar={profile?.avatar}
										nickname={profile?.nickname}
										owner={profile?.owner ?? activity.user}
									/>
								</span>
								<span class="feed-copy">
									<span class="feed-line">
										<b class="feed-handle"
											>@{profile?.nickname ??
												t({ locale: $localeStore, key: 'arena.friends.unknown_nickname' })}</b
										>
										<span class="feed-action">{activity.title}</span>
										{#if activity.details}
											<span class="feed-market">“{activity.details}”</span>
										{/if}
									</span>
									<span class="num feed-when">{feedRelative(activity.timestamp)}</span>
								</span>
							</button>
							<button
								class="feed-react"
								class:is-clapped={isClapped}
								aria-label={t({ locale: $localeStore, key: 'arena.friends.feed.clap' })}
								aria-pressed={isClapped}
								onclick={() => toggleClap(activity)}
								type="button"
							>
								<Sparkles aria-hidden="true" size={15} strokeWidth={1.8} />
							</button>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{:else if !loading && rankedFriends.length > 0}
		<section class="friends-section">
			<header class="section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'arena.friends.feed.eyebrow' })}</span>
			</header>
			<div class="feed-empty">
				<p class="feed-empty-copy">
					{t({ locale: $localeStore, key: 'arena.friends.feed.empty_a' })}
					<span class="feed-empty-italic">
						{t({ locale: $localeStore, key: 'arena.friends.feed.empty_b' })}
					</span>
				</p>
			</div>
		</section>
	{/if}

	<!-- Global ranking link ─────────────────────────────────── -->
	<button class="global-link" onclick={goToLeaderboard} type="button">
		<span class="global-link-copy">
			<span class="num global-link-eyebrow">
				{t({ locale: $localeStore, key: 'arena.friends.global.eyebrow' })}
			</span>
			<span class="global-link-value num">
				<span class="global-link-rank">
					{myRank !== undefined
						? `#${myRank}`
						: t({ locale: $localeStore, key: 'arena.friends.global.unranked' })}
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
							t({ locale: $localeStore, key: 'arena.friends.unknown_nickname' })}
					</span>
					<span class="num friends-sheet-sub">
						{shortenWithMiddleEllipsis({ text: row.friendId, splitLength: 6 })}
					</span>
				</div>
			</div>

			<div class="friends-sheet-stats">
				<div class="friends-sheet-stat">
					<span class="friends-sheet-lbl">
						{t({ locale: $localeStore, key: 'arena.friends.sheet.accuracy' })}
					</span>
					<span class="friends-sheet-val num">{formatPct(row.accuracy)}</span>
				</div>
				<div class="friends-sheet-stat">
					<span class="friends-sheet-lbl">
						{t({ locale: $localeStore, key: 'arena.friends.sheet.streak' })}
					</span>
					<span class="friends-sheet-val num">{row.streak}d</span>
				</div>
				<div class="friends-sheet-stat">
					<span class="friends-sheet-lbl">
						{t({ locale: $localeStore, key: 'arena.friends.sheet.vxp' })}
					</span>
					<span class="friends-sheet-val num">
						{formatVxpBalance({ value: vxpBaseUnitsFromPoints(row.points) })}
					</span>
				</div>
			</div>

			<div class="friends-sheet-h2h" class:is-ahead={h2h.ahead} class:is-behind={!h2h.ahead}>
				<span class="friends-sheet-lbl">
					{t({ locale: $localeStore, key: 'arena.friends.sheet.h2h' })}
				</span>
				<span class="friends-sheet-val num">
					{h2h.ahead
						? t({
								locale: $localeStore,
								key: 'arena.friends.sheet.h2h_ahead',
								params: { delta: h2h.value.replace('+', '') }
							})
						: t({
								locale: $localeStore,
								key: 'arena.friends.sheet.h2h_behind',
								params: { delta: h2h.value.replace('-', '') }
							})}
				</span>
			</div>

			<BaseButton
				class="friends-sheet-remove"
				onclick={handleRemoveFriend}
				status={removingFriendId === row.friendId ? 'pending' : 'enabled'}
			>
				{t({ locale: $localeStore, key: 'arena.friends.sheet.remove' })}
			</BaseButton>
			<BaseButton class="friends-sheet-close" onclick={closeFriendSheet}>
				{t({ locale: $localeStore, key: 'arena.friends.sheet.close' })}
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
				{t({ locale: $localeStore, key: 'arena.friends.add.sheet_title' })}
			</h3>
			<p class="friends-sheet-blurb">
				{t({ locale: $localeStore, key: 'arena.friends.add.sheet_blurb' })}
			</p>
			<div class="friends-add-input">
				<span class="friends-add-prefix" aria-hidden="true">@</span>
				<input
					class="friends-add-field num"
					aria-label={t({ locale: $localeStore, key: 'arena.friends.add.cta' })}
					autocapitalize="none"
					autocomplete="off"
					autocorrect="off"
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							void handleAddSubmit();
						}
					}}
					placeholder={t({ locale: $localeStore, key: 'arena.friends.add.placeholder' })}
					spellcheck="false"
					type="text"
					bind:value={addInput}
				/>
			</div>
			<p class="friends-add-footnote num">
				{t({
					locale: $localeStore,
					key: 'arena.friends.add.invite_hint',
					params: { amount: bonusLabel }
				})}
			</p>
			<BaseButton
				class="friends-sheet-remove friends-sheet-primary"
				onclick={handleAddSubmit}
				status={adding ? 'pending' : addInput.trim().length === 0 ? 'disabled' : 'enabled'}
			>
				{adding
					? t({ locale: $localeStore, key: 'arena.friends.add.sending' })
					: t({ locale: $localeStore, key: 'arena.friends.add.cta' })}
			</BaseButton>
			<BaseButton class="friends-sheet-close" onclick={closeAddSheet}>
				{t({ locale: $localeStore, key: 'arena.friends.sheet.close' })}
			</BaseButton>
		</div>
	</div>
{/if}

<style lang="postcss">
	/* Horizontal inset is owned by the Arena page wrapper (its only
	   mount point); adding our own would double it and push the tab
	   content in past the tab strip above. Keep only vertical padding. */
	.friends-tab {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 40rem;
		margin: 0 auto;
		padding: 0.85rem 0 5rem;
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
		font-size: var(--t-10);
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
		font-size: var(--t-10);
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
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.75rem 1rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
		border-radius: var(--r-pill);
		background: var(--color-primary);
		color: var(--color-primary-foreground, white);
		font-size: var(--t-13);
		font-weight: 700;
	}

	/* Inline copy-link field — the URL line IS the copy CTA. Tapping it
	   copies the share link and flips the trailing chip to green. Border
	   + background animate toward the accent-green "yes" tone on success. */
	:global(.invite-copyfield) {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.6rem 0.6rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--text-base) 3%, transparent);
		color: var(--text-muted);
		cursor: pointer;
		transition:
			border-color 200ms ease,
			background 200ms ease;
	}

	:global(.invite-copyfield:hover) {
		border-color: var(--border-strong);
	}

	:global(.invite-copyfield) > :global(svg) {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.invite-copyurl {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		color: var(--text-base);
		font-family: var(--font-mono);
		font-size: var(--t-12);
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.invite-copychip {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.75rem;
		border-radius: 0.45rem;
		background: color-mix(in srgb, var(--color-primary) 14%, transparent);
		color: var(--color-primary);
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: var(--tracking-wide);
		transition:
			background 220ms ease,
			color 220ms ease,
			transform 220ms ease;
	}

	:global(.invite-copyfield.is-copied) {
		border-color: color-mix(in srgb, var(--yes) 50%, transparent);
		background: color-mix(in srgb, var(--yes) 6%, transparent);
	}

	:global(.invite-copyfield.is-copied) .invite-copychip {
		background: var(--yes);
		color: var(--yes-deep, #07120d);
		transform: scale(1.04);
	}

	.invite-copy-inner {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
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
		font-size: var(--t-10);
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

	/* Accent-tinted add-friend chip. */
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
		font-size: var(--t-10);
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
	/* Single unified card with internal dividers. Per-row borders
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
		font-size: var(--t-10);
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
	/* Single unified card with internal dividers. The
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
	   with a gold-tinted backdrop blur.
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

	/* Rank index — centered in a fixed-width column so 01/02/… and the
	   YOU label align under one another. */
	.ranked-num {
		min-width: 26px;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-12);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-align: center;
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

	/* Head-to-head accuracy delta chip — centered with a min-width so
	   single- and double-digit deltas line up in a column, and a 1px
	   tinted border on both the ahead and behind variants. */
	.ranked-h2h {
		min-width: 42px;
		padding: 0.2rem 0.5rem;
		border: 1px solid transparent;
		border-radius: var(--r-pill);
		font-size: var(--t-12);
		font-weight: 700;
		text-align: center;
	}

	.ranked-h2h.is-ahead {
		background: var(--yes-wash, color-mix(in srgb, var(--yes) 16%, transparent));
		border-color: color-mix(in srgb, var(--yes) 25%, transparent);
		color: var(--yes);
	}

	.ranked-h2h.is-behind {
		background: color-mix(in srgb, var(--no) 14%, transparent);
		border-color: color-mix(in srgb, var(--no) 22%, transparent);
		color: var(--no);
	}

	.ranked-h2h-you {
		color: var(--color-primary);
		font-size: var(--t-13);
		font-weight: 700;
	}

	/* "See all N →" sits as the last divider-separated row inside
	   the unified ranked card. Accent text, no border (border-top
	   comes from the shared `li + li` divider rule). */
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

	/* ── Feed ──────────────────────────────────────────────── */
	/* Unified card with internal dividers — same pattern as the ranked
	   and pending lists. Each row is the activity line + a clap react. */
	.feed-list {
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

	.feed-list > li + li {
		border-top: 1px solid var(--border-base);
	}

	.feed-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.6rem 0.7rem 0.6rem 0.85rem;
	}

	.feed-main {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.65rem;
		flex: 1;
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	.feed-avatar {
		display: inline-flex;
		overflow: hidden;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: var(--r-pill);
		background: var(--bg-popover);
	}

	.feed-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.15rem;
	}

	.feed-line {
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: var(--leading-snug);
	}

	.feed-handle {
		color: var(--text-base);
		font-weight: 600;
	}

	.feed-action {
		color: var(--text-muted);
	}

	.feed-market {
		color: var(--text-base);
		font-family: var(--font-serif, var(--font-display, serif));
		font-style: italic;
	}

	.feed-when {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-10);
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	/* Clap react — appreciation acknowledgement. Brand forbids emoji, so
	   the applause cue is the `Sparkles` glyph rather than 👏. Resting
	   state is dimmed; tapping commits to full opacity + an accent wash. */
	.feed-react {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		padding: 0.35rem 0.45rem;
		border: 0;
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		opacity: 0.45;
		transition:
			opacity 160ms ease,
			background 160ms ease,
			transform 100ms ease;
	}

	.feed-react:hover {
		opacity: 0.8;
		background: color-mix(in srgb, var(--color-primary) 6%, transparent);
	}

	.feed-react:active {
		transform: scale(0.92);
	}

	.feed-react.is-clapped {
		opacity: 1;
		background: color-mix(in srgb, var(--color-primary) 14%, transparent);
		color: var(--color-primary);
	}

	/* ── Feed (empty) ──────────────────────────────────────── */
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
		font-size: var(--t-10);
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
		font-size: var(--t-10);
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

	/* Open-column stats — label over value, no per-tile box. The block is
	   bracketed by a top + bottom divider rule so the three columns read as
	   one editorial band rather than three cards. */
	.friends-sheet-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		padding: 0.75rem 0;
		border-top: 1px solid var(--border-base);
		border-bottom: 1px solid var(--border-base);
	}

	.friends-sheet-stat {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		text-align: center;
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
		font-family: var(--font-mono);
		font-size: var(--t-16);
		font-weight: 700;
	}

	/* Head-to-head reads as a single open row — label left, delta right —
	   sharing the open-column register of the stats band above (no box). */
	.friends-sheet-h2h {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.85rem 0 0.25rem;
		margin-bottom: 0.6rem;
	}

	.friends-sheet-h2h .friends-sheet-val {
		font-size: var(--t-13);
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
		font-size: var(--t-10);
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}
</style>
