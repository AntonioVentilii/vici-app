<script lang="ts">
	import { Check, Flame, Lock, Pencil, X } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import AffiliationPickerModal from '$lib/components/leagues/AffiliationPickerModal.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { ARCHETYPE_MAP } from '$lib/constants/archetypes.constants';
	import { MIN_NICKNAME_LENGTH } from '$lib/constants/profile.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { lookupWorldsAffiliation } from '$lib/constants/worlds-affiliations.constants';
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
		/**
		 * Profile doc creation timestamp in nanoseconds (the Juno `Doc.created_at`).
		 * When provided, the dashboard renders a "Joined" line. The page-level
		 * loader is responsible for reading the raw doc via Juno's SDK and
		 * passing this through; we keep the dashboard ignorant of the satellite
		 * surface so the same component can be rendered against a synthetic
		 * shell (no doc yet) without crashing.
		 */
		joinedAtNs?: bigint;
	}

	const { profile, viewerPrincipal, joinedAtNs }: Props = $props();

	const isOwnProfile = $derived(viewerPrincipal === profile.owner);

	/* Editable identity ----------------------------------------------- */

	let editProfileOpen = $state(false);
	let editedNickname = $state('');
	let editedBio = $state('');
	let pending = $state(false);
	type NicknameEditStatus = 'available' | 'taken' | 'too_short' | 'required' | 'check_failed';
	let nicknameStatus = $state<NicknameEditStatus | undefined>(undefined);
	let nicknameChecking = $state(false);
	let nicknameCheckToken = 0;
	let nicknameCheckTimer: ReturnType<typeof setTimeout> | undefined;
	const nicknameCheckDebounce_ms = 350;

	/* Bio is FE-only (localStorage). The profile schema does not carry a
	   bio field yet; adding one requires a satellite redeploy. Keeping the
	   bio device-local mirrors the prototype's behaviour and unblocks the
	   parity surface without touching the wire schema. */
	const BIO_KEY = 'vici.profile.bio';

	let bio = $state('');

	onMount(() => {
		if (browser) {
			try {
				bio = localStorage.getItem(BIO_KEY) ?? '';
			} catch {
				bio = '';
			}
		}
	});

	const saveBio = (value: string) => {
		bio = value;

		if (browser) {
			try {
				localStorage.setItem(BIO_KEY, value);
			} catch {
				// quota / private mode — non-fatal
			}
		}
	};

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
		editedBio = bio;
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

	const onBioInput = (event: Event) => {
		if (event.currentTarget instanceof HTMLTextAreaElement) {
			editedBio = event.currentTarget.value;
		}
	};

	const handleSaveProfile = async () => {
		const trimmed = editedNickname.trim();
		const trimmedBio = editedBio.trim();

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

			saveBio(trimmedBio);
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
	 * Joined date — derived from the Juno doc's `created_at` (ns).
	 * Hidden when the profile is a synthetic shell (no persisted doc yet).
	 */
	const joinedLabel = $derived.by(() => {
		if (joinedAtNs === undefined) {
			return null;
		}

		const ms = Number(joinedAtNs / 1_000_000n);
		const date = new Date(ms);

		try {
			const formatter = new Intl.DateTimeFormat($localeStore, {
				month: 'short',
				year: 'numeric'
			});

			return formatter.format(date);
		} catch {
			return date.toISOString().slice(0, 7);
		}
	});

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
		const since = Date.now() - 24 * 60 * 60 * 1000;
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
	 * placeholders mirroring the prototype's "coming soon" state.
	 */
	interface AffilSlot {
		key: 'university' | 'country' | 'city' | 'company';
		kind: AffiliationKind | null;
		labelKey: MessageKey;
		filled: boolean;
		value: string | null;
		glyph: string;
		locked: boolean;
	}

	const slots = $derived.by<AffilSlot[]>(() => {
		const uniOption = myUni
			? lookupWorldsAffiliation({ kind: 'university', id: myUni.affiliationId })
			: undefined;
		const countryOption = myCountry
			? lookupWorldsAffiliation({ kind: 'country', id: myCountry.affiliationId })
			: undefined;

		return [
			{
				key: 'university',
				kind: 'university',
				labelKey: 'profile.dashboard.affiliations.university',
				filled: uniOption !== undefined,
				value: uniOption?.name ?? null,
				glyph: uniOption?.glyph ?? '+',
				locked: false
			},
			{
				key: 'country',
				kind: 'country',
				labelKey: 'profile.dashboard.affiliations.country',
				filled: countryOption !== undefined,
				value: countryOption?.name ?? null,
				glyph: countryOption?.glyph ?? '+',
				locked: false
			},
			{
				key: 'city',
				kind: null,
				labelKey: 'profile.dashboard.affiliations.city',
				filled: false,
				value: null,
				glyph: '+',
				locked: true
			},
			{
				key: 'company',
				kind: null,
				labelKey: 'profile.dashboard.affiliations.company',
				filled: false,
				value: null,
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

	// Sort: closest-to-unlock locked first → earned → far-locked. Mirrors
	// the prototype's `b.prog - a.prog` ordering with the earned bucket
	// folded behind.
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
				<div class="profile-handle-row">
					<h1 class="profile-handle">@{profile.nickname}</h1>
					{#if archetype}
						<span class="profile-archetype-chip">
							{t({ locale: $localeStore, key: archetype.tagKey })}
						</span>
					{/if}
					{#if dailyStreak > 0}
						<span class="profile-streak-inline" aria-label="streak">
							<Flame aria-hidden="true" size={12} strokeWidth={2} />
							<span class="num">{dailyStreak}</span>
						</span>
					{/if}
					{#if isOwnProfile}
						<button
							class="profile-edit-btn"
							aria-label={t({ locale: $localeStore, key: 'profile.dashboard.edit_profile' })}
							onclick={openEditProfile}
							type="button"
						>
							<Pencil aria-hidden="true" size={14} strokeWidth={1.8} />
						</button>
					{/if}
				</div>

				{#if bio.length > 0}
					<p class="profile-bio serif-italic">{bio}</p>
				{/if}

				<p class="profile-stats-line">
					{t({
						locale: $localeStore,
						key: 'profile.dashboard.lifetime_stats',
						params: { calls: statsLineCalls, accuracy: (Math.round(accuracy * 10) / 10).toFixed(0) }
					})}
				</p>

				{#if sessionVxpDelta.count > 0}
					<p
						class="profile-session-line"
						class:is-down={sessionVxpDelta.delta < 0}
						class:is-up={sessionVxpDelta.delta > 0}
					>
						<span class="num">
							{sessionVxpDelta.delta >= 0 ? '+' : ''}{sessionVxpDelta.delta}
						</span>
						<span>{t({ locale: $localeStore, key: 'profile.dashboard.session_today' })}</span>
					</p>
				{/if}

				{#if joinedLabel !== null}
					<p class="profile-joined-line">
						{t({
							locale: $localeStore,
							key: 'profile.dashboard.joined',
							params: { date: joinedLabel }
						})}
					</p>
				{/if}
			</div>
		</div>

		<div class="profile-level-row">
			<span class="profile-level-label">
				{t({ locale: $localeStore, key: 'profile.dashboard.level_badge', params: { level } })}
			</span>
			<span class="num profile-level-target">
				{points.toLocaleString()} / {nextLevelTarget.toLocaleString()} VXP
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
					class="profile-affil-slot"
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
					<span class="profile-affil-glyph" aria-hidden="true">
						{#if slot.locked}
							<Lock size={14} strokeWidth={1.8} />
						{:else}
							{slot.glyph}
						{/if}
					</span>
					<span class="profile-affil-label">
						{t({ locale: $localeStore, key: slot.labelKey })}
					</span>
					<span class="profile-affil-value" class:dim={!slot.filled}>
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
				<div
					class="profile-achievement-card"
					class:is-bronze={evaluation.def.tier === 'bronze'}
					class:is-gold={evaluation.def.tier === 'gold'}
					class:is-silver={evaluation.def.tier === 'silver'}
					class:is-unlocked={unlocked}
				>
					<span class="profile-achievement-emblem" aria-hidden="true">
						{evaluation.def.emblem}
					</span>
					<span class="profile-achievement-name">
						{t({ locale: $localeStore, key: evaluation.def.nameKey })}
					</span>
					<span class="profile-achievement-sub">
						{t({ locale: $localeStore, key: evaluation.def.descriptionKey })}
					</span>
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
	<section class="profile-oracle">
		<div class="profile-oracle-icon" aria-hidden="true">
			<OracleChar size={32} />
		</div>
		<div class="profile-oracle-body">
			<p class="profile-oracle-eyebrow">
				{t({ locale: $localeStore, key: 'profile.dashboard.oracle_label' })}
				<span>{t({ locale: $localeStore, key: 'profile.dashboard.oracle_weekly' })}</span>
			</p>
			<p class="profile-oracle-text serif-italic">{oracleInsight}</p>
		</div>
	</section>
</div>

{#if pickerKind !== null}
	<AffiliationPickerModal
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

			<label class="profile-edit-field">
				<span class="profile-edit-label">
					{t({ locale: $localeStore, key: 'profile.dashboard.bio_label' })}
				</span>
				<textarea
					disabled={pending}
					maxlength="140"
					oninput={onBioInput}
					placeholder={t({ locale: $localeStore, key: 'profile.dashboard.bio_placeholder' })}
					rows="3"
					value={editedBio}
				></textarea>
				<span class="profile-edit-counter num">{editedBio.length} / 140</span>
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

	/* Radial gradient ring tinted by the user's archetype accent. */
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

	.profile-streak-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.15rem 0.4rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--char-flame) 14%, transparent);
		color: var(--char-flame);
		font-size: var(--t-12);
		font-weight: 700;
	}

	.profile-edit-btn {
		display: inline-flex;
		width: 1.5rem;
		height: 1.5rem;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.profile-edit-btn:hover {
		color: var(--color-primary);
	}

	.profile-bio {
		margin: 0.15rem 0 0;
		color: var(--text-base);
		font-size: var(--t-13);
		line-height: var(--leading-snug);
		opacity: 0.92;
	}

	.profile-stats-line,
	.profile-joined-line,
	.profile-session-line {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-12);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-session-line.is-up {
		color: var(--yes);
	}

	.profile-session-line.is-down {
		color: var(--no);
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

	.profile-affil-slot {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.7rem 0.85rem;
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

	.profile-affil-slot.is-empty:hover {
		border-color: var(--border-strong);
		background: color-mix(in srgb, var(--color-primary) 4%, var(--bg-popover));
	}

	.profile-affil-slot.is-locked {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.profile-affil-slot:disabled {
		cursor: default;
	}

	.profile-affil-glyph {
		display: inline-flex;
		width: 1.6rem;
		height: 1.6rem;
		align-items: center;
		justify-content: center;
		border-radius: var(--r-8);
		background: var(--bg-surface);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 700;
	}

	.profile-affil-slot.is-filled .profile-affil-glyph {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.profile-affil-label {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-affil-value {
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-affil-value.dim {
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

	.profile-achievement-card {
		display: flex;
		min-width: 8.5rem;
		flex-direction: column;
		flex-shrink: 0;
		gap: 0.35rem;
		padding: 0.85rem;
		border: 1px solid var(--border-base);
		border-radius: 1rem;
		background: var(--bg-popover);
		scroll-snap-align: start;
	}

	.profile-achievement-card:not(.is-unlocked) {
		opacity: 0.6;
	}

	.profile-achievement-card.is-unlocked {
		border-color: color-mix(in srgb, var(--color-primary) 30%, var(--border-base));
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
	.profile-oracle {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		border: 1px solid color-mix(in srgb, var(--char-oracle) 18%, var(--border-base));
		border-radius: 1.25rem;
		background: color-mix(in srgb, var(--char-oracle) 4%, var(--bg-popover));
	}

	.profile-oracle-icon {
		display: flex;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: color-mix(in srgb, var(--char-oracle) 18%, transparent);
	}

	.profile-oracle-body {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.25rem;
	}

	.profile-oracle-eyebrow {
		margin: 0;
		color: var(--char-oracle);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-oracle-text {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-14);
		line-height: var(--leading-snug);
	}

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

	.profile-edit-field input,
	.profile-edit-field textarea {
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
		resize: vertical;
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

	.profile-edit-counter {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		text-align: right;
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
