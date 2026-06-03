<script lang="ts">
	import {
		ChevronLeft,
		ChevronRight,
		Copy,
		Check,
		Pencil,
		ImagePlus,
		Trash2
	} from '@lucide/svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ScreenHeader from '$lib/components/layout/ScreenHeader.svelte';
	import ChallengeLeagueModal from '$lib/components/leagues/ChallengeLeagueModal.svelte';
	import LeagueDetailEmptyState from '$lib/components/leagues/LeagueDetailEmptyState.svelte';
	import ResolveBattleModal from '$lib/components/leagues/ResolveBattleModal.svelte';
	import TransferOwnershipModal from '$lib/components/leagues/TransferOwnershipModal.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import {
		acceptBattle,
		kickoffBattle,
		leaveLeague,
		retractBattle,
		updateLeague,
		validateLeagueDraft
	} from '$lib/services/leagues.services';
	import { findOwnStanding, getLeagueStandings } from '$lib/services/standings.services';
	import { deleteLeagueImageByUrl, uploadLeagueImage } from '$lib/services/storage.services';
	import {
		leagueBattlesStore,
		leagueMembersStore,
		leaguesErrorStore,
		leaguesLoadedStore,
		myLeaguesStore,
		refreshMyLeagues
	} from '$lib/stores/leagues.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { profilesStore } from '$lib/stores/profiles.store';
	import type { BattleDoc, BattleState } from '$lib/types/battle';
	import { leagueEmblem, LEAGUE_NAME_MAX_LENGTH, LEAGUE_NAME_MIN_LENGTH } from '$lib/types/league';
	import type { LeagueMemberDoc, LeagueMemberRole } from '$lib/types/league-member';
	import type { StandingsWindow } from '$lib/types/standings';
	import { formatDate, formatLocalePercent, shortenPrincipal } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';

	/**
	 * League detail page.
	 *
	 * Mounts at `/arena/leagues/[id]`. Renders the head card
	 * (gradient logo + emblem + N° rank + inline Invite/Predict
	 * buttons), the league-battle section (active card or
	 * Challenge-another-league CTA), a tappable member leaderboard
	 * (each row opens a member bottom-sheet with avatar + accuracy /
	 * streak stats), a recent-activity feed, and the leave /
	 * transfer-ownership controls. Small leagues (under four members)
	 * swap the podium for a "just getting started" recruit prompt.
	 */
	interface Props {
		leagueId: string;
	}

	const { leagueId }: Props = $props();

	let errorMessage: string | null = $state(null);
	let copied = $state(false);
	let leaving = $state(false);
	let challengeOpen = $state(false);
	let transferOpen = $state(false);
	let leaderboardTab = $state<'week' | 'all'>('week');
	// Member tapped in the leaderboard — drives the member detail
	// bottom-sheet (avatar + accuracy / streak). `null` keeps it closed.
	let openMember = $state<LeagueMemberDoc | null>(null);

	const selfPrincipal = $derived($authPrincipal);

	// Everything below reads from the shared leagues cache. The store
	// hydrates the caller's memberships + every league's roster and
	// battles in one fan-out refresh, so tapping in from the (already
	// warm) list paints instantly while a background refresh runs.
	const mine = $derived($myLeaguesStore.find((m) => m.league.id === leagueId));
	const league = $derived(mine?.league);
	const myRole = $derived<LeagueMemberRole | undefined>(mine?.role);
	const members = $derived($leagueMembersStore.get(leagueId) ?? []);
	const battles = $derived($leagueBattlesStore.get(leagueId) ?? []);

	const loadState = $derived.by<'loading' | 'ready' | 'not_member' | 'error'>(() => {
		if (!$leaguesLoadedStore) {
			return $leaguesErrorStore ? 'error' : 'loading';
		}

		return mine ? 'ready' : 'not_member';
	});

	// Stale-while-revalidate: render the cache and refresh in the
	// background on every mount.
	onMount(() => {
		void refreshMyLeagues();
	});

	// Deep-link: `?challenge=1` from other surfaces opens the challenge
	// sheet immediately on load. Kept the legacy `?propose=1` alias too
	// so older links still work.
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

	// The emblem rendered inside the gradient tile — the owner's stored
	// pick, with a name-derived 1-char fallback for legacy rows written
	// before the picker shipped.
	const emblem = $derived(league ? leagueEmblem(league) : '◆');

	const canSeeInvite = $derived(myRole === 'owner' || myRole === 'admin');
	const canLeave = $derived(myRole !== 'owner' && myRole !== undefined);
	const canChallenge = $derived(myRole === 'owner');
	const canTransfer = $derived(
		myRole === 'owner' && members.filter((m) => m.role !== 'owner').length > 0
	);

	// Owner-only inline rename. The pencil affordance next to the hero
	// title opens a text input seeded with the current name; Enter saves,
	// Esc cancels, plus explicit Save / Cancel controls. Non-owners never
	// see the affordance, so the title stays read-only for them.
	const canRename = $derived(myRole === 'owner');

	// Owner-only cover image. The logo tile renders the uploaded image
	// (cover-fit) when set, else the emblem glyph. Owners get Add/Change
	// + Remove affordances over the tile; non-owners see it read-only.
	const canEditImage = $derived(myRole === 'owner');
	const hasImage = $derived(league?.imageUrl !== undefined && league.imageUrl.length > 0);
	let imageInput = $state<HTMLInputElement | null>(null);
	let imageBusy = $state(false);

	const pickImage = () => {
		if (!canEditImage || imageBusy) {
			return;
		}

		imageInput?.click();
	};

	const handleImagePicked = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];

		// Reset the input so re-picking the same file fires `change` again.
		input.value = '';

		if (!file || !league || imageBusy) {
			return;
		}

		imageBusy = true;

		let uploadedUrl: string | undefined;

		try {
			const previousUrl = league.imageUrl;
			const imageUrl = await uploadLeagueImage({ leagueId: league.id, file });
			uploadedUrl = imageUrl;
			await updateLeague({ id: league.id, imageUrl });

			// The doc now points at the fresh asset, so don't roll it back below.
			uploadedUrl = undefined;

			// Drop the superseded asset once the doc points at the new one.
			if (previousUrl !== undefined && previousUrl !== imageUrl) {
				await deleteLeagueImageByUrl(previousUrl);
			}

			await refreshMyLeagues();
		} catch (err) {
			console.error('LeagueDetailPage: league image upload failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });

			// The asset uploaded but the doc write failed: best-effort cleanup so
			// the orphaned image doesn't linger in Storage. Swallow cleanup errors.
			if (uploadedUrl !== undefined) {
				await deleteLeagueImageByUrl(uploadedUrl);
			}
		} finally {
			imageBusy = false;
		}
	};

	const handleRemoveImage = async () => {
		if (!canEditImage || !league || imageBusy || !hasImage) {
			return;
		}

		imageBusy = true;

		try {
			const previousUrl = league.imageUrl;
			await updateLeague({ id: league.id, imageUrl: null });

			if (previousUrl !== undefined) {
				await deleteLeagueImageByUrl(previousUrl);
			}

			await refreshMyLeagues();
		} catch (err) {
			console.error('LeagueDetailPage: league image remove failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			imageBusy = false;
		}
	};

	let renaming = $state(false);
	let renameDraft = $state('');
	let renameSaving = $state(false);

	const renameError = $derived.by((): MessageKey | undefined => {
		if (!renaming) {
			return;
		}

		const trimmed = renameDraft.trim();

		if (trimmed.length === 0) {
			return 'leagues.detail.rename_error_empty';
		}

		const validation = validateLeagueDraft({ name: trimmed });

		if (validation.ok) {
			return;
		}

		// `description_too_long` can't occur — we validate name only — so
		// the reason is always one of the two length-window failures.
		return validation.reason === 'name_too_short'
			? 'leagues.detail.rename_error_too_short'
			: 'leagues.detail.rename_error_too_long';
	});

	const openRename = () => {
		if (!canRename || !league) {
			return;
		}

		renameDraft = league.name;
		renaming = true;
	};

	const cancelRename = () => {
		renaming = false;
		renameDraft = '';
	};

	const handleRename = async () => {
		if (!league || renameSaving || renameError !== undefined) {
			return;
		}

		const trimmed = renameDraft.trim();

		if (trimmed === league.name) {
			cancelRename();

			return;
		}

		renameSaving = true;

		try {
			await updateLeague({ id: league.id, name: trimmed });
			await refreshMyLeagues();
			renaming = false;
			renameDraft = '';
		} catch (err) {
			console.error('LeagueDetailPage: updateLeague failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			renameSaving = false;
		}
	};

	const handleRenameKeydown = (event: KeyboardEvent) => {
		// Ignore Enter while an IME composition is active (CJK input commits
		// the composition with Enter) so we don't save/cancel mid-composition.
		if (event.isComposing || event.keyCode === 229) {
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			void handleRename();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelRename();
		}
	};

	// The caller's standing within the league, ranked by net realized P&L over
	// the active window (clearing canister `list_leaderboard`, filtered to this
	// league's roster). `undefined` until it loads or when the caller has no
	// settled position in the window.
	let standingRank = $state<number | undefined>(undefined);

	$effect(() => {
		const owner = selfPrincipal;
		const window: StandingsWindow = leaderboardTab === 'week' ? 'week' : 'all';
		const roster = members.map((m) => m.member);

		if (owner === undefined || roster.length === 0) {
			standingRank = undefined;

			return;
		}

		getLeagueStandings({ window, members: roster })
			.then((result) => {
				standingRank = findOwnStanding({ result, owner })?.rank;
			})
			.catch((err: unknown) => {
				console.error(err);
				standingRank = undefined;
			});
	});

	// 1-indexed position of the caller for the head card's `N°{NN}` corner
	// badge. Prefers the clearing standings rank; falls back to the roster
	// order (the leaderboard render order) while standings load or when the
	// caller has no settled position yet, so the badge is never blank.
	const yourRank = $derived.by(() => {
		if (standingRank !== undefined) {
			return standingRank;
		}

		if (selfPrincipal === undefined) {
			return 1;
		}

		const idx = sortedMembers.findIndex((m) => m.member === selfPrincipal);

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

	// Editorial-hero eyebrow chips — exactly three: the kind ("League"),
	// the member count, and the public/private flag. The privacy chip
	// reads the league's `private` field (absent → public). The caller's
	// role is surfaced in the battle section ("Admin · you"), not here.
	const heroChips = $derived([
		t({ locale: $localeStore, key: 'leagues.detail.hero_chip_kind' }),
		t({
			locale: $localeStore,
			key:
				members.length === 1 ? 'leagues.card.member_count_one' : 'leagues.card.member_count_many',
			params: { count: members.length }
		}),
		t({
			locale: $localeStore,
			key: league?.private ? 'leagues.detail.hero_chip_private' : 'leagues.detail.hero_chip_public'
		})
	]);

	const handleTransferred = () => {
		transferOpen = false;
		// The transfer has flipped owner + role rows; reload everything
		// so the user's role drops to 'admin' and the leave / transfer
		// CTAs update accordingly.
		void refreshMyLeagues();
	};

	const handleBattleProposed = () => {
		challengeOpen = false;
		void refreshMyLeagues();
	};

	const handleCopyInvite = async () => {
		if (!league) {
			return;
		}

		try {
			const url = `${window.location.origin}/league/${league.inviteCode}`;
			const shareText = t({
				locale: $localeStore,
				key: 'leagues.share_text',
				params: { name: league.name }
			});
			await navigator.clipboard.writeText(`${shareText} ${url}`);
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

	const memberHandle = (principal: string): string => {
		const profile = $profilesStore.get(principal);

		if (profile?.nickname && profile.nickname.length > 0) {
			return `@${profile.nickname}`;
		}

		return shortenPrincipal(principal);
	};

	// Avatar props for a roster principal, drawn from the shared
	// profile cache. Falls back to nulls before the cache lands —
	// `<Avatar>` resolves a deterministic placeholder from `owner`.
	const memberAvatar = (principal: string): string | null =>
		$profilesStore.get(principal)?.avatar ?? null;

	const memberNickname = (principal: string): string | null =>
		$profilesStore.get(principal)?.nickname ?? null;

	// Per-member stats for the leaderboard row + member sheet. The
	// shared profile cache carries `accuracy` (0–100) and `streak`;
	// both default to 0 until the profile hydrates.
	const memberAccuracy = (principal: string): number =>
		$profilesStore.get(principal)?.accuracy ?? 0;

	const memberStreak = (principal: string): number => $profilesStore.get(principal)?.streak ?? 0;

	const formatAccuracy = (principal: string): string =>
		formatLocalePercent({ value: memberAccuracy(principal) / 100, locale: $localeStore });

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

	// Active battle (in_flight first, else accepted / proposed).
	// Resolved battles are excluded — the active card only shows a live
	// or near-live match-up.
	const activeBattle = $derived.by(() => {
		const live = battles.find((b) => b.state === 'in_flight');

		if (live) {
			return live;
		}

		return battles.find((b) => b.state === 'accepted' || b.state === 'proposed');
	});

	const activeBattleOpponentId = $derived.by((): string | undefined => {
		if (!activeBattle) {
			return;
		}

		return activeBattle.sideA === leagueId ? activeBattle.sideB : activeBattle.sideA;
	});

	const activeBattleStateLabelKey = $derived.by((): MessageKey | undefined => {
		if (!activeBattle) {
			return;
		}

		switch (activeBattle.state) {
			case 'proposed':
				return 'leagues.battle.state.proposed';
			case 'accepted':
				return 'leagues.battle.state.accepted';
			case 'in_flight':
				return 'leagues.battle.state.in_flight';
			case 'resolved':
				// `activeBattle` filter excludes resolved battles, so this
				// branch is unreachable today; the case exists for
				// exhaustiveness.
				return 'leagues.battle.state.resolved';
		}
	});

	// Friendly opponent label inside the active battle headline. The
	// satellite hands us a raw league id; we trim long slugs so the
	// headline stays on one visual line.
	const shortLeagueId = (id: string): string =>
		id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-5)}` : id;

	// Meta line under the active battle headline:
	//   Proposed         → "Awaiting acceptance from {opponent}".
	//   Accepted /
	//   in-flight        → "Day {day} of {days} · accuracy face-off".
	const activeBattleMetaLine = $derived.by((): string | undefined => {
		if (!activeBattle || !activeBattleOpponentId) {
			return;
		}

		if (activeBattle.state === 'proposed') {
			return t({
				locale: $localeStore,
				key: 'leagues.detail.battle_meta_awaiting',
				params: { opponent: shortLeagueId(activeBattleOpponentId) }
			});
		}

		const totalDays = Math.max(
			1,
			Math.round((activeBattle.settleMs - activeBattle.kickoffMs) / DAY_IN_MS)
		);
		const elapsedDays = Math.max(
			1,
			Math.min(totalDays, Math.ceil((Date.now() - activeBattle.kickoffMs) / DAY_IN_MS))
		);

		return t({
			locale: $localeStore,
			key: 'leagues.detail.battle_meta_day_of',
			params: { day: elapsedDays, days: totalDays }
		});
	});

	// Per-battle transition affordances. Owner-only.
	let actingBattleId = $state<string | null>(null);
	let resolveBattleTarget = $state<BattleDoc | null>(null);

	const canAcceptBattle = (battle: BattleDoc): boolean =>
		myRole === 'owner' && battle.state === 'proposed' && battle.sideB === leagueId;

	const canKickoffBattle = (battle: BattleDoc): boolean =>
		myRole === 'owner' &&
		battle.state === 'accepted' &&
		(battle.sideA === leagueId || battle.sideB === leagueId) &&
		Date.now() >= battle.kickoffMs;

	const canResolveBattle = (battle: BattleDoc): boolean =>
		myRole === 'owner' &&
		battle.state === 'in_flight' &&
		(battle.sideA === leagueId || battle.sideB === leagueId) &&
		Date.now() >= battle.settleMs;

	const canRetractBattle = (battle: BattleDoc): boolean =>
		battle.state === 'proposed' && selfPrincipal !== undefined && battle.proposer === selfPrincipal;

	const handleRetractBattle = async (battle: BattleDoc) => {
		if (actingBattleId !== null) {
			return;
		}

		actingBattleId = battle.id;

		try {
			await retractBattle({ battle });
			await refreshMyLeagues();
		} catch (err) {
			console.error('LeagueDetailPage: retractBattle failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBattleId = null;
		}
	};

	const handleAcceptBattle = async (battle: BattleDoc) => {
		if (actingBattleId !== null) {
			return;
		}

		actingBattleId = battle.id;

		try {
			await acceptBattle({ battle });
			await refreshMyLeagues();
		} catch (err) {
			console.error('LeagueDetailPage: acceptBattle failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBattleId = null;
		}
	};

	const handleKickoffBattle = async (battle: BattleDoc) => {
		if (actingBattleId !== null) {
			return;
		}

		actingBattleId = battle.id;

		try {
			await kickoffBattle({ battle });
			await refreshMyLeagues();
		} catch (err) {
			console.error('LeagueDetailPage: kickoffBattle failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBattleId = null;
		}
	};

	const handleResolveBattleDone = () => {
		resolveBattleTarget = null;
		void refreshMyLeagues();
	};

	// Recent activity feed. Built from the battle list — newest first by
	// kickoff (in_flight) or settle (resolved). We cap at 6 rows so the
	// card stays tight on a phone.
	interface ActivityRow {
		battleId: string;
		opponentId: string;
		stateKey: MessageKey;
		ts: number;
		verbKey: MessageKey;
		state: BattleState;
	}

	const activity = $derived.by((): ActivityRow[] => {
		const rows: ActivityRow[] = battles.map((b) => {
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
					? 'leagues.battle.state.proposed'
					: b.state === 'accepted'
						? 'leagues.battle.state.accepted'
						: b.state === 'in_flight'
							? 'leagues.battle.state.in_flight'
							: 'leagues.battle.state.resolved';

			return {
				battleId: b.id,
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

	// Small-league recruit state — under four members there isn't
	// enough of a field for a podium, so we surface a "just getting
	// started" prompt with an invite CTA beneath the leaderboard.
	const isRecruiting = $derived(members.length < 4);

	// 1-indexed roster rank of the tapped member — feeds the member
	// sheet's `Rank #NN · {league}` subhead.
	const openMemberRank = $derived.by((): number => {
		if (!openMember) {
			return 1;
		}

		const idx = sortedMembers.findIndex((m) => m.member === openMember?.member);

		return idx === -1 ? 1 : idx + 1;
	});
</script>

<div class="league-detail">
	{#if loadState === 'loading'}
		<ScreenHeader
			back={{
				label: t({ locale: $localeStore, key: 'leagues.detail.back' }),
				onBack: () => goBack(`${resolve(AppPath.Arena)}/leagues`)
			}}
		/>
		<p class="league-detail-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'leagues.detail.loading' })}
		</p>
	{:else if loadState === 'not_member'}
		<ScreenHeader
			back={{
				label: t({ locale: $localeStore, key: 'leagues.detail.back' }),
				onBack: () => goBack(`${resolve(AppPath.Arena)}/leagues`)
			}}
		/>
		<LeagueDetailEmptyState />
	{:else if loadState === 'error'}
		<ScreenHeader
			back={{
				label: t({ locale: $localeStore, key: 'leagues.detail.back' }),
				onBack: () => goBack(`${resolve(AppPath.Arena)}/leagues`)
			}}
		/>
		<p class="league-detail-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
		</p>
	{:else if league}
		<!-- ─── Editorial hero · back chevron + serif title on one row,
		     then compact context chips + optional description. Mirrors the
		     source design's title-bar (inline back + 24px serif-italic
		     title) rather than stacking the title under a standalone bar. -->
		<header class="league-detail-hero">
			{#if renaming}
				<div class="league-detail-hero-bar">
					<button
						class="league-detail-hero-back"
						aria-label={t({ locale: $localeStore, key: 'leagues.detail.back' })}
						onclick={() => goBack(`${resolve(AppPath.Arena)}/leagues`)}
						type="button"
					>
						<ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
					</button>
					<div class="league-detail-rename">
						<div class="league-detail-rename-row">
							<!-- svelte-ignore a11y_autofocus -->
							<input
								class="league-detail-rename-input"
								aria-invalid={renameError !== undefined}
								aria-label={t({ locale: $localeStore, key: 'leagues.detail.rename_label' })}
								autofocus
								disabled={renameSaving}
								maxlength={LEAGUE_NAME_MAX_LENGTH}
								minlength={LEAGUE_NAME_MIN_LENGTH}
								onkeydown={handleRenameKeydown}
								type="text"
								bind:value={renameDraft}
							/>
							<button
								class="league-detail-rename-btn is-primary"
								disabled={renameSaving || renameError !== undefined}
								onclick={handleRename}
								type="button"
							>
								{t({
									locale: $localeStore,
									key: renameSaving ? 'leagues.detail.rename_saving' : 'leagues.detail.rename_save'
								})}
							</button>
							<button
								class="league-detail-rename-btn is-ghost"
								disabled={renameSaving}
								onclick={cancelRename}
								type="button"
							>
								{t({ locale: $localeStore, key: 'leagues.detail.rename_cancel' })}
							</button>
						</div>
						{#if renameError}
							<p class="league-detail-rename-error" role="alert">
								{t({ locale: $localeStore, key: renameError })}
							</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="league-detail-hero-bar">
					<button
						class="league-detail-hero-back"
						aria-label={t({ locale: $localeStore, key: 'leagues.detail.back' })}
						onclick={() => goBack(`${resolve(AppPath.Arena)}/leagues`)}
						type="button"
					>
						<ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
					</button>
					<h1 class="league-detail-hero-title">{league.name}</h1>
					{#if canRename}
						<button
							class="league-detail-hero-edit"
							aria-label={t({ locale: $localeStore, key: 'leagues.detail.rename_label' })}
							onclick={openRename}
							type="button"
						>
							<Pencil aria-hidden="true" size={14} strokeWidth={2} />
						</button>
					{/if}
				</div>
			{/if}
			<div class="league-detail-hero-chips">
				{#each heroChips as chip (chip)}
					<span class="league-detail-hero-chip num">{chip}</span>
				{/each}
			</div>
			{#if league.description}
				<p class="league-detail-hero-desc serif-italic">{league.description}</p>
			{/if}
		</header>

		<!-- ─── Identity card · emblem tile + member overlap + actions ─── -->
		<section
			style:--accent={accent}
			style:--accent-grad={`linear-gradient(160deg, ${accent}33 0%, ${accent}11 40%, var(--bg-surface) 100%)`}
			class="league-detail-identity"
		>
			<div class="league-detail-identity-row">
				<div class="league-detail-logo-wrap">
					<div class="league-detail-logo" class:has-image={hasImage} aria-hidden="true">
						{#if hasImage && league.imageUrl}
							<img class="league-detail-logo-image" alt="" src={league.imageUrl} />
						{:else}
							<span class="league-detail-logo-emblem">{emblem}</span>
						{/if}
						<span class="league-detail-logo-corner num">N°{String(yourRank).padStart(2, '0')}</span>
					</div>
					{#if canEditImage}
						<div class="league-detail-logo-actions">
							<input
								bind:this={imageInput}
								class="league-detail-logo-file"
								accept="image/*"
								onchange={handleImagePicked}
								type="file"
							/>
							<button
								class="league-detail-logo-action"
								aria-label={t({
									locale: $localeStore,
									key: hasImage
										? 'leagues.detail.image_change_label'
										: 'leagues.detail.image_add_label'
								})}
								disabled={imageBusy}
								onclick={pickImage}
								type="button"
							>
								<ImagePlus aria-hidden="true" size={13} strokeWidth={2} />
								<span>
									{t({
										locale: $localeStore,
										key: hasImage ? 'leagues.detail.image_change' : 'leagues.detail.image_add'
									})}
								</span>
							</button>
							{#if hasImage}
								<button
									class="league-detail-logo-action is-remove"
									aria-label={t({ locale: $localeStore, key: 'leagues.detail.image_remove_label' })}
									disabled={imageBusy}
									onclick={handleRemoveImage}
									type="button"
								>
									<Trash2 aria-hidden="true" size={13} strokeWidth={2} />
									<span>{t({ locale: $localeStore, key: 'leagues.detail.image_remove' })}</span>
								</button>
							{/if}
						</div>
					{/if}
				</div>
				<div class="league-detail-identity-body">
					<span class="num allcaps league-detail-identity-eyebrow">{memberCountLine}</span>
					<button
						class="league-detail-identity-overlap"
						aria-label={t({
							locale: $localeStore,
							key: 'leagues.detail.members_count_unlimited',
							params: { count: members.length }
						})}
						onclick={() => (leaderboardTab = 'all')}
						type="button"
					>
						<span class="league-detail-overlap-avatars" aria-hidden="true">
							{#each sortedMembers.slice(0, 4) as member, i (member.member)}
								<span style:--i={i} class="league-detail-overlap-avatar">
									<Avatar
										class="league-detail-overlap-img"
										avatar={memberAvatar(member.member)}
										nickname={memberNickname(member.member)}
										owner={member.member}
									/>
								</span>
							{/each}
						</span>
						<span class="num allcaps league-detail-overlap-count">
							{t({
								locale: $localeStore,
								key:
									members.length === 1
										? 'leagues.card.member_count_one'
										: 'leagues.card.member_count_many',
								params: { count: members.length }
							})}
						</span>
					</button>
				</div>
			</div>
			<div class="league-detail-identity-actions">
				{#if canSeeInvite}
					<button class="league-detail-head-btn is-ghost" onclick={handleCopyInvite} type="button">
						{#if copied}
							<Check aria-hidden="true" size={13} strokeWidth={2.4} />
							<span>{t({ locale: $localeStore, key: 'leagues.detail.invite_copied' })}</span>
						{:else}
							<Copy aria-hidden="true" size={13} strokeWidth={2} />
							<span>{t({ locale: $localeStore, key: 'leagues.detail.invite_label' })}</span>
						{/if}
					</button>
				{/if}
				<button class="league-detail-head-btn is-primary" onclick={handlePredict} type="button">
					<span>{t({ locale: $localeStore, key: 'leagues.detail.predict_cta' })}</span>
					<ChevronRight aria-hidden="true" size={13} strokeWidth={2.2} />
				</button>
			</div>
		</section>

		<!-- ─── Battle section · active card OR challenge another league ─── -->
		<section class="league-detail-section">
			<div class="league-detail-section-head">
				<span class="eyebrow league-detail-section-title">
					{t({ locale: $localeStore, key: 'leagues.detail.battle_eyebrow' })}
				</span>
				{#if canChallenge && !activeBattle}
					<span class="num league-detail-section-side">
						{t({ locale: $localeStore, key: 'leagues.detail.battle_admin_chip' })}
					</span>
				{/if}
			</div>

			{#if activeBattle && activeBattleStateLabelKey && activeBattleOpponentId}
				<div class="league-detail-battle-card" data-state={activeBattle.state}>
					<div class="league-detail-battle-tags">
						<span class="league-detail-battle-tag allcaps" data-state={activeBattle.state}>
							{t({ locale: $localeStore, key: activeBattleStateLabelKey })}
						</span>
					</div>
					<div class="league-detail-battle-headline">
						<span>{league.name}</span>
						<span class="serif-italic league-detail-battle-vs">vs</span>
						<span class="num">{shortLeagueId(activeBattleOpponentId)}</span>
					</div>
					{#if activeBattleMetaLine}
						<p class="league-detail-battle-meta num">{activeBattleMetaLine}</p>
					{/if}

					{#if canAcceptBattle(activeBattle)}
						<button
							class="league-detail-battle-action is-primary"
							disabled={actingBattleId === activeBattle.id}
							onclick={() => handleAcceptBattle(activeBattle)}
							type="button"
						>
							{actingBattleId === activeBattle.id
								? t({ locale: $localeStore, key: 'leagues.battle.action.accepting' })
								: t({ locale: $localeStore, key: 'leagues.battle.action.accept' })}
						</button>
					{:else if canKickoffBattle(activeBattle)}
						<button
							class="league-detail-battle-action is-primary"
							disabled={actingBattleId === activeBattle.id}
							onclick={() => handleKickoffBattle(activeBattle)}
							type="button"
						>
							{actingBattleId === activeBattle.id
								? t({ locale: $localeStore, key: 'leagues.battle.action.starting' })
								: t({ locale: $localeStore, key: 'leagues.battle.action.kickoff' })}
						</button>
					{:else if canResolveBattle(activeBattle)}
						<button
							class="league-detail-battle-action is-primary"
							onclick={() => (resolveBattleTarget = activeBattle ?? null)}
							type="button"
						>
							{t({ locale: $localeStore, key: 'leagues.battle.action.resolve' })}
						</button>
					{/if}
					{#if canRetractBattle(activeBattle)}
						<button
							class="league-detail-battle-action is-danger"
							disabled={actingBattleId === activeBattle.id}
							onclick={() => handleRetractBattle(activeBattle)}
							type="button"
						>
							{actingBattleId === activeBattle.id
								? t({ locale: $localeStore, key: 'leagues.battle.action.retracting' })
								: t({ locale: $localeStore, key: 'leagues.battle.action.retract' })}
						</button>
					{/if}
				</div>
			{:else}
				<div class="league-detail-battle-empty">
					<p class="serif-italic league-detail-battle-empty-lede">
						{t({ locale: $localeStore, key: 'leagues.detail.battle_empty_lede' })}
					</p>
					<p class="league-detail-battle-empty-sub">
						{t({ locale: $localeStore, key: 'leagues.detail.battle_empty_sub' })}
					</p>
					{#if canChallenge}
						<button
							class="league-detail-battle-empty-cta"
							onclick={() => (challengeOpen = true)}
							type="button"
						>
							<span>{t({ locale: $localeStore, key: 'leagues.detail.battle_challenge_cta' })}</span>
							<ChevronRight aria-hidden="true" size={13} strokeWidth={2.2} />
						</button>
					{/if}
				</div>
			{/if}
		</section>

		<!-- ─── Leaderboard · This week / All time ─── -->
		<!-- Members now live here as tappable rows (avatar + handle +
		     streak + accuracy); the row opens a member detail sheet.
		     The Panini sticker grid is retired in favour of this single
		     roster + the member sheet. -->
		<section class="league-detail-section">
			<div class="league-detail-section-head">
				<span class="eyebrow league-detail-section-title">
					{t({ locale: $localeStore, key: 'leagues.detail.leaderboard_eyebrow' })}
				</span>
				<span class="num league-detail-section-side">
					{t({
						locale: $localeStore,
						key: 'leagues.detail.members_count_unlimited',
						params: { count: members.length }
					})}
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
						<li>
							<button
								class="league-detail-lb-row"
								class:is-you={isYou}
								aria-label={memberHandle(member.member)}
								onclick={() => (openMember = member)}
								type="button"
							>
								<span
									class="league-detail-lb-rank num"
									data-rank={idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}
								>
									{String(idx + 1).padStart(2, '0')}
								</span>
								<Avatar
									class="league-detail-lb-avatar"
									avatar={memberAvatar(member.member)}
									nickname={memberNickname(member.member)}
									owner={member.member}
								/>
								<span class="league-detail-lb-name">{memberHandle(member.member)}</span>
								<span class="league-detail-lb-streak num allcaps">
									{t({
										locale: $localeStore,
										key: 'leagues.detail.lb_streak',
										params: { count: memberStreak(member.member) }
									})}
								</span>
								<span class="league-detail-lb-acc num">{formatAccuracy(member.member)}</span>
							</button>
						</li>
					{/each}
				</ul>

				<!-- Sticky YOU row — renders the caller's stats
				     regardless of whether they already appear in the
				     top-6 above. -->
				{#if youMember}
					<button
						class="league-detail-lb-row league-detail-lb-you-row"
						aria-label={t({ locale: $localeStore, key: 'leagues.detail.you_chip' })}
						onclick={() => (openMember = youMember ?? null)}
						type="button"
					>
						<span class="league-detail-lb-rank num is-you">
							{String(yourRank).padStart(2, '0')}
						</span>
						<Avatar
							class="league-detail-lb-avatar"
							avatar={memberAvatar(youMember.member)}
							nickname={memberNickname(youMember.member)}
							owner={youMember.member}
						/>
						<span class="league-detail-lb-name">
							{t({ locale: $localeStore, key: 'leagues.detail.you_chip' })}
						</span>
						<span class="league-detail-lb-streak num allcaps">
							{t({
								locale: $localeStore,
								key: 'leagues.detail.lb_streak',
								params: { count: memberStreak(youMember.member) }
							})}
						</span>
						<span class="league-detail-lb-acc num">{formatAccuracy(youMember.member)}</span>
					</button>
				{/if}
			</div>

			<!-- Small-league recruit prompt — no podium theatre for a
			     near-empty league; nudge the user to invite instead. -->
			{#if isRecruiting}
				<div class="league-detail-recruit">
					<span class="league-detail-recruit-title">
						{t({ locale: $localeStore, key: 'leagues.detail.recruit_title' })}
					</span>
					<p class="league-detail-recruit-sub">
						{t({ locale: $localeStore, key: 'leagues.detail.recruit_sub' })}
					</p>
					{#if canSeeInvite}
						<button class="league-detail-recruit-cta" onclick={handleCopyInvite} type="button">
							{#if copied}
								<Check aria-hidden="true" size={13} strokeWidth={2.4} />
								<span>{t({ locale: $localeStore, key: 'leagues.detail.invite_copied' })}</span>
							{:else}
								<Copy aria-hidden="true" size={13} strokeWidth={2} />
								<span>{t({ locale: $localeStore, key: 'leagues.detail.invite_label' })}</span>
							{/if}
						</button>
					{/if}
				</div>
			{/if}
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
					{#each activity as row (row.battleId)}
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
		onProposed={handleBattleProposed}
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

<ResolveBattleModal
	battle={resolveBattleTarget}
	isOpen={resolveBattleTarget !== null}
	onClose={() => (resolveBattleTarget = null)}
	onResolved={handleResolveBattleDone}
	ourLeagueId={leagueId}
/>

<!-- ─── Member detail sheet · avatar + accuracy / streak stats ─── -->
<BottomSheet isOpen={openMember !== null} onClose={() => (openMember = null)}>
	{#if openMember}
		<div class="league-detail-member-sheet">
			<div class="league-detail-member-sheet-head">
				<Avatar
					class="league-detail-member-sheet-avatar"
					avatar={memberAvatar(openMember.member)}
					nickname={memberNickname(openMember.member)}
					owner={openMember.member}
				/>
				<div class="league-detail-member-sheet-id">
					<span class="league-detail-member-sheet-name">{memberHandle(openMember.member)}</span>
					<span class="num league-detail-member-sheet-rank">
						{t({
							locale: $localeStore,
							key: 'leagues.detail.member_sheet_rank',
							params: {
								rank: String(openMemberRank).padStart(2, '0'),
								league: league?.name ?? ''
							}
						})}
					</span>
				</div>
			</div>
			<div class="league-detail-member-sheet-stats">
				<div class="league-detail-member-stat">
					<span class="eyebrow league-detail-member-stat-label">
						{t({ locale: $localeStore, key: 'leagues.detail.member_stat_accuracy' })}
					</span>
					<span class="num league-detail-member-stat-value"
						>{formatAccuracy(openMember.member)}</span
					>
				</div>
				<div class="league-detail-member-stat">
					<span class="eyebrow league-detail-member-stat-label">
						{t({ locale: $localeStore, key: 'leagues.detail.member_stat_streak' })}
					</span>
					<span class="num league-detail-member-stat-value">{memberStreak(openMember.member)}</span>
				</div>
			</div>
		</div>
	{/if}
</BottomSheet>

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

	/* ─── Editorial hero ────────────────────────────────────────── */

	.league-detail-hero {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.25rem 0 0.1rem;
	}

	/* Title-bar row — inline back chevron + serif title (+ owner rename
	   pencil), vertically centred, mirroring the source design's title
	   bar. 50px min-height + 12px gap keep the chevron and title aligned
	   on a single row. */
	.league-detail-hero-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 50px;
	}

	/* Inline back circle — flush to the content edge via the negative
	   margin, so it reads as part of the title row rather than an inset
	   action. */
	.league-detail-hero-back {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 36px;
		height: 36px;
		margin-left: -8px;
		padding: 0;
		color: var(--text-muted);
		background: transparent;
		border: 0;
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			color 140ms var(--ease-vici),
			background 140ms var(--ease-vici);
	}

	.league-detail-hero-back:hover {
		color: var(--text-base);
		background: color-mix(in srgb, var(--text-base) 6%, transparent);
	}

	.league-detail-hero-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	/* Context chips — mono, Title-case, rounded outline. The chip copy
	   carries its own casing (League / 8 members / Public), so no
	   uppercasing transform; the row reads as content, not a status pill. */
	.league-detail-hero-chip {
		font-family: var(--font-mono);
		font-size: var(--t-11);
		letter-spacing: 0.02em;
		padding: 0.25rem 0.625rem;
		border-radius: var(--r-pill);
		color: var(--text-muted);
		border: 1px solid var(--border-base);
	}

	/* League title — serif-italic editorial treatment (the entity name
	   reads as a masthead, not a UI label). Sized to the source design's
	   inline title-bar (24px), filling the row so any trailing pencil
	   sits at the edge; ellipsizes only when truly out of room. */
	.league-detail-hero-title {
		margin: 0;
		flex: 1 1 auto;
		min-width: 0;
		font-family: var(--font-serif, var(--font-display, serif));
		font-style: italic;
		font-size: var(--t-24, 1.5rem);
		font-weight: 400;
		letter-spacing: -0.01em;
		color: var(--text-base);
		line-height: 1.1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.league-detail-hero-desc {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
		line-height: 1.45;
	}

	/* ─── Inline rename (owner only) ────────────────────────────── */

	.league-detail-hero-edit {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: 0.25rem;
		color: var(--text-muted);
		background: none;
		border: 0;
		border-radius: var(--r-8);
		cursor: pointer;
		transition:
			color 140ms ease,
			background 140ms ease;
	}

	.league-detail-hero-edit:hover {
		color: var(--text-base);
		background: color-mix(in srgb, var(--text-base) 6%, transparent);
	}

	.league-detail-rename {
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
		flex-direction: column;
		gap: 0.4rem;
	}

	.league-detail-rename-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.league-detail-rename-input {
		flex: 1;
		min-width: 0;
		padding: 0.45rem 0.7rem;
		font: inherit;
		font-family: var(--font-display);
		font-size: var(--t-16);
		font-weight: 600;
		color: var(--text-base);
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
	}

	.league-detail-rename-input:focus-visible {
		outline: none;
		border-color: var(--border-strong);
	}

	.league-detail-rename-input[aria-invalid='true'] {
		border-color: color-mix(in srgb, var(--no) 45%, var(--border-base));
	}

	.league-detail-rename-input:disabled {
		opacity: 0.6;
	}

	.league-detail-rename-btn {
		appearance: none;
		flex-shrink: 0;
		padding: 0.45rem 0.85rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.league-detail-rename-btn.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.league-detail-rename-btn.is-ghost {
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		border: 1px solid var(--border-base);
	}

	.league-detail-rename-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.league-detail-rename-error {
		margin: 0;
		font-size: var(--t-11);
		color: var(--no);
	}

	/* ─── Identity card ─────────────────────────────────────────── */

	.league-detail-identity {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.95rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-identity-row {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 0.9rem;
		align-items: center;
	}

	.league-detail-identity-body {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		min-width: 0;
	}

	.league-detail-identity-eyebrow {
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.league-detail-identity-overlap {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0;
		font: inherit;
		background: none;
		border: 0;
		cursor: pointer;
	}

	.league-detail-overlap-avatars {
		display: inline-flex;
		align-items: center;
	}

	.league-detail-overlap-avatar {
		display: inline-flex;
		margin-left: -7px;
		border-radius: 50%;
		box-shadow: 0 0 0 2px var(--bg-surface);
	}

	.league-detail-overlap-avatar:first-child {
		margin-left: 0;
	}

	:global(.league-detail-overlap-img) {
		width: 1.5rem;
		height: 1.5rem;
	}

	.league-detail-overlap-count {
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.league-detail-identity-actions {
		display: flex;
		gap: 0.5rem;
	}

	.league-detail-identity-actions .league-detail-head-btn {
		flex: 1;
		justify-content: center;
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

	/* Owner-uploaded cover fills the tile (cover-fit, centred). Sits at
	   z-index 1 so the rank corner badge stays legible above it. */
	.league-detail-logo-image {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.league-detail-logo.has-image .league-detail-logo-corner {
		color: var(--text-on-accent, #fff);
		opacity: 0.92;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
	}

	.league-detail-logo-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.league-detail-logo-actions {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.league-detail-logo-file {
		display: none;
	}

	.league-detail-logo-action {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.25rem 0.4rem;
		font: inherit;
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			color 140ms ease,
			border-color 140ms ease,
			background 140ms ease;
	}

	.league-detail-logo-action:hover:not(:disabled) {
		color: var(--text-base);
		border-color: var(--border-strong);
	}

	.league-detail-logo-action.is-remove {
		color: var(--no);
		border-color: color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.league-detail-logo-action:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	/* ─── Battle section ──────────────────────────────────────────── */

	.league-detail-battle-card {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.85rem 0.95rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-battle-card[data-state='in_flight'] {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.league-detail-battle-tags {
		display: flex;
		gap: 0.3rem;
	}

	.league-detail-battle-tag {
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-pill);
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 16%, transparent);
	}

	.league-detail-battle-tag[data-state='in_flight'] {
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
	}

	.league-detail-battle-headline {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--text-base);
	}

	.league-detail-battle-vs {
		font-size: var(--t-13);
		color: var(--accent);
	}

	.league-detail-battle-meta {
		font-size: var(--t-11);
		color: var(--text-muted);
	}

	.league-detail-battle-action {
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

	.league-detail-battle-action.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.league-detail-battle-action.is-danger {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.league-detail-battle-action:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.league-detail-battle-empty {
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

	.league-detail-battle-empty-lede {
		margin: 0;
		font-size: var(--t-14);
		color: var(--accent);
	}

	.league-detail-battle-empty-sub {
		margin: 0;
		font-size: var(--t-12);
		line-height: 1.4;
		color: var(--text-muted);
	}

	.league-detail-battle-empty-cta {
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

	.league-detail-battle-empty-cta:hover {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
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
		appearance: none;
		display: grid;
		grid-template-columns: 1.6rem 1.75rem minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		min-height: 44px;
		padding: 0.5rem 0.3rem;
		font: inherit;
		color: inherit;
		text-align: left;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--border-base);
		border-radius: var(--r-8);
		cursor: pointer;
		transition: background 140ms ease;
	}

	.league-detail-lb-rows li:last-child .league-detail-lb-row {
		border-bottom: 0;
	}

	.league-detail-lb-row:hover {
		background: color-mix(in srgb, var(--text-base) 4%, transparent);
	}

	.league-detail-lb-row.is-you {
		background: color-mix(in srgb, var(--accent) 6%, transparent);
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

	.league-detail-lb-rank.is-you {
		color: var(--accent);
	}

	:global(.league-detail-lb-avatar) {
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
	}

	.league-detail-lb-name {
		font-size: var(--t-12);
		font-weight: 500;
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.league-detail-lb-streak {
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
		white-space: nowrap;
	}

	.league-detail-lb-acc {
		font-size: var(--t-13);
		font-weight: 700;
		color: var(--accent);
		text-align: right;
	}

	.league-detail-lb-you-row {
		margin-top: 0.4rem;
		padding-left: 0.6rem;
		padding-right: 0.6rem;
		border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border-base));
	}

	/* ─── Small-league recruit prompt ───────────────────────────── */

	.league-detail-recruit {
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

	.league-detail-recruit-title {
		font-family: var(--font-display);
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--text-base);
	}

	.league-detail-recruit-sub {
		margin: 0;
		font-size: var(--t-12);
		line-height: 1.4;
		color: var(--text-muted);
	}

	.league-detail-recruit-cta {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.2rem;
		padding: 0.5rem 0.95rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
		transition: border-color 140ms ease;
	}

	.league-detail-recruit-cta:hover {
		border-color: var(--border-strong);
	}

	/* ─── Member detail sheet ───────────────────────────────────── */

	.league-detail-member-sheet {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.25rem 0 0.5rem;
	}

	.league-detail-member-sheet-head {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-width: 0;
	}

	:global(.league-detail-member-sheet-avatar) {
		width: 3.25rem;
		height: 3.25rem;
		flex-shrink: 0;
	}

	.league-detail-member-sheet-id {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.league-detail-member-sheet-name {
		font-family: var(--font-display);
		font-size: var(--t-16);
		font-weight: 700;
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.league-detail-member-sheet-rank {
		font-size: var(--t-11);
		letter-spacing: var(--tracking-wide);
		color: var(--text-muted);
	}

	.league-detail-member-sheet-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.league-detail-member-stat {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.7rem 0.85rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-member-stat-label {
		color: var(--text-muted);
	}

	.league-detail-member-stat-value {
		font-size: var(--t-20);
		font-weight: 700;
		color: var(--text-base);
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
