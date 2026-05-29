<script lang="ts">
	import { Check, Eye, Flame, Lock, Pencil, Target, Trophy, X } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import StreakFlame from '$lib/components/characters/StreakFlame.svelte';
	import AffiliationPickerModal from '$lib/components/leagues/AffiliationPickerModal.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import ProfileOracleInsight from '$lib/components/profile/ProfileOracleInsight.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { ARCHETYPE_MAP } from '$lib/constants/archetypes.constants';
	import { MIN_NICKNAME_LENGTH } from '$lib/constants/profile.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { lookupWorldsAffiliation } from '$lib/constants/worlds-affiliations.constants';
	import { leaderboard } from '$lib/derived/leaderboard.derived';
	import { checkNicknameAvailability, upsertProfile } from '$lib/services/profile.services';
	import { loadMyUserStats } from '$lib/services/user-stats.services';
	import { listMyAffiliations } from '$lib/services/worlds.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { marketsStore } from '$lib/stores/markets.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import type { AffiliationDoc, AffiliationKind } from '$lib/types/affiliation';
	import type { Market } from '$lib/types/market';
	import type { UserProfile } from '$lib/types/profile';
	import type { UserStatsDoc } from '$lib/types/user-stats';
	import { evaluateAchievements } from '$lib/utils/achievements.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		profile: UserProfile;
		viewerPrincipal?: string;
	}

	const { profile, viewerPrincipal }: Props = $props();

	const isOwnProfile = $derived(viewerPrincipal === profile.owner);

	/* Editable identity ----------------------------------------------- */

	let editProfileOpen = $state(false);
	let editedNickname = $state('');
	let pending = $state(false);
	type NicknameEditStatus = 'available' | 'taken' | 'too_short' | 'required' | 'check_failed';
	let nicknameStatus = $state<NicknameEditStatus | undefined>(undefined);
	let nicknameChecking = $state(false);
	let nicknameCheckToken = 0;
	let nicknameCheckTimer: ReturnType<typeof setTimeout> | undefined;
	const nicknameCheckDebounce_ms = 350;

	const scheduleNicknameAvailabilityCheck = (value: string) => {
		if (nicknameCheckTimer) {
			clearTimeout(nicknameCheckTimer);
		}

		nicknameCheckToken += 1;
		const token = nicknameCheckToken;

		const trimmed = value.trim();

		if (trimmed.length === 0) {
			nicknameStatus = 'required';
			nicknameChecking = false;

			return;
		}

		if (trimmed.length < MIN_NICKNAME_LENGTH) {
			nicknameStatus = 'too_short';
			nicknameChecking = false;

			return;
		}

		if (trimmed.toLowerCase() === profile.nickname.trim().toLowerCase()) {
			nicknameStatus = 'available';
			nicknameChecking = false;

			return;
		}

		nicknameChecking = true;
		nicknameStatus = undefined;

		nicknameCheckTimer = setTimeout(() => {
			void (async () => {
				try {
					const result = await checkNicknameAvailability({
						nickname: trimmed,
						principal: profile.owner
					});

					if (token !== nicknameCheckToken) {
						return;
					}

					nicknameChecking = false;
					nicknameStatus = result.available ? 'available' : result.reason;
				} catch (_err: unknown) {
					if (token !== nicknameCheckToken) {
						return;
					}

					nicknameChecking = false;
					nicknameStatus = 'check_failed';
				}
			})();
		}, nicknameCheckDebounce_ms);
	};

	const openEditProfile = () => {
		editedNickname = profile.nickname;
		nicknameStatus = 'available';
		nicknameChecking = false;
		editProfileOpen = true;
	};

	const closeEditProfile = () => {
		if (nicknameCheckTimer) {
			clearTimeout(nicknameCheckTimer);
		}

		editProfileOpen = false;
		nicknameStatus = undefined;
		nicknameChecking = false;
	};

	const onNicknameInput = (event: Event) => {
		if (event.currentTarget instanceof HTMLInputElement) {
			editedNickname = event.currentTarget.value;
			scheduleNicknameAvailabilityCheck(editedNickname);
		}
	};

	const handleSaveProfile = async () => {
		const trimmed = editedNickname.trim();

		if (trimmed.length < MIN_NICKNAME_LENGTH) {
			return;
		}

		const nicknameChanged = trimmed.toLowerCase() !== profile.nickname.trim().toLowerCase();

		if (nicknameChanged) {
			pending = true;

			try {
				const probe = await checkNicknameAvailability({
					nickname: trimmed,
					principal: profile.owner
				});

				if (!probe.available) {
					nicknameStatus = probe.reason;

					if (probe.reason === 'taken') {
						notificationsStore.add({
							title: t({ locale: $localeStore, key: 'profile.dashboard.nickname_taken_title' }),
							message: t({
								locale: $localeStore,
								key: 'profile.dashboard.nickname_taken',
								params: { nickname: trimmed }
							}),
							type: 'error'
						});
					}

					return;
				}
			} catch (_err: unknown) {
				nicknameStatus = 'check_failed';
			} finally {
				pending = false;
			}
		}

		pending = true;

		try {
			if (nicknameChanged) {
				const updatedData = {
					...profile,
					nickname: trimmed
				};

				await upsertProfile({ key: profile.owner, data: updatedData });
				userStore.update((curr) => ({ ...curr, profile: updatedData }));
			}

			editProfileOpen = false;
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : '';

			if (message.includes('already taken')) {
				nicknameStatus = 'taken';
				notificationsStore.add({
					title: t({ locale: $localeStore, key: 'profile.dashboard.nickname_taken_title' }),
					message: t({
						locale: $localeStore,
						key: 'profile.dashboard.nickname_taken',
						params: { nickname: trimmed }
					}),
					type: 'error'
				});
			} else {
				notificationsStore.add({
					title: t({ locale: $localeStore, key: 'profile.dashboard.nickname_save_failed_title' }),
					message: t({ locale: $localeStore, key: 'profile.dashboard.nickname_save_failed' }),
					type: 'error'
				});
			}
		} finally {
			pending = false;
		}
	};

	const saveStatus = $derived.by<'pending' | 'disabled' | 'enabled'>(() => {
		if (pending || nicknameChecking) {
			return 'pending';
		}

		const trimmed = editedNickname.trim();

		if (trimmed.length < MIN_NICKNAME_LENGTH) {
			return 'disabled';
		}

		if (nicknameStatus === 'taken' || nicknameStatus === 'check_failed') {
			return 'disabled';
		}

		return 'enabled';
	});

	const nicknameHintKey = $derived.by(() => {
		const trimmed = editedNickname.trim();

		if (trimmed.length === 0) {
			return 'profile.dashboard.nickname_required' as const;
		}

		if (trimmed.length < MIN_NICKNAME_LENGTH) {
			return 'profile.dashboard.nickname_min' as const;
		}

		if (nicknameChecking) {
			return 'profile.dashboard.nickname_checking' as const;
		}

		if (nicknameStatus === 'taken') {
			return 'profile.dashboard.nickname_taken' as const;
		}

		if (nicknameStatus === 'check_failed') {
			return 'profile.dashboard.nickname_check_failed' as const;
		}

		return null;
	});

	/* Identity stats -------------------------------------------------- */

	const accuracy = $derived(profile.accuracy ?? 0);
	const dailyStreak = $derived(profile.dailyStreak ?? 0);
	const level = $derived(profile.level ?? 1);
	const points = $derived(profile.points ?? 0);
	const xpInLevel = $derived(points % 500);
	const nextLevelTarget = $derived(level * 500);
	const xpProgressPercent = $derived((xpInLevel / 500) * 100);
	const totalTrades = $derived(profile.totalTrades ?? 0);
	const archetype = $derived(profile.archetype ? ARCHETYPE_MAP.get(profile.archetype) : undefined);
	const archetypeAccent = $derived(archetype?.accent ?? 'var(--color-primary)');

	/**
	 * VXP balance — for now equal to lifetime points. Rendered as a
	 * small laurel-accent chip next to the handle ("1,000 VXP").
	 * Locale-aware separators via `toLocaleString`.
	 */
	const vxpBalance = $derived(points);
	const vxpBalanceLabel = $derived(`${vxpBalance.toLocaleString($localeStore)} VXP`);

	const accuracyDisplay = $derived((Math.round(accuracy * 10) / 10).toFixed(0));

	/**
	 * Global rank — viewer's 1-based index in the cached leaderboard.
	 * The leaderboard is populated lazily by `LoaderLeaderboard` on app
	 * boot; when the slice hasn't resolved yet (or the viewer isn't in
	 * it), we render an em-dash placeholder rather than omitting the
	 * chip entirely, so the stats-line layout stays stable across loads.
	 */
	const globalRank = $derived.by<number | undefined>(() => {
		const idx = $leaderboard.findIndex((entry) => entry.owner === profile.owner);

		return idx === -1 ? undefined : idx + 1;
	});

	const globalRankDisplay = $derived(globalRank === undefined ? '—' : `#${globalRank}`);

	/**
	 * Compact lifetime stats line — "{calls} calls · {accuracy}% accuracy".
	 */
	const statsLineCalls = $derived.by(() => {
		if (totalTrades >= 1_000_000) {
			return `${(totalTrades / 1_000_000).toFixed(1)}M`;
		}

		if (totalTrades >= 10_000) {
			return `${Math.round(totalTrades / 1_000)}K`;
		}

		if (totalTrades >= 1_000) {
			return `${(totalTrades / 1_000).toFixed(1)}K`;
		}

		return totalTrades.toString();
	});

	/* User-stats — drives session VXP delta + past calls preview. ------ */

	let userStats = $state<UserStatsDoc | undefined>(undefined);

	const recentSettlements = $derived(userStats?.recentSettlements ?? []);

	const sessionVxpDelta = $derived.by(() => {
		const since = Date.now() - DAY_IN_MS;
		const today = recentSettlements.filter((s) => s.settledAtMs >= since);

		// `RecentSettlementSnapshot` does not carry per-call VXP; we estimate
		// at the canonical 240 VXP-per-resolution rate used elsewhere in the
		// app. Sign is win → +240, loss → -240.
		const VXP_PER_CALL = 240;
		const delta = today.reduce((acc, s) => acc + (s.win ? VXP_PER_CALL : -VXP_PER_CALL), 0);

		return { count: today.length, delta };
	});

	const marketsById = $derived(
		new Map<string, Market>(($marketsStore ?? []).map((m) => [m.id, m]))
	);
	const marketTitle = (marketId: string): string => marketsById.get(marketId)?.title ?? marketId;

	const fmtRelativeTime = (ms: number): string => {
		const delta = Date.now() - ms;
		const seconds = Math.floor(delta / 1000);

		if (seconds < 60) {
			return t({ locale: $localeStore, key: 'dash.history.just_now' });
		}

		const minutes = Math.floor(seconds / 60);

		if (minutes < 60) {
			return t({
				locale: $localeStore,
				key: 'dash.history.minutes_ago',
				params: { count: minutes }
			});
		}

		const hours = Math.floor(minutes / 60);

		if (hours < 24) {
			return t({ locale: $localeStore, key: 'dash.history.hours_ago', params: { count: hours } });
		}

		const days = Math.floor(hours / 24);

		return t({ locale: $localeStore, key: 'dash.history.days_ago', params: { count: days } });
	};

	/* Affiliations ----------------------------------------------------- */

	let myUni = $state<AffiliationDoc | undefined>(undefined);
	let myCountry = $state<AffiliationDoc | undefined>(undefined);
	let pickerKind = $state<AffiliationKind | null>(null);

	const refreshAffiliations = async () => {
		try {
			const { university, country } = await listMyAffiliations();
			myUni = university;
			myCountry = country;
		} catch (err) {
			console.error('ProfileDashboard: listMyAffiliations failed', err);
		}
	};

	/**
	 * Four-slot affiliation grid — Uni / Country / City / Company.
	 * Only the first two are wired; City + Company are locked
	 * placeholders ("coming soon").
	 */
	interface AffilSlot {
		key: 'university' | 'country' | 'city' | 'company';
		kind: AffiliationKind | null;
		labelKey: MessageKey;
		filled: boolean;
		value: string | null;
		/** Stored affiliation id — ISO-2 for countries, slug for unis.
		 *  Needed at render time so the country slot can pass an ID to
		 *  `<CountryFlag>` rather than the display `value` (name). */
		affiliationIdentifier: string | null;
		glyph: string;
		locked: boolean;
	}

	const slots = $derived.by<AffilSlot[]>(() => {
		const uniOption = myUni
			? lookupWorldsAffiliation({ kind: 'university', id: myUni.affiliationIdentifier })
			: undefined;
		const countryOption = myCountry
			? lookupWorldsAffiliation({ kind: 'country', id: myCountry.affiliationIdentifier })
			: undefined;

		return [
			{
				key: 'university',
				kind: 'university',
				labelKey: 'profile.dashboard.affiliations.university',
				filled: uniOption !== undefined,
				value: uniOption?.name ?? null,
				affiliationIdentifier: uniOption?.id ?? null,
				glyph: uniOption?.glyph ?? '+',
				locked: false
			},
			{
				key: 'country',
				kind: 'country',
				labelKey: 'profile.dashboard.affiliations.country',
				filled: countryOption !== undefined,
				value: countryOption?.name ?? null,
				affiliationIdentifier: countryOption?.id ?? null,
				glyph: countryOption?.glyph ?? '+',
				locked: false
			},
			{
				key: 'city',
				kind: null,
				labelKey: 'profile.dashboard.affiliations.city',
				filled: false,
				value: null,
				affiliationIdentifier: null,
				glyph: '+',
				locked: true
			},
			{
				key: 'company',
				kind: null,
				labelKey: 'profile.dashboard.affiliations.company',
				filled: false,
				value: null,
				affiliationIdentifier: null,
				glyph: '+',
				locked: true
			}
		];
	});

	const filledSlotCount = $derived(slots.filter((s) => s.filled).length);

	const handleSlotClick = (slot: AffilSlot) => {
		if (slot.locked || slot.kind === null) {
			return;
		}

		pickerKind = slot.kind;
	};

	/* Avatar editor ---------------------------------------------------- */

	let avatarEditorOpen = $state(false);

	/* Oracle insight (kept lean — no archetype-fiction card) ----------- */

	const oracleInsight = $derived.by(() => {
		const trades = totalTrades;
		const acc = Math.round(accuracy);
		const d = dailyStreak;

		if (trades === 0) {
			return t({ locale: $localeStore, key: 'profile.dashboard.oracle.no_calls' });
		}

		if (acc >= 80) {
			return t({
				locale: $localeStore,
				key: 'profile.dashboard.oracle.approves',
				params: { acc, trades }
			});
		}

		if (d >= 7) {
			return t({
				locale: $localeStore,
				key: 'profile.dashboard.oracle.streak_acc',
				params: { days: d, acc }
			});
		}

		if (acc >= 60) {
			return t({
				locale: $localeStore,
				key: 'profile.dashboard.oracle.above',
				params: { acc, trades }
			});
		}

		return t({
			locale: $localeStore,
			key: 'profile.dashboard.oracle.room_sharpen',
			params: { trades, acc }
		});
	});

	/* Achievements ----------------------------------------------------- */

	const persistedUnlocks = $derived(new Set(profile.unlockedAchievements ?? []));
	const achievementEvaluations = $derived(
		evaluateAchievements({
			totalTrades,
			winStreak: profile.streak ?? 0,
			dailyStreak,
			accuracy,
			level,
			contrarianWins: profile.contrarianWins ?? 0
		})
	);

	// Sort: closest-to-unlock locked first → earned → far-locked.
	// `b.prog - a.prog` ordering with the earned bucket folded behind.
	const sortedAchievements = $derived.by(() => {
		const items = [...achievementEvaluations];

		return items.sort((a, b) => {
			const aUnlocked = persistedUnlocks.has(a.id) || a.unlocked;
			const bUnlocked = persistedUnlocks.has(b.id) || b.unlocked;

			if (aUnlocked !== bUnlocked) {
				return aUnlocked ? -1 : 1;
			}

			return b.progress - a.progress;
		});
	});

	/**
	 * Achievement glyph mapping (per-id lucide picker):
	 *   - `oracle`  → eye
	 *   - `on-fire` → flame
	 *   - `marathon`→ target
	 *   - default   → trophy
	 *
	 * Every other tile (first-blood, contrarian, lvl-25, …) falls
	 * through to Trophy. The Album surface uses the same mapping so
	 * the affordance carries across surfaces.
	 */
	const iconForAchievement = (id: string): typeof Trophy => {
		if (id === 'oracle') {
			return Eye;
		}

		if (id === 'on-fire') {
			return Flame;
		}

		if (id === 'marathon') {
			return Target;
		}

		return Trophy;
	};

	/* Past calls preview ---------------------------------------------- */

	const pastCallsPreview = $derived(recentSettlements.slice(0, 3));

	onMount(() => {
		if (!isOwnProfile) {
			return;
		}

		void (async () => {
			try {
				userStats = await loadMyUserStats(profile.owner);
			} catch (err) {
				console.error('ProfileDashboard: failed to load user_stats', err);
			}
		})();

		void refreshAffiliations();
	});
