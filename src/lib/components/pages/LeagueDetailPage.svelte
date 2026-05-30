<script lang="ts">
	import { ChevronRight, Copy, Check, Settings } from 'lucide-svelte/icons';
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { functions } from '$declarations/satellite/satellite.api';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import ChallengeLeagueModal from '$lib/components/leagues/ChallengeLeagueModal.svelte';
	import LeagueDetailEmptyState from '$lib/components/leagues/LeagueDetailEmptyState.svelte';
	import MemberSticker from '$lib/components/leagues/MemberSticker.svelte';
	import ResolveBoutModal from '$lib/components/leagues/ResolveBoutModal.svelte';
	import TransferOwnershipModal from '$lib/components/leagues/TransferOwnershipModal.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import {
		acceptBout,
		kickoffBout,
		leaveLeague,
		listLeagueBouts,
		listMyLeagues,
		retractBout,
		type LeagueWithRole
	} from '$lib/services/leagues.services';
	import { loadProfilesByPrincipals } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { profilesStore } from '$lib/stores/profiles.store';
	import type { BoutDoc, BoutState } from '$lib/types/bout';
	import type { LeagueDoc } from '$lib/types/league';
	import type { LeagueMemberDoc, LeagueMemberRole } from '$lib/types/league-member';
	import { formatDate, shortenPrincipal } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';

	/**
	 * League detail page.
	 *
	 * Mounts at `/arena/leagues/[id]`. Renders the head card
	 * (gradient logo + emblem + N° rank + inline Invite/Predict
	 * buttons), the league-bout section (active card or
	 * Challenge-another-league CTA), the members sticker grid, a
	 * leaderboard card, a recent-activity feed, and the
	 * leave / transfer-ownership controls.
	 */
	interface Props {
		leagueId: string;
	}

	const { leagueId }: Props = $props();

	let league: LeagueDoc | undefined = $state();
	let myRole: LeagueMemberRole | undefined = $state();
	let members: LeagueMemberDoc[] = $state([]);
	let bouts: BoutDoc[] = $state([]);
	let selfPrincipal: string | undefined = $state();
	let loadState: 'loading' | 'ready' | 'not_member' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);
	let copied = $state(false);
	let leaving = $state(false);
	let challengeOpen = $state(false);
	let transferOpen = $state(false);
	let leaderboardTab = $state<'week' | 'all'>('week');

	const load = async () => {
		try {
			const [memberships, memberList, boutList, identity] = await Promise.all([
				listMyLeagues(),
				functions.listLeagueMembers({ leagueId }),
				listLeagueBouts({ leagueId }),
				safeGetIdentityOnce()
			]);

			selfPrincipal = identity.getPrincipal().toText();

			const mine: LeagueWithRole | undefined = memberships.find((m) => m.league.id === leagueId);

			if (!mine) {
				loadState = 'not_member';

				return;
			}

			({ league, role: myRole } = mine);
			members = memberList.items.map((m) => ({
				leagueId: m.league_id,
				member: m.member,
				joinedAtMs: m.joined_at_ms,
				role: m.role
			}));
			bouts = boutList;
			// Hydrate handles for the roster + leaderboard rows. The
			// derived `memberHandle` picks up nicknames once the cache
			// lands.
			void loadProfilesByPrincipals({
				principals: memberList.items.map((m) => m.member)
			});
			loadState = 'ready';
		} catch (err) {
			console.error('LeagueDetailPage: load failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
			loadState = 'error';
		}
	};

	onMount(load);

	// Deep-link: `?challenge=1` from CreateBoutModal / other surfaces
	// opens the challenge sheet immediately on load. Kept the legacy
	// `?propose=1` alias too so older links still work.
	$effect(() => {
		if (
			loadState === 'ready' &&
			myRole === 'owner' &&
			(page.url.searchParams.get('challenge') === '1' ||
				page.url.searchParams.get('propose') === '1') &&
			!challengeOpen
		) {
			challengeOpen = true;
		}
	});

	const accent = $derived(league?.accentColor ?? '#7e9b6a');

	// Derive a 1-char emblem from the league name — leagues don't
	// carry a stored emblem, so we lean on the first code-point of
	// the name (Unicode-safe), with a glyph fallback.
	const emblem = $derived.by(() => {
		if (!league) {
			return '◆';
		}

		const [first] = Array.from(league.name.trim());

		return first ? first.toUpperCase() : '◆';
	});

	const canSeeInvite = $derived(myRole === 'owner' || myRole === 'admin');
	const canLeave = $derived(myRole !== 'owner' && myRole !== undefined);
	const canChallenge = $derived(myRole === 'owner');
	const canTransfer = $derived(
		myRole === 'owner' && members.filter((m) => m.role !== 'owner').length > 0
	);

	// 1-indexed roster position of the caller — used for the head
	// card's `N°{NN}` corner badge. Falls back to 1 before the
	// roster lands so the badge isn't blank.
	const yourRank = $derived.by(() => {
		if (selfPrincipal === undefined) {
			return 1;
		}

		const idx = members.findIndex((m) => m.member === selfPrincipal);

		return idx === -1 ? 1 : idx + 1;
	});

	// Member-count line under the head: `{count} members · {size} LEAGUE`.
	// We don't carry a server-side tier field, so the size bucket is
	// derived from the roster headcount (xs / s / m / l).
	const sizeLabelKey: MessageKey = $derived.by(() => {
		const count = members.length;

		if (count <= 3) {
			return 'leagues.detail.size_xs';
		}

		if (count <= 10) {
			return 'leagues.detail.size_s';
		}

		if (count <= 25) {
			return 'leagues.detail.size_m';
		}

		return 'leagues.detail.size_l';
	});

	const memberCountLine = $derived(
		t({
			locale: $localeStore,
			key: members.length === 1 ? 'leagues.detail.head_meta_one' : 'leagues.detail.head_meta_many',
			params: {
				count: members.length,
				size: t({ locale: $localeStore, key: sizeLabelKey })
			}
		})
	);

	const handleTransferred = () => {
		transferOpen = false;
		// The transfer has flipped owner + role rows; reload everything
		// so the user's role drops to 'admin' and the leave / transfer
		// CTAs update accordingly.
		void load();
	};

	const handleBoutProposed = () => {
		challengeOpen = false;
		void load();
	};

	const handleCopyInvite = async () => {
		if (!league) {
			return;
		}

		try {
			await navigator.clipboard.writeText(`vici.markets/league/${league.inviteCode}`);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1600);
		} catch {
			// Clipboard may be unavailable (insecure context). Silent
			// no-op; the user can still read the code in the head card.
		}
	};

	const handleLeave = async () => {
		if (!league || leaving) {
			return;
		}

		leaving = true;

		try {
			await leaveLeague({ leagueId: league.id });
			void goto(`${resolve(AppPath.Arena)}/leagues`);
		} catch (err) {
			console.error('LeagueDetailPage: leaveLeague failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			leaving = false;
		}
	};

	const handlePredict = () => {
		void goto(resolve(AppPath.Flow));
	};

	const handleSettings = () => {
		void goto(resolve(AppPath.Settings));
	};

	const roleLabelKey = (role: LeagueMemberRole): MessageKey =>
		role === 'owner'
			? 'leagues.role.owner'
			: role === 'admin'
				? 'leagues.role.admin'
				: 'leagues.role.member';

	const memberHandle = (principal: string): string => {
		const profile = $profilesStore.get(principal);

		if (profile?.nickname && profile.nickname.length > 0) {
			return `@${profile.nickname}`;
		}

		return shortenPrincipal(principal);
	};

	const memberInitials = (principal: string): string => {
		const profile = $profilesStore.get(principal);

		if (profile?.nickname && profile.nickname.length > 0) {
			return profile.nickname.slice(0, 2).toUpperCase();
		}

		return principal.slice(0, 2).toUpperCase();
	};

	// Sort the roster so the caller sits on top, then owners, admins,
	// members. Within each band we preserve join order (oldest first)
	// — the satellite already sorts join asc so we just leave members
	// alone after the role pass.
	const sortedMembers = $derived.by(() => {
		const roleWeight: Record<LeagueMemberRole, number> = {
			owner: 0,
			admin: 1,
			member: 2
		};

		return [...members].sort((a, b) => {
			if (selfPrincipal !== undefined) {
				if (a.member === selfPrincipal && b.member !== selfPrincipal) {
					return -1;
				}

				if (b.member === selfPrincipal && a.member !== selfPrincipal) {
					return 1;
				}
			}

			const weightDelta = roleWeight[a.role] - roleWeight[b.role];

			if (weightDelta !== 0) {
				return weightDelta;
			}

			return a.joinedAtMs - b.joinedAtMs;
		});
	});

	// Active bout (in_flight first, else accepted / proposed).
	// Resolved bouts are excluded — the active card only shows a live
	// or near-live match-up.
	const activeBout = $derived.by(() => {
		const live = bouts.find((b) => b.state === 'in_flight');

		if (live) {
			return live;
		}

		return bouts.find((b) => b.state === 'accepted' || b.state === 'proposed');
	});

	const activeBoutOpponentId = $derived.by((): string | undefined => {
		if (!activeBout) {
			return;
		}

		return activeBout.sideA === leagueId ? activeBout.sideB : activeBout.sideA;
	});

	const activeBoutStateLabelKey = $derived.by((): MessageKey | undefined => {
		if (!activeBout) {
			return;
		}

		switch (activeBout.state) {
			case 'proposed':
				return 'leagues.bout.state.proposed';
			case 'accepted':
				return 'leagues.bout.state.accepted';
			case 'in_flight':
				return 'leagues.bout.state.in_flight';
			case 'resolved':
				// `activeBout` filter excludes resolved bouts, so this
				// branch is unreachable today; the case exists for
				// exhaustiveness.
				return 'leagues.bout.state.resolved';
		}
	});

	// Friendly opponent label inside the active bout headline. The
	// satellite hands us a raw league id; we trim long slugs so the
	// headline stays on one visual line.
	const shortLeagueId = (id: string): string =>
		id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-5)}` : id;

	// Meta line under the active bout headline:
	//   Proposed         → "Awaiting acceptance from {opponent}".
	//   Accepted /
	//   in-flight        → "Day {day} of {days} · accuracy face-off".
	const activeBoutMetaLine = $derived.by((): string | undefined => {
		if (!activeBout || !activeBoutOpponentId) {
			return;
		}

		if (activeBout.state === 'proposed') {
			return t({
				locale: $localeStore,
				key: 'leagues.detail.bout_meta_awaiting',
				params: { opponent: shortLeagueId(activeBoutOpponentId) }
			});
		}

		const totalDays = Math.max(
			1,
			Math.round((activeBout.settleMs - activeBout.kickoffMs) / DAY_IN_MS)
		);
		const elapsedDays = Math.max(
			1,
			Math.min(totalDays, Math.ceil((Date.now() - activeBout.kickoffMs) / DAY_IN_MS))
		);

		return t({
			locale: $localeStore,
			key: 'leagues.detail.bout_meta_day_of',
			params: { day: elapsedDays, days: totalDays }
		});
	});

	// Per-bout transition affordances. Owner-only.
	let actingBoutId = $state<string | null>(null);
	let resolveBoutTarget = $state<BoutDoc | null>(null);

	const canAcceptBout = (bout: BoutDoc): boolean =>
		myRole === 'owner' && bout.state === 'proposed' && bout.sideB === leagueId;

	const canKickoffBout = (bout: BoutDoc): boolean =>
		myRole === 'owner' &&
		bout.state === 'accepted' &&
		(bout.sideA === leagueId || bout.sideB === leagueId) &&
		Date.now() >= bout.kickoffMs;

	const canResolveBout = (bout: BoutDoc): boolean =>
		myRole === 'owner' &&
		bout.state === 'in_flight' &&
		(bout.sideA === leagueId || bout.sideB === leagueId) &&
		Date.now() >= bout.settleMs;

	const canRetractBout = (bout: BoutDoc): boolean =>
		bout.state === 'proposed' && selfPrincipal !== undefined && bout.proposer === selfPrincipal;

	const handleRetractBout = async (bout: BoutDoc) => {
		if (actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await retractBout({ bout });
			await load();
		} catch (err) {
			console.error('LeagueDetailPage: retractBout failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBoutId = null;
		}
	};

	const handleAcceptBout = async (bout: BoutDoc) => {
		if (actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await acceptBout({ bout });
			await load();
		} catch (err) {
			console.error('LeagueDetailPage: acceptBout failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBoutId = null;
		}
	};

	const handleKickoffBout = async (bout: BoutDoc) => {
		if (actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await kickoffBout({ bout });
			await load();
		} catch (err) {
			console.error('LeagueDetailPage: kickoffBout failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBoutId = null;
		}
	};

	const handleResolveBoutDone = () => {
		resolveBoutTarget = null;
		void load();
	};

	// Recent activity feed. Built from the bout list — newest first by
	// kickoff (in_flight) or settle (resolved). We cap at 6 rows so the
	// card stays tight on a phone.
	interface ActivityRow {
		boutId: string;
		opponentId: string;
		stateKey: MessageKey;
		ts: number;
		verbKey: MessageKey;
		state: BoutState;
	}

	const activity = $derived.by((): ActivityRow[] => {
		const rows: ActivityRow[] = bouts.map((b) => {
			const opponentId = b.sideA === leagueId ? b.sideB : b.sideA;
			const ts = b.state === 'resolved' ? b.settleMs : b.kickoffMs;
			const verbKey: MessageKey =
				b.state === 'resolved'
					? 'leagues.detail.activity_verb_resolved'
					: b.state === 'in_flight'
						? 'leagues.detail.activity_verb_in_flight'
						: b.state === 'accepted'
							? 'leagues.detail.activity_verb_accepted'
							: 'leagues.detail.activity_verb_proposed';
			const stateKey: MessageKey =
				b.state === 'proposed'
					? 'leagues.bout.state.proposed'
					: b.state === 'accepted'
						? 'leagues.bout.state.accepted'
						: b.state === 'in_flight'
							? 'leagues.bout.state.in_flight'
							: 'leagues.bout.state.resolved';

			return {
				boutId: b.id,
				opponentId,
				stateKey,
				ts,
				verbKey,
				state: b.state
			};
		});

		return rows.sort((a, b) => b.ts - a.ts).slice(0, 6);
	});

	// Leaderboard rows. Without per-member accuracy on the satellite,
	// the "This week" and "All time" tabs both render the same roster
	// projection — caller-handles + role chip — top-6, with a sticky
	// YOU row at the bottom. The tab is wired so future per-period
	// stats can drop in without a structural refactor.
	const leaderboardTop = $derived(sortedMembers.slice(0, 6));

	const youMember = $derived.by((): LeagueMemberDoc | undefined => {
		if (selfPrincipal === undefined) {
			return;
		}

		return members.find((m) => m.member === selfPrincipal);
	});
</script>

{#snippet appbarRight()}
	<button
		class="appbar-icon-btn"
		aria-label={t({ locale: $localeStore, key: 'settings.title' })}
		onclick={handleSettings}
		type="button"
	>
		<Settings aria-hidden="true" size={18} strokeWidth={1.8} />
	</button>
{/snippet}

<div class="league-detail">
	<MobileAppBar
		back={{
			label: t({ locale: $localeStore, key: 'leagues.detail.back' }),
			onBack: () => goBack(`${resolve(AppPath.Arena)}/leagues`)
		}}
		right={appbarRight as Snippet}
		title={league?.name ?? t({ locale: $localeStore, key: 'leagues.title' })}
	/>

	{#if loadState === 'loading'}
		<p class="league-detail-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'leagues.detail.loading' })}
		</p>
	{:else if loadState === 'not_member'}
		<LeagueDetailEmptyState />
	{:else if loadState === 'error'}
		<p class="league-detail-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
		</p>
	{:else if league}
		<!-- ─── Head card · gradient logo + emblem + N° + inline CTAs ─── -->
		<header
			style:--accent={accent}
			style:--accent-grad={`linear-gradient(160deg, ${accent}33 0%, ${accent}11 40%, var(--bg-surface) 100%)`}
			class="league-detail-head"
		>
			<div class="league-detail-logo" aria-hidden="true">
				<span class="league-detail-logo-emblem">{emblem}</span>
				<span class="league-detail-logo-corner num">N°{String(yourRank).padStart(2, '0')}</span>
			</div>
			<div class="league-detail-head-body">
				<div class="league-detail-head-name-row">
					<h1>{league.name}</h1>
					{#if myRole}
						<span class="league-detail-role allcaps" data-role={myRole}>
							{t({ locale: $localeStore, key: roleLabelKey(myRole) })}
						</span>
					{/if}
				</div>
				<span class="league-detail-head-meta num">{memberCountLine}</span>
				{#if league.description}
					<p class="league-detail-desc">{league.description}</p>
				{/if}
				<div class="league-detail-head-actions">
					{#if canSeeInvite}
						<button
							class="league-detail-head-btn is-ghost"
							onclick={handleCopyInvite}
							type="button"
						>
							{#if copied}
								<Check aria-hidden="true" size={13} strokeWidth={2.4} />
								<span>
									{t({ locale: $localeStore, key: 'leagues.detail.invite_copied' })}
								</span>
							{:else}
								<Copy aria-hidden="true" size={13} strokeWidth={2} />
								<span>
									{t({ locale: $localeStore, key: 'leagues.detail.invite_label' })}
								</span>
							{/if}
						</button>
					{/if}
					<button class="league-detail-head-btn is-primary" onclick={handlePredict} type="button">
						<span>{t({ locale: $localeStore, key: 'leagues.detail.predict_cta' })}</span>
						<ChevronRight aria-hidden="true" size={13} strokeWidth={2.2} />
					</button>
				</div>
			</div>
		</header>

		<!-- ─── Bout section · active card OR challenge another league ─── -->
		<section class="league-detail-section">
			<div class="league-detail-section-head">
				<span class="eyebrow league-detail-section-title">
					{t({ locale: $localeStore, key: 'leagues.detail.bout_eyebrow' })}
				</span>
				{#if canChallenge && !activeBout}
					<span class="num league-detail-section-side">
						{t({ locale: $localeStore, key: 'leagues.detail.bout_admin_chip' })}
					</span>
				{/if}
			</div>

			{#if activeBout && activeBoutStateLabelKey && activeBoutOpponentId}
				<div class="league-detail-bout-card" data-state={activeBout.state}>
					<div class="league-detail-bout-tags">
						<span class="league-detail-bout-tag allcaps" data-state={activeBout.state}>
							{t({ locale: $localeStore, key: activeBoutStateLabelKey })}
						</span>
					</div>
					<div class="league-detail-bout-headline">
						<span>{league.name}</span>
						<span class="serif-italic league-detail-bout-vs">vs</span>
						<span class="num">{shortLeagueId(activeBoutOpponentId)}</span>
					</div>
					{#if activeBoutMetaLine}
						<p class="league-detail-bout-meta num">{activeBoutMetaLine}</p>
					{/if}

					{#if canAcceptBout(activeBout)}
						<button
							class="league-detail-bout-action is-primary"
							disabled={actingBoutId === activeBout.id}
							onclick={() => handleAcceptBout(activeBout)}
							type="button"
						>
							{actingBoutId === activeBout.id
								? t({ locale: $localeStore, key: 'leagues.bout.action.accepting' })
								: t({ locale: $localeStore, key: 'leagues.bout.action.accept' })}
						</button>
					{:else if canKickoffBout(activeBout)}
						<button
							class="league-detail-bout-action is-primary"
							disabled={actingBoutId === activeBout.id}
							onclick={() => handleKickoffBout(activeBout)}
							type="button"
						>
							{actingBoutId === activeBout.id
								? t({ locale: $localeStore, key: 'leagues.bout.action.starting' })
								: t({ locale: $localeStore, key: 'leagues.bout.action.kickoff' })}
						</button>
					{:else if canResolveBout(activeBout)}
						<button
							class="league-detail-bout-action is-primary"
							onclick={() => (resolveBoutTarget = activeBout ?? null)}
							type="button"
						>
							{t({ locale: $localeStore, key: 'leagues.bout.action.resolve' })}
						</button>
					{/if}
					{#if canRetractBout(activeBout)}
						<button
							class="league-detail-bout-action is-danger"
							disabled={actingBoutId === activeBout.id}
							onclick={() => handleRetractBout(activeBout)}
							type="button"
						>
							{actingBoutId === activeBout.id
								? t({ locale: $localeStore, key: 'leagues.bout.action.retracting' })
								: t({ locale: $localeStore, key: 'leagues.bout.action.retract' })}
						</button>
					{/if}
				</div>
			{:else}
				<div class="league-detail-bout-empty">
					<p class="serif-italic league-detail-bout-empty-lede">
						{t({ locale: $localeStore, key: 'leagues.detail.bout_empty_lede' })}
					</p>
					<p class="league-detail-bout-empty-sub">
						{t({ locale: $localeStore, key: 'leagues.detail.bout_empty_sub' })}
					</p>
					{#if canChallenge}
						<button
							class="league-detail-bout-empty-cta"
							onclick={() => (challengeOpen = true)}
							type="button"
						>
							<span>{t({ locale: $localeStore, key: 'leagues.detail.bout_challenge_cta' })}</span>
							<ChevronRight aria-hidden="true" size={13} strokeWidth={2.2} />
						</button>
					{/if}
				</div>
			{/if}
		</section>

		<!-- ─── Members sticker grid ─── -->
		<section class="league-detail-section">
			<div class="league-detail-section-head">
				<span class="eyebrow league-detail-section-title">
					{t({ locale: $localeStore, key: 'leagues.detail.members_section' })}
				</span>
				<span class="num league-detail-section-side">
					{t({
						locale: $localeStore,
						key: 'leagues.detail.members_count_unlimited',
						params: { count: members.length }
					})}
				</span>
			</div>
			<div class="league-detail-members-grid">
				{#each sortedMembers as member, idx (member.member)}
					<MemberSticker
						accentColor={accent}
						isSelf={member.member === selfPrincipal}
						principal={member.member}
						rank={idx + 1}
						role={member.role}
					/>
				{/each}
			</div>
		</section>

		<!-- ─── Leaderboard · This week / All time ─── -->
		<section class="league-detail-section">
			<div class="league-detail-section-head">
				<span class="eyebrow league-detail-section-title">
					{t({ locale: $localeStore, key: 'leagues.detail.leaderboard_eyebrow' })}
				</span>
			</div>
			<div class="league-detail-leaderboard">
				<div class="league-detail-lb-tabs" role="tablist">
					<button
						class="league-detail-lb-tab allcaps"
						class:is-active={leaderboardTab === 'week'}
						aria-selected={leaderboardTab === 'week'}
						onclick={() => (leaderboardTab = 'week')}
						role="tab"
						type="button"
					>
						{t({ locale: $localeStore, key: 'leagues.detail.lb_tab_week' })}
					</button>
					<button
						class="league-detail-lb-tab allcaps"
						class:is-active={leaderboardTab === 'all'}
						aria-selected={leaderboardTab === 'all'}
						onclick={() => (leaderboardTab = 'all')}
						role="tab"
						type="button"
					>
						{t({ locale: $localeStore, key: 'leagues.detail.lb_tab_all' })}
					</button>
				</div>

				<ul class="league-detail-lb-rows">
					{#each leaderboardTop as member, idx (member.member)}
						{@const isYou = member.member === selfPrincipal}
						<li class="league-detail-lb-row" class:is-you={isYou}>
							<span
								class="league-detail-lb-rank num"
								data-rank={idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}
							>
								{String(idx + 1).padStart(2, '0')}
							</span>
							<span class="league-detail-lb-avatar" aria-hidden="true">
								{memberInitials(member.member)}
							</span>
							<span class="league-detail-lb-name">{memberHandle(member.member)}</span>
							<span class="league-detail-lb-role allcaps" data-role={member.role}>
								{t({ locale: $localeStore, key: roleLabelKey(member.role) })}
							</span>
						</li>
					{/each}
				</ul>

				<!-- Sticky YOU row — renders the caller's stats
				     regardless of whether they already appear in the
				     top-6 above. -->
				{#if youMember}
					<div class="league-detail-lb-you-row">
						<span class="league-detail-lb-rank num">
							{String(yourRank).padStart(2, '0')}
						</span>
						<span class="league-detail-lb-avatar" aria-hidden="true">
							{memberInitials(youMember.member)}
						</span>
						<span class="league-detail-lb-name">
							{t({ locale: $localeStore, key: 'leagues.detail.you_chip' })}
						</span>
						<span class="league-detail-lb-role allcaps" data-role={youMember.role}>
							{t({ locale: $localeStore, key: roleLabelKey(youMember.role) })}
						</span>
					</div>
				{/if}
			</div>
		</section>

		<!-- ─── Recent activity feed ─── -->
		<section class="league-detail-section">
			<div class="league-detail-section-head">
				<span class="eyebrow league-detail-section-title">
					{t({ locale: $localeStore, key: 'leagues.detail.activity_eyebrow' })}
				</span>
			</div>
			{#if activity.length === 0}
				<p class="league-detail-activity-empty">
					{t({ locale: $localeStore, key: 'leagues.detail.activity_empty' })}
				</p>
			{:else}
				<ul class="league-detail-activity">
					{#each activity as row (row.boutId)}
						<li class="league-detail-activity-row">
							<div class="league-detail-activity-body">
								<span class="league-detail-activity-who">
									{t({
										locale: $localeStore,
										key: row.verbKey,
										params: { opponent: row.opponentId }
									})}
								</span>
								<span class="league-detail-activity-when num">{formatDate(row.ts)}</span>
							</div>
							<span class="league-detail-activity-state allcaps" data-state={row.state}>
								{t({ locale: $localeStore, key: row.stateKey })}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- ─── Day-2 controls — kept for production · transfer + leave ─── -->
		<div class="league-detail-controls">
			{#if canTransfer}
				<button class="league-detail-transfer" onclick={() => (transferOpen = true)} type="button">
					{t({ locale: $localeStore, key: 'leagues.transfer.cta' })}
				</button>
			{/if}
			{#if canLeave}
				<button class="league-detail-leave" disabled={leaving} onclick={handleLeave} type="button">
					{t({
						locale: $localeStore,
						key: leaving ? 'leagues.detail.leaving' : 'leagues.detail.leave'
					})}
				</button>
			{/if}
		</div>
	{/if}
</div>

{#if league !== undefined && canChallenge}
	<ChallengeLeagueModal
		fromLeague={league}
		isOpen={challengeOpen}
		onClose={() => (challengeOpen = false)}
		onProposed={handleBoutProposed}
	/>
{/if}

{#if league !== undefined && myRole === 'owner'}
	<TransferOwnershipModal
		currentOwnerPrincipal={league.owner}
		isOpen={transferOpen}
		leagueId={league.id}
		{members}
		onClose={() => (transferOpen = false)}
		onTransferred={handleTransferred}
	/>
{/if}

<ResolveBoutModal
	bout={resolveBoutTarget}
	isOpen={resolveBoutTarget !== null}
	onClose={() => (resolveBoutTarget = null)}
	onResolved={handleResolveBoutDone}
	ourLeagueId={leagueId}
/>

<style lang="postcss">
	.league-detail {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 0 1.25rem 6rem;
	}

	.league-detail-status,
	.league-detail-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.league-detail-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.league-detail-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	/* ─── Head card ─────────────────────────────────────────────── */

	.league-detail-head {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 0.9rem;
		padding: 0.95rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-logo {
		position: relative;
		width: 5.5rem;
		height: 5.5rem;
		background: var(--accent-grad);
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		border-radius: var(--r-12);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		flex-shrink: 0;
		box-shadow:
			0 14px 30px -16px rgba(0, 0, 0, 0.55),
			inset 0 1px 0 color-mix(in srgb, var(--text-base) 10%, transparent);
	}

	.league-detail-logo::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			120deg,
			transparent 35%,
			color-mix(in srgb, var(--text-base) 12%, transparent) 50%,
			transparent 65%
		);
		pointer-events: none;
	}

	.league-detail-logo-emblem {
		position: relative;
		z-index: 2;
		font-family: var(--font-display);
		font-style: italic;
		font-size: 2.1rem;
		font-weight: 600;
		color: var(--accent);
		line-height: 1;
	}

	.league-detail-logo-corner {
		position: absolute;
		bottom: 0.3rem;
		right: 0.35rem;
		z-index: 2;
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--accent);
		opacity: 0.78;
	}

	.league-detail-head-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		flex: 1;
	}

	.league-detail-head-name-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.league-detail-head h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-20, 1.25rem);
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.league-detail-role {
		flex-shrink: 0;
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.15rem 0.45rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--accent);
	}

	.league-detail-role[data-role='owner'] {
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.league-detail-head-meta {
		font-size: var(--t-11);
		letter-spacing: var(--tracking-wide);
		color: var(--text-muted);
	}

	.league-detail-desc {
		margin: 0.1rem 0 0;
		font-size: var(--t-12);
		color: var(--text-muted);
		line-height: 1.4;
	}

	.league-detail-head-actions {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.45rem;
	}

	.league-detail-head-btn {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.4rem 0.7rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease,
			color 140ms ease;
	}

	.league-detail-head-btn.is-ghost {
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		border: 1px solid var(--border-base);
	}

	.league-detail-head-btn.is-ghost:hover {
		border-color: var(--border-strong);
	}

	.league-detail-head-btn.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.league-detail-head-btn.is-primary:hover {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	/* ─── Generic section ───────────────────────────────────────── */

	.league-detail-section {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.league-detail-section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.league-detail-section-title {
		margin: 0;
		color: var(--text-muted);
	}

	.league-detail-section-side {
		font-size: var(--t-10);
		font-weight: 600;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	/* ─── Bout section ──────────────────────────────────────────── */

	.league-detail-bout-card {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.85rem 0.95rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-bout-card[data-state='in_flight'] {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.league-detail-bout-tags {
		display: flex;
		gap: 0.3rem;
	}

	.league-detail-bout-tag {
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-pill);
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 16%, transparent);
	}

	.league-detail-bout-tag[data-state='in_flight'] {
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
	}

	.league-detail-bout-headline {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--text-base);
	}

	.league-detail-bout-vs {
		font-size: var(--t-13);
		color: var(--accent);
	}

	.league-detail-bout-meta {
		font-size: var(--t-11);
		color: var(--text-muted);
	}

	.league-detail-bout-action {
		appearance: none;
		align-self: flex-start;
		margin-top: 0.25rem;
		padding: 0.4rem 0.85rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.league-detail-bout-action.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.league-detail-bout-action.is-danger {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.league-detail-bout-action:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.league-detail-bout-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 1rem 0.95rem;
		text-align: center;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-bout-empty-lede {
		margin: 0;
		font-size: var(--t-14);
		color: var(--accent);
	}

	.league-detail-bout-empty-sub {
		margin: 0;
		font-size: var(--t-12);
		line-height: 1.4;
		color: var(--text-muted);
	}

	.league-detail-bout-empty-cta {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.2rem;
		padding: 0.5rem 0.95rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.league-detail-bout-empty-cta:hover {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	/* ─── Members grid ──────────────────────────────────────────── */

	.league-detail-members-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.6rem;
	}

	/* ─── Leaderboard ───────────────────────────────────────────── */

	.league-detail-leaderboard {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.85rem 0.95rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-lb-tabs {
		display: flex;
		gap: 0.2rem;
		padding: 0.18rem;
		background: color-mix(in srgb, var(--text-base) 4%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
	}

	.league-detail-lb-tab {
		appearance: none;
		flex: 1;
		padding: 0.4rem 0.5rem;
		font: inherit;
		font-size: var(--t-10);
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		background: transparent;
		border: 0;
		border-radius: var(--r-8);
		cursor: pointer;
		transition:
			background 180ms ease,
			color 180ms ease;
	}

	.league-detail-lb-tab.is-active {
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
	}

	.league-detail-lb-rows {
		display: flex;
		flex-direction: column;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.league-detail-lb-row {
		display: grid;
		grid-template-columns: 1.6rem 1.4rem 1fr auto;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-base);
	}

	.league-detail-lb-row:last-of-type {
		border-bottom: 0;
	}

	.league-detail-lb-row.is-you {
		background: color-mix(in srgb, var(--accent) 6%, transparent);
		border-radius: var(--r-8);
		padding-left: 0.3rem;
		padding-right: 0.3rem;
	}

	.league-detail-lb-rank {
		text-align: center;
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--text-muted);
	}

	.league-detail-lb-rank[data-rank='gold'] {
		color: var(--laurel);
	}

	.league-detail-lb-rank[data-rank='silver'] {
		color: #c0c5cb;
	}

	.league-detail-lb-rank[data-rank='bronze'] {
		color: #b57c52;
	}

	.league-detail-lb-avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		font-size: 0.55rem;
		font-weight: 700;
		color: var(--text-base);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--accent) 50%, transparent),
			color-mix(in srgb, var(--accent) 14%, transparent)
		);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
	}

	.league-detail-lb-name {
		font-size: var(--t-12);
		font-weight: 500;
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.league-detail-lb-role {
		font-size: 0.55rem;
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.league-detail-lb-role[data-role='owner'] {
		color: var(--laurel);
	}

	.league-detail-lb-you-row {
		display: grid;
		grid-template-columns: 1.6rem 1.4rem 1fr auto;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.6rem;
		margin-top: 0.4rem;
		background: color-mix(in srgb, var(--accent) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border-base));
		border-radius: var(--r-8);
	}

	/* ─── Activity feed ─────────────────────────────────────────── */

	.league-detail-activity {
		display: flex;
		flex-direction: column;
		list-style: none;
		padding: 0.6rem 0.95rem;
		margin: 0;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-activity-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.7rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--border-base);
	}

	.league-detail-activity-row:last-of-type {
		border-bottom: 0;
	}

	.league-detail-activity-body {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.league-detail-activity-who {
		font-size: var(--t-12);
		color: var(--text-base);
		line-height: 1.35;
	}

	.league-detail-activity-when {
		font-size: var(--t-10);
		color: var(--text-muted);
	}

	.league-detail-activity-state {
		flex-shrink: 0;
		font-size: 0.55rem;
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-pill);
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 14%, transparent);
	}

	.league-detail-activity-state[data-state='in_flight'] {
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 18%, transparent);
	}

	.league-detail-activity-state[data-state='resolved'] {
		opacity: 0.65;
	}

	.league-detail-activity-empty {
		margin: 0;
		padding: 0.75rem 1rem;
		font-size: var(--t-13);
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
	}

	/* ─── Controls ─────────────────────────────────────────────── */

	.league-detail-controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.league-detail-leave {
		appearance: none;
		padding: 0.65rem 1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
		border-radius: var(--r-12);
		cursor: pointer;
	}

	.league-detail-leave:hover:not(:disabled) {
		background: color-mix(in srgb, var(--no-wash, var(--no)) 20%, transparent);
	}

	.league-detail-leave:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.league-detail-transfer {
		appearance: none;
		padding: 0.65rem 1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--border-base));
		border-radius: var(--r-12);
		cursor: pointer;
	}

	.league-detail-transfer:hover {
		background: color-mix(in srgb, var(--color-primary) 14%, transparent);
	}
</style>