</script>

<div class="profile-dashboard">
	<!-- Identity card with archetype halo -->
	<section style:--archetype-accent={archetypeAccent} class="profile-identity">
		<span class="profile-halo" aria-hidden="true"></span>

		<div class="profile-identity-row">
			<button
				class="profile-avatar"
				class:is-editable={isOwnProfile}
				aria-label={t({ locale: $localeStore, key: 'profile.dashboard.edit_avatar' })}
				disabled={!isOwnProfile}
				onclick={() => isOwnProfile && (avatarEditorOpen = true)}
				type="button"
			>
				<Avatar
					class="h-full w-full"
					avatar={profile.avatar}
					nickname={profile.nickname}
					owner={profile.owner}
				/>
				{#if isOwnProfile}
					<span class="profile-avatar-edit" aria-hidden="true">
						<Pencil size={12} strokeWidth={2} />
					</span>
				{/if}
			</button>

			<div class="profile-identity-meta">
				<!-- Row 1: handle · VXP balance chip.
				     The handle doubles as the rename affordance (own
				     profile only); the avatar carries the pencil glyph,
				     so a second inline pencil was redundant noise. -->
				<div class="profile-handle-row">
					{#if isOwnProfile}
						<!-- The button's visible text is the accessible name
						     (no `aria-label` override), so screen readers
						     still hear the handle. `title` surfaces the
						     edit affordance on hover / supplementary
						     announcement. -->
						<button
							class="profile-handle profile-handle-btn"
							onclick={openEditProfile}
							title={t({ locale: $localeStore, key: 'profile.dashboard.edit_profile' })}
							type="button"
						>
							@{profile.nickname}
						</button>
					{:else}
						<h1 class="profile-handle">@{profile.nickname}</h1>
					{/if}
					<span class="num profile-vxp-chip" aria-label={vxpBalanceLabel}>
						{vxpBalanceLabel}
					</span>
				</div>

				<!-- Row 2: school + country chip(s) BELOW the handle.
				     Each chip would ideally render in its affiliation's
				     own accent ("STANFORD" red, country flag tint) —
				     we don't carry per-school / per-country colours
				     yet, so we use a laurel-accent stand-in (school)
				     and a muted pill (country). Archetype tag trails
				     behind when no affiliations are set, preserving the
				     "you're an archetype" affordance. -->
				{#if myUni !== undefined || myCountry !== undefined}
					{@const uniOption = myUni
						? lookupWorldsAffiliation({ kind: 'university', id: myUni.affiliationIdentifier })
						: undefined}
					{@const countryOption = myCountry
						? lookupWorldsAffiliation({ kind: 'country', id: myCountry.affiliationIdentifier })
						: undefined}
					<div class="profile-affil-chip-row">
						{#if uniOption}
							<span class="school-chip">
								<span class="school-chip-dot" aria-hidden="true"></span>
								{uniOption.name.toUpperCase()}
							</span>
						{/if}
						{#if countryOption}
							<span class="country-chip">
								<CountryFlag class="profile-country-flag" countryCode={countryOption.id} />
								{countryOption.name.toUpperCase()}
							</span>
						{/if}
					</div>
				{:else if archetype}
					<div class="profile-affil-chip-row">
						<span class="profile-archetype-chip">
							{t({ locale: $localeStore, key: archetype.tagKey })}
						</span>
					</div>
				{/if}

				<!-- Row 3: compact identity stats — Lvl · accuracy -->
				<p class="profile-stats-line">
					{t({
						locale: $localeStore,
						key: 'profile.dashboard.identity_meta',
						params: { level, rank: globalRankDisplay, accuracy: accuracyDisplay }
					})}
				</p>

				<!-- Row 4: inline streak + calls (Flame N · M calls).
				     Always rendered — the flame stays visible even at
				     streak=0 so the row reads as persistent. -->
				<p class="profile-streak-line">
					<span class="profile-streak-inline" aria-label="streak">
						<StreakFlame count={dailyStreak} size={14} />
						<span class="num">{dailyStreak}</span>
					</span>
					<span class="profile-stats-sep" aria-hidden="true">·</span>
					<span class="num">
						{t({
							locale: $localeStore,
							key: 'profile.dashboard.calls_count',
							params: { calls: statsLineCalls }
						})}
					</span>
					{#if sessionVxpDelta.count > 0}
						<span class="profile-stats-sep" aria-hidden="true">·</span>
						<span
							class="num profile-session-inline"
							class:is-down={sessionVxpDelta.delta < 0}
							class:is-up={sessionVxpDelta.delta > 0}
						>
							{sessionVxpDelta.delta >= 0 ? '+' : ''}{sessionVxpDelta.delta}
							{t({ locale: $localeStore, key: 'profile.dashboard.session_today' })}
						</span>
					{/if}
				</p>
			</div>
		</div>

		<!-- Level progress — explicit "LEVEL" eyebrow + "{xp} / {target}
		     VXP" numbers. -->
		<div class="profile-level-row">
			<span class="profile-level-label">
				{t({ locale: $localeStore, key: 'profile.dashboard.level_label' })}
			</span>
			<span class="num profile-level-target">
				{points.toLocaleString($localeStore)} / {nextLevelTarget.toLocaleString($localeStore)} VXP
			</span>
		</div>
		<div class="profile-level-bar" role="presentation">
			<span style:width={`${xpProgressPercent}%`}></span>
		</div>
	</section>

	<!-- Affiliations · 4-slot grid -->
	<section class="profile-affiliations">
		<div class="profile-affiliations-head">
			<span class="profile-affiliations-eyebrow">
				{t({ locale: $localeStore, key: 'profile.dashboard.affiliations.title' })}
			</span>
			<span class="num profile-affiliations-count">
				{t({
					locale: $localeStore,
					key: 'profile.dashboard.affiliations.count',
					params: { count: filledSlotCount }
				})}
			</span>
		</div>
		<div class="profile-affiliations-grid">
			{#each slots as slot (slot.key)}
				<button
					class="affil-slot"
					class:is-empty={!slot.filled && !slot.locked}
					class:is-filled={slot.filled}
					class:is-locked={slot.locked}
					aria-label={slot.filled
						? `${t({ locale: $localeStore, key: slot.labelKey })}: ${slot.value}`
						: t({ locale: $localeStore, key: slot.labelKey })}
					disabled={slot.locked || !isOwnProfile}
					onclick={() => handleSlotClick(slot)}
					type="button"
				>
					<span class="affil-slot-icon" aria-hidden="true">
						{#if slot.locked}
							<Lock size={14} strokeWidth={1.8} />
						{:else if slot.kind === 'country' && slot.affiliationIdentifier !== null}
							<CountryFlag class="affil-slot-flag" countryCode={slot.affiliationIdentifier} />
						{:else}
							{slot.glyph}
						{/if}
					</span>
					<span class="affil-slot-label">
						{t({ locale: $localeStore, key: slot.labelKey })}
					</span>
					<span class="affil-slot-value" class:dim={!slot.filled}>
						{#if slot.filled}
							{slot.value}
						{:else if slot.locked}
							{t({ locale: $localeStore, key: 'profile.dashboard.affiliations.soon' })}
						{:else}
							{t({ locale: $localeStore, key: 'profile.dashboard.affiliations.add' })}
						{/if}
					</span>
				</button>
			{/each}
		</div>
	</section>

	<!-- Past calls preview · 3 rows → Album -->
	{#if isOwnProfile && pastCallsPreview.length > 0}
		<section class="profile-past">
			<div class="profile-past-head">
				<h2 class="profile-section-title">
					{t({ locale: $localeStore, key: 'profile.dashboard.past_calls' })}
				</h2>
				<button class="profile-past-all" onclick={() => goto(resolve(AppPath.Album))} type="button">
					{t({ locale: $localeStore, key: 'profile.dashboard.all' })}
				</button>
			</div>
			<ul class="profile-past-list">
				{#each pastCallsPreview as row (row.marketId + row.settledAtMs)}
					<li>
						<a class="profile-past-row" href={resolve(`${AppPath.Markets}/${row.marketId}`)}>
							<span class="profile-past-res" class:is-lost={!row.win} class:is-won={row.win}>
								{#if row.win}
									<Check aria-hidden="true" size={11} strokeWidth={3} />
								{:else}
									<X aria-hidden="true" size={11} strokeWidth={3} />
								{/if}
							</span>
							<div class="profile-past-body">
								<div class="profile-past-q">{marketTitle(row.marketId)}</div>
								<div class="profile-past-ctx">
									{fmtRelativeTime(row.settledAtMs)}
								</div>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Achievements rail (glyph emblems + tier classes) -->
	<section class="profile-achievements">
		<div class="profile-achievements-head">
			<h2 class="profile-section-title">
				{t({ locale: $localeStore, key: 'profile.dashboard.achievements' })}
			</h2>
			<button
				class="profile-achievements-all"
				onclick={() => goto(resolve(AppPath.Album))}
				type="button"
			>
				{t({ locale: $localeStore, key: 'profile.dashboard.all' })}
			</button>
		</div>
		<div class="profile-achievements-rail">
			{#each sortedAchievements as evaluation (evaluation.id)}
				{@const unlocked = persistedUnlocks.has(evaluation.id) || evaluation.unlocked}
				{@const progressPercent = Math.round(evaluation.progress * 100)}
				{@const AchIcon = iconForAchievement(evaluation.id)}
				<div
					class="profile-achievement-card"
					class:is-bronze={evaluation.def.tier === 'bronze'}
					class:is-gold={evaluation.def.tier === 'gold'}
					class:is-silver={evaluation.def.tier === 'silver'}
					class:is-unlocked={unlocked}
				>
					<span class="profile-achievement-emblem" aria-hidden="true">
						<AchIcon size={18} strokeWidth={1.8} />
					</span>
					<div class="profile-achievement-text">
						<span class="profile-achievement-name">
							{t({ locale: $localeStore, key: evaluation.def.nameKey })}
						</span>
						<span class="profile-achievement-sub">
							{t({ locale: $localeStore, key: evaluation.def.descriptionKey })}
						</span>
					</div>
					{#if !unlocked && evaluation.progress > 0}
						<div
							class="profile-achievement-progress"
							aria-valuemax="100"
							aria-valuemin="0"
							aria-valuenow={progressPercent}
							role="progressbar"
						>
							<span style="width: {progressPercent}%" class="profile-achievement-progress-bar"
							></span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- Oracle weekly insight -->
	<ProfileOracleInsight {oracleInsight} />
</div>

{#if pickerKind !== null}
	<AffiliationPickerModal
		current={{ university: myUni, country: myCountry }}
		isOpen={true}
		kind={pickerKind}
		onClose={() => (pickerKind = null)}
		onPicked={() => {
			pickerKind = null;
			void refreshAffiliations();
		}}
	/>
{/if}

{#if editProfileOpen}
	<Modal isOpen={true} onClose={closeEditProfile}>
		<div class="profile-edit-sheet">
			<h2 class="profile-edit-title">
				{t({ locale: $localeStore, key: 'profile.dashboard.edit_profile' })}
			</h2>

			<label class="profile-edit-field">
				<span class="profile-edit-label">
					{t({ locale: $localeStore, key: 'profile.dashboard.handle_label' })}
				</span>
				<input
					aria-describedby="profile-edit-nickname-status"
					aria-invalid={nicknameStatus === 'taken' ||
						nicknameStatus === 'too_short' ||
						nicknameStatus === 'check_failed'}
					disabled={pending}
					oninput={onNicknameInput}
					type="text"
					value={editedNickname}
				/>
				{#if nicknameHintKey}
					<p
						id="profile-edit-nickname-status"
						class="profile-edit-hint"
						class:is-warning={nicknameStatus === 'taken' || nicknameStatus === 'check_failed'}
						aria-live="polite"
					>
						{t({
							locale: $localeStore,
							key: nicknameHintKey,
							params:
								nicknameHintKey === 'profile.dashboard.nickname_min'
									? { count: MIN_NICKNAME_LENGTH }
									: nicknameHintKey === 'profile.dashboard.nickname_taken'
										? { nickname: editedNickname.trim() }
										: {}
						})}
					</p>
				{/if}
			</label>

			<div class="profile-edit-actions">
				<button
					class="profile-edit-cancel"
					disabled={pending}
					onclick={closeEditProfile}
					type="button"
				>
					{t({ locale: $localeStore, key: 'profile.dashboard.cancel' })}
				</button>
				<button
					class="profile-edit-save"
					disabled={saveStatus !== 'enabled'}
					onclick={handleSaveProfile}
					type="button"
				>
					{t({ locale: $localeStore, key: 'profile.dashboard.save' })}
				</button>
			</div>
		</div>
	</Modal>
{/if}

{#if avatarEditorOpen}
	<Modal isOpen={true} onClose={() => (avatarEditorOpen = false)}>
		<div class="profile-avatar-editor">
			<h2 class="profile-edit-title">
				{t({ locale: $localeStore, key: 'profile.dashboard.edit_avatar' })}
			</h2>
			<!-- TODO: wire to the full avatar shuffle / save flow once the
				 avatar library is ported. Today the avatar is derived from
				 the user's seed; this stub surfaces the entry point so the
				 affordance is discoverable. Tracked under the avatar editor
				 follow-up. -->
			<p class="profile-avatar-editor-body">
				{t({ locale: $localeStore, key: 'profile.dashboard.edit_avatar_soon' })}
			</p>
			<div class="profile-edit-actions">
				<button
					class="profile-edit-cancel"
					onclick={() => (avatarEditorOpen = false)}
					type="button"
				>
					{t({ locale: $localeStore, key: 'profile.dashboard.close' })}
				</button>
			</div>
		</div>
	</Modal>
{/if}

<style lang="postcss">
	.profile-dashboard {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem;
	}

	.profile-section-title {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-18);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
	}

	/* Identity card with archetype halo -------------------------------- */
	.profile-identity {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		overflow: hidden;
		padding: 1rem;
		border: 1px solid var(--border-base);
		border-radius: 1.5rem;
		background: var(--bg-popover);
		box-shadow: var(--shadow-card);
	}

	/* Top-right archetype-accent blur disc. Sized + opacity tuned so
	   it reads as a subtle warm halo behind the avatar quadrant — not
	   a yellow wash. Earlier values (220 px / 0.28 opacity / left-
	   anchored) flooded the entire card with accent colour and made
	   the surrounding text look tinted. */
	.profile-halo {
		position: absolute;
		top: -30px;
		right: -30px;
		width: 140px;
		height: 140px;
		border-radius: 50%;
		background: var(--archetype-accent, var(--color-primary));
		opacity: 0.1;
		filter: blur(20px);
		pointer-events: none;
	}

	.profile-identity-row {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
	}

	.profile-avatar {
		position: relative;
		display: block;
		width: 3.5rem;
		height: 3.5rem;
		flex-shrink: 0;
		overflow: visible;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: transparent;
		cursor: default;
	}

	.profile-avatar.is-editable {
		cursor: pointer;
	}

	.profile-avatar-edit {
		position: absolute;
		bottom: -2px;
		right: -2px;
		display: inline-flex;
		width: 1.25rem;
		height: 1.25rem;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--bg-popover);
		border-radius: 999px;
		background: var(--archetype-accent, var(--color-primary));
		color: var(--bg-canvas, #0e0d0b);
	}

	.profile-identity-meta {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.2rem;
	}

	.profile-handle-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
	}

	.profile-handle {
		margin: 0;
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-18);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-handle-btn {
		appearance: none;
		padding: 0;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
		font: inherit;
		font-size: var(--t-18);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
	}

	.profile-handle-btn:hover {
		color: var(--color-primary);
	}

	.profile-archetype-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.45rem;
		border-radius: var(--r-4);
		background: color-mix(in srgb, var(--archetype-accent, var(--color-primary)) 14%, transparent);
		color: var(--archetype-accent, var(--color-primary));
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	/* VXP balance chip — small laurel pill next to the handle. */
	.profile-vxp-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.5rem;
		border-radius: var(--r-4);
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
		color: var(--color-primary);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	/* Affiliation chip row sits below the handle row. */
	.profile-affil-chip-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.1rem;
	}

	/* School + country chips — laurel-accent / muted stand-ins.
	   Per-school and per-country palettes don't exist in our data
	   yet, so school chips use the laurel accent and country chips
	   use a neutral surface tint. Both share the same small
	   uppercase mono geometry. */
	.school-chip,
	.country-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.18rem 0.55rem;
		border-radius: var(--r-4);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
	}

	.school-chip {
		background: color-mix(in srgb, var(--color-primary) 18%, transparent);
		color: var(--color-primary);
	}

	.country-chip {
		background: var(--bg-surface);
		color: var(--text-base);
		border: 1px solid var(--border-base);
		box-shadow: none;
	}

	.school-chip-dot {
		display: inline-block;
		width: 5px;
		height: 5px;
		border-radius: 999px;
		background: currentColor;
		opacity: 0.85;
	}

	/* Country-flag SVG inside the inline chip — keep it pill-height so the
	   chip reads at the same scale as the school chip. Without this rule
	   the flag falls back to its native SVG size and explodes the row. */
	.profile-dashboard :global(.profile-country-flag) {
		display: inline-block;
		width: 14px;
		height: 10px;
		border-radius: 2px;
		object-fit: cover;
	}

	/* Country-flag SVG inside the four-slot tile — fills the same 1.6rem
	   square as the alphabetic glyph so the row geometry is stable. */
	.profile-dashboard :global(.affil-slot-flag) {
		width: 100%;
		height: 100%;
		border-radius: 999px;
		object-fit: cover;
	}

	.profile-streak-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		color: var(--char-flame);
		font-size: var(--t-12);
		font-weight: 700;
	}

	.profile-streak-line {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-12);
		letter-spacing: 0.02em;
	}

	.profile-streak-line :global(.num) {
		color: var(--text-base);
		font-weight: 600;
	}

	.profile-streak-line .profile-streak-inline :global(.num) {
		color: var(--char-flame);
	}

	.profile-stats-sep {
		color: var(--text-muted);
		opacity: 0.6;
	}

	.profile-session-inline.is-up {
		color: var(--yes);
	}

	.profile-session-inline.is-down {
		color: var(--no);
	}

	.profile-stats-line {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-12);
		letter-spacing: 0.02em;
	}

	.profile-level-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.profile-level-label {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-level-target {
		color: var(--text-base);
		font-size: var(--t-12);
		font-weight: 700;
	}

	.profile-level-bar {
		position: relative;
		height: 0.4rem;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--border-base) 60%, transparent);
	}

	.profile-level-bar span {
		display: block;
		height: 100%;
		background: linear-gradient(
			90deg,
			var(--archetype-accent, var(--color-primary)),
			var(--color-primary)
		);
		transition: width var(--d-state) var(--ease-vici);
	}

	/* Affiliations grid ------------------------------------------------ */
	.profile-affiliations {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.profile-affiliations-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.profile-affiliations-eyebrow {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-affiliations-count {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		letter-spacing: 0.1em;
	}

	.profile-affiliations-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.affil-slot {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		min-height: 6.2rem;
		padding: 0.85rem;
		border: 1px solid var(--border-base);
		border-radius: 1rem;
		background: var(--bg-popover);
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.affil-slot.is-empty:hover {
		border-color: var(--border-strong);
		background: color-mix(in srgb, var(--color-primary) 4%, var(--bg-popover));
	}

	.affil-slot.is-filled {
		border-color: color-mix(in srgb, var(--laurel) 45%, var(--border-base));
		background: color-mix(in srgb, var(--laurel) 6%, var(--bg-popover));
	}

	.affil-slot.is-locked {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.affil-slot:disabled {
		cursor: default;
	}

	.affil-slot-icon {
		display: inline-flex;
		overflow: hidden;
		width: 2.4rem;
		height: 2.4rem;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: var(--bg-surface);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.affil-slot.is-empty .affil-slot-icon,
	.affil-slot.is-locked .affil-slot-icon {
		width: 1.7rem;
		height: 1.7rem;
		font-size: 0.95rem;
	}

	.affil-slot.is-filled .affil-slot-icon {
		background: color-mix(in srgb, var(--laurel) 18%, var(--bg-surface));
		color: var(--laurel);
	}

	.affil-slot-label {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.affil-slot-value {
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.affil-slot-value.dim {
		color: var(--text-muted);
		font-weight: 500;
	}

	/* Past calls preview ---------------------------------------------- */
	.profile-past {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.profile-past-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.profile-past-all {
		border: 0;
		background: transparent;
		color: var(--color-primary);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		cursor: pointer;
	}

	.profile-past-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.profile-past-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--border-base);
		border-radius: 0.85rem;
		background: var(--bg-popover);
		color: var(--text-base);
		text-decoration: none;
		transition: background-color var(--d-hover) var(--ease-vici);
	}

	.profile-past-row:hover {
		background: color-mix(in srgb, var(--color-primary) 4%, var(--bg-popover));
	}

	.profile-past-res {
		display: inline-flex;
		width: 1.4rem;
		height: 1.4rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
	}

	.profile-past-res.is-won {
		background: color-mix(in srgb, var(--yes) 18%, transparent);
		color: var(--yes);
	}

	.profile-past-res.is-lost {
		background: color-mix(in srgb, var(--no) 18%, transparent);
		color: var(--no);
	}

	.profile-past-body {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.profile-past-q {
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-past-ctx {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	/* Achievements rail ----------------------------------------------- */
	.profile-achievements-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.625rem;
	}

	.profile-achievements-all {
		border: 0;
		background: transparent;
		color: var(--color-primary);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		cursor: pointer;
	}

	.profile-achievements-rail {
		display: flex;
		gap: 0.625rem;
		overflow-x: auto;
		padding-bottom: 0.5rem;
		scroll-snap-type: x mandatory;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.profile-achievements-rail::-webkit-scrollbar {
		display: none;
	}

	/* ~140 px card — emblem sits TOP-LEFT in its own row, with title +
	   sub stacked below. An always-on underbar shows progress, going
	   fully gold when unlocked. */
	.profile-achievement-card {
		position: relative;
		display: flex;
		min-width: 9rem;
		min-height: 6rem;
		flex-direction: column;
		flex-shrink: 0;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.85rem 0.9rem 0.95rem;
		border: 1px solid var(--border-base);
		border-radius: 1rem;
		background: var(--bg-popover);
		scroll-snap-align: start;
		overflow: hidden;
	}

	.profile-achievement-card:not(.is-unlocked) {
		opacity: 0.65;
	}

	.profile-achievement-card.is-unlocked {
		border-color: color-mix(in srgb, var(--color-primary) 45%, var(--border-base));
	}

	/* Full-width gold underbar for unlocked tiles (the "fully gold
	   filled" earned state). */
	.profile-achievement-card.is-unlocked::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 3px;
		background: var(--color-primary);
	}

	.profile-achievement-emblem {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.6rem;
		color: var(--text-base);
		font-size: 18px;
		line-height: 1;
		align-self: flex-start;
	}

	.profile-achievement-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.profile-achievement-card.is-unlocked .profile-achievement-emblem {
		background: var(--accent-glow, color-mix(in srgb, var(--color-primary) 16%, transparent));
		color: var(--color-primary);
	}

	.profile-achievement-card.is-gold.is-unlocked .profile-achievement-emblem {
		background: color-mix(in srgb, #f4c544 14%, transparent);
		color: #f4c544;
	}

	.profile-achievement-card.is-silver.is-unlocked .profile-achievement-emblem {
		background: color-mix(in srgb, #c0c5cc 14%, transparent);
		color: #c0c5cc;
	}

	.profile-achievement-card.is-bronze.is-unlocked .profile-achievement-emblem {
		background: color-mix(in srgb, #c97c4a 14%, transparent);
		color: #c97c4a;
	}

	.profile-achievement-card:not(.is-unlocked) .profile-achievement-emblem {
		background: var(--bg-surface);
		color: var(--text-muted);
		filter: grayscale(0.85);
	}

	.profile-achievement-name {
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 700;
	}

	.profile-achievement-sub {
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: var(--leading-snug);
	}

	.profile-achievement-progress {
		display: block;
		width: 100%;
		height: 0.25rem;
		margin-top: 0.4rem;
		overflow: hidden;
		border-radius: 999px;
		background: var(--bg-surface);
	}

	.profile-achievement-progress-bar {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--color-primary);
		transition: width 320ms ease;
	}

	/* Oracle insight --------------------------------------------------- */
	/* Edit-profile sheet ---------------------------------------------- */
	.profile-edit-sheet,
	.profile-avatar-editor {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.profile-edit-title {
		margin: 0;
		color: var(--text-base);
		font-family: var(--font-display);
		font-size: var(--t-18);
		font-weight: 700;
	}

	.profile-edit-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.profile-edit-label {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-edit-field input {
		min-width: 0;
		flex: 1;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		padding: 0.6rem 0.75rem;
		color: var(--text-base);
		font: inherit;
		font-weight: 600;
		font-size: var(--t-14);
	}

	.profile-edit-hint {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: var(--leading-snug);
	}

	.profile-edit-hint.is-warning {
		color: var(--no);
	}

	.profile-edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
	}

	.profile-edit-cancel,
	.profile-edit-save {
		padding: 0.55rem 0.95rem;
		border-radius: var(--r-pill);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.profile-edit-cancel {
		border: 1px solid var(--border-base);
		background: transparent;
		color: var(--text-base);
	}

	.profile-edit-save {
		border: 0;
		background: var(--color-primary);
		color: var(--bg-canvas, #0e0d0b);
	}

	.profile-edit-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.profile-avatar-editor-body {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-snug);
	}

	@media (min-width: 768px) {
		.profile-affiliations-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
