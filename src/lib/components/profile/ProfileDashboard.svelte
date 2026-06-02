<script lang="ts">
	import { Eye, Flame, Lock, Pencil, Target, Trophy } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import StreakFlame from '$lib/components/characters/StreakFlame.svelte';
	import AffiliationPickerModal from '$lib/components/leagues/AffiliationPickerModal.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import AvatarEditor from '$lib/components/profile/AvatarEditor.svelte';
	import HandleEditor from '$lib/components/profile/HandleEditor.svelte';
	import ProfileOracleInsight from '$lib/components/profile/ProfileOracleInsight.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import { ARCHETYPE_MAP } from '$lib/constants/archetypes.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { lookupWorldsAffiliation } from '$lib/constants/worlds-affiliations.constants';
	import { leaderboard } from '$lib/derived/leaderboard.derived';
	import { upsertProfile } from '$lib/services/profile.services';
	import { loadMyUserStats } from '$lib/services/user-stats.services';
	import { myAffiliationsStore, refreshMyAffiliations } from '$lib/stores/affiliations.store';
	import { myAvatarParts } from '$lib/stores/avatar.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import type { AffiliationKind } from '$lib/types/affiliation';
	import type { UserProfile } from '$lib/types/profile';
	import type { UserStatsDoc } from '$lib/types/user-stats';
	import { evaluateAchievements } from '$lib/utils/achievements.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { deterministicParts } from '$lib/utils/vici-avatar.utils';

	interface Props {
		profile: UserProfile;
		viewerPrincipal?: string;
	}

	const { profile, viewerPrincipal }: Props = $props();

	const isOwnProfile = $derived(viewerPrincipal === profile.owner);

	/* Editable handle -------------------------------------------------- */

	// The handle (public `@`-name) is edited through the dedicated
	// {@link HandleEditor} sheet — a single input with an inline
	// availability indicator and a 30-day change limit. The limit is
	// server-authoritative (the set-profile assertion is the authority,
	// keyed off the profile's `handleLastChangeMs`); the editor mirrors it
	// and a change stamps `handleLastChangeMs` so the next window starts.
	let handleEditOpen = $state(false);
	let profileToast = $state<string | null>(null);
	let profileToastTimer: ReturnType<typeof setTimeout> | undefined;

	const flashProfileToast = (message: string) => {
		profileToast = message;

		if (profileToastTimer) {
			clearTimeout(profileToastTimer);
		}

		profileToastTimer = setTimeout(() => {
			profileToast = null;
		}, 1900);
	};

	const handleSavedHandle = async (handle: string) => {
		handleEditOpen = false;

		// Snapshot the pre-edit profile so we can roll the optimistic
		// update back verbatim if the persist fails.
		const previousProfile = profile;

		// Stamp the change time so the server-authoritative cooldown starts and
		// the editor reflects the new window. The set-profile assertion
		// validates this is ~now (the message time) on a handle change.
		const updatedData = { ...profile, nickname: handle, handleLastChangeMs: Date.now() };

		// Optimistic local update so the identity card reflects the new
		// handle immediately, then persist.
		userStore.update((curr) => ({ ...curr, profile: updatedData }));

		try {
			await upsertProfile({ key: profile.owner, data: updatedData });

			flashProfileToast(
				t({ locale: $localeStore, key: 'profile.handle.changed', params: { handle } })
			);
		} catch (err: unknown) {
			// Roll the optimistic update back on failure.
			userStore.update((curr) => ({ ...curr, profile: previousProfile }));

			const message = err instanceof Error ? err.message : '';
			const alreadyTaken = message.includes('already taken');

			notificationsStore.add({
				title: t({
					locale: $localeStore,
					key: alreadyTaken
						? 'profile.dashboard.nickname_taken_title'
						: 'profile.dashboard.nickname_save_failed_title'
				}),
				message: alreadyTaken
					? t({
							locale: $localeStore,
							key: 'profile.dashboard.nickname_taken',
							params: { nickname: handle }
						})
					: t({ locale: $localeStore, key: 'profile.dashboard.nickname_save_failed' }),
				type: 'error'
			});
		}
	};

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

	/* User-stats — drives the inline session VXP delta. --------------- */

	let userStats = $state<UserStatsDoc | undefined>(undefined);

	const recentSettlements = $derived(userStats?.recentSettlements ?? []);

	// The inline "session" figure is the net VXP swing across the user's
	// recent-calls window — the bounded `recentSettlements` snapshot (capped
	// at `USER_STATS_RECENT_LIMIT`), not a fixed clock window. It reads as
	// "how the latest run of calls is going" rather than "today".
	// `RecentSettlementSnapshot` does not carry per-call VXP; we estimate at
	// the canonical 240 VXP-per-resolution rate used elsewhere in the app.
	// Sign is win → +240, loss → -240.
	const sessionVxpDelta = $derived.by(() => {
		const VXP_PER_CALL = 240;
		const delta = recentSettlements.reduce(
			(acc, s) => acc + (s.win ? VXP_PER_CALL : -VXP_PER_CALL),
			0
		);

		return { count: recentSettlements.length, delta };
	});

	/* Affiliations ----------------------------------------------------- */

	let pickerKind = $state<AffiliationKind | null>(null);

	// Read the caller's affiliations from the shared cache (populated by
	// `refreshMyAffiliations`). Only the caller's own profile surfaces
	// the affiliation grid — other profiles keep the slots empty, as
	// before.
	const myUni = $derived(isOwnProfile ? $myAffiliationsStore.university : undefined);
	const myCountry = $derived(isOwnProfile ? $myAffiliationsStore.country : undefined);

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

	// Seed the editor with the user's saved picks, or — for a user who has
	// never customised — a deterministic face derived from their immutable
	// principal, so the editor opens on the same face the rest of the app
	// already shows them.
	const avatarInitialParts = $derived($myAvatarParts ?? deterministicParts(profile.owner));

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
			contrarianWins: profile.contrarianWins ?? 0,
			// `league-founder` reflects the persisted unlock here (the rail
			// reads `unlockedAchievements`); the dashboard doesn't fetch
			// league membership, so the live axis stays `false` and the
			// sticky persisted flag drives the earned state.
			ownsQualifyingLeague: false,
			topDecileStreak: profile.topDecileStreak ?? 0,
			// Monthly awards: `sharpest-eye`'s tier comes from the persisted
			// best tier; `bold-caller`'s live axis is the sticky persisted
			// unlock (the dashboard doesn't recompute monthly leaderboards).
			sharpestEyeBestTier: profile.sharpestEyeBestTier,
			wonBoldCallerMonth: (profile.unlockedAchievements ?? []).includes('bold-caller')
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
	 * Every other tile (first-call, contrarian, league-founder, …)
	 * falls through to Trophy. The Album surface uses the same mapping
	 * so the affordance carries across surfaces.
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

		void refreshMyAffiliations();
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
					animate
					avatar={profile.avatar}
					nickname={profile.nickname}
					owner={profile.owner}
					self={isOwnProfile}
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
				     profile only) and carries an inline pencil glyph that
				     opens the HandleEditor sheet. -->
				<div class="profile-handle-row">
					{#if isOwnProfile}
						<!-- The button's visible text (the handle) is the
						     accessible name. The pencil is decorative
						     (`aria-hidden`); `aria-label` names the action. -->
						<button
							class="profile-handle profile-handle-btn"
							aria-label={t({ locale: $localeStore, key: 'profile.handle.edit' })}
							onclick={() => (handleEditOpen = true)}
							type="button"
						>
							<span class="profile-handle-text">@{profile.nickname}</span>
							<Pencil
								class="profile-handle-pencil"
								aria-hidden="true"
								size={13}
								strokeWidth={1.7}
							/>
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
							{t({ locale: $localeStore, key: 'profile.dashboard.session' })}
						</span>
					{/if}
				</p>
			</div>
		</div>

		<!-- Level progress — explicit "LEVEL" eyebrow + "{xp} / {target}
		     VXP" numbers. -->
		<div class="profile-level-row">
			<span class="profile-level-label">
				{t({ locale: $localeStore, key: 'profile.dashboard.level_label', params: { level } })}
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
			void refreshMyAffiliations();
		}}
	/>
{/if}

{#if handleEditOpen}
	<HandleEditor
		current={profile.nickname}
		lastChangeMs={profile.handleLastChangeMs}
		onClose={() => (handleEditOpen = false)}
		onSaved={(handle) => void handleSavedHandle(handle)}
		owner={profile.owner}
	/>
{/if}

{#if profileToast !== null}
	<div class="profile-toast num" aria-live="polite" role="status">
		{profileToast}
	</div>
{/if}

{#if avatarEditorOpen && isOwnProfile}
	<AvatarEditor
		initial={avatarInitialParts}
		onClose={() => (avatarEditorOpen = false)}
		onSaved={() => (avatarEditorOpen = false)}
	/>
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
		border-radius: var(--r-12);
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
		border-radius: var(--r-pill);
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
		border-radius: var(--r-pill);
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
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		appearance: none;
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
		font: inherit;
		font-size: var(--t-18);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
	}

	.profile-handle-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-handle-btn :global(.profile-handle-pencil) {
		flex-shrink: 0;
		color: var(--fg-faint);
	}

	.profile-handle-btn:hover,
	.profile-handle-btn:hover :global(.profile-handle-pencil) {
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
		font-size: var(--t-10);
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
		letter-spacing: var(--tracking-wide);
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
		border-radius: var(--r-pill);
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
		border-radius: var(--r-2);
		object-fit: cover;
	}

	/* Country-flag SVG inside the four-slot tile — fills the same 1.6rem
	   square as the alphabetic glyph so the row geometry is stable. */
	.profile-dashboard :global(.affil-slot-flag) {
		width: 100%;
		height: 100%;
		border-radius: var(--r-pill);
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
		border-radius: var(--r-pill);
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

	/* Affiliations card ------------------------------------------------ */
	/* Wrapped in its own bordered card surface — same treatment as the
	   identity card above (border / radius / popover background / card
	   shadow) so the AFFILIATIONS header + 4-slot grid read as a single
	   contained card rather than floating on the page background. */
	.profile-affiliations {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-popover);
		box-shadow: var(--shadow-card);
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
		font-size: var(--t-10);
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-affiliations-count {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-10);
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
		gap: 0.375rem;
		min-height: 5.25rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		/* Tiles sit one surface step inside the affiliations card (which is
		   `--bg-popover`), so they read as distinct tiles rather than blending
		   into the card. `--bg-surface` is the darker step in every theme. */
		background: var(--bg-surface);
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	/* Empty (addable) slots read as dashed outlines on a transparent
	   surface, so they're visually distinct from a filled tile and invite
	   the user to add an affiliation. */
	.affil-slot.is-empty {
		border-style: dashed;
		background: transparent;
	}

	.affil-slot.is-empty:hover {
		border-color: var(--border-strong);
		background: color-mix(in srgb, var(--color-primary) 4%, transparent);
	}

	.affil-slot.is-filled {
		border-color: color-mix(in srgb, var(--laurel) 45%, var(--border-base));
		background: color-mix(in srgb, var(--laurel) 6%, var(--bg-surface));
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
		width: 1.75rem;
		height: 1.75rem;
		align-items: center;
		justify-content: center;
		border-radius: var(--r-pill);
		/* The tile is now `--bg-surface`, so the icon chip uses a faint
		   text-tint overlay (light in dark theme, dark in light/peach) to
		   stay distinct on the tile rather than matching it. */
		background: color-mix(in srgb, var(--text-base) 8%, transparent);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--t-12);
		font-weight: 700;
	}

	.affil-slot.is-empty .affil-slot-icon,
	.affil-slot.is-locked .affil-slot-icon {
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
		border-radius: var(--r-12);
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
		border-radius: var(--r-pill);
		background: var(--bg-surface);
	}

	.profile-achievement-progress-bar {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--color-primary);
		transition: width var(--d-enter) ease;
	}

	/* Confirmation toast — floats above the pill-nav after a handle
	   change, auto-dismisses after ~1.9s. */
	.profile-toast {
		position: fixed;
		bottom: calc(120px + env(safe-area-inset-bottom, 0px));
		left: 50%;
		z-index: 110;
		padding: 0.625rem 1rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-popover);
		color: var(--text-base);
		font-family: var(--font-mono);
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.5);
		transform: translateX(-50%);
		animation: profile-toast-rise var(--d-state, 200ms) ease-out both;
	}

	@keyframes profile-toast-rise {
		from {
			opacity: 0;
			transform: translate(-50%, 8px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.profile-toast {
			animation: none;
		}
	}

	@media (min-width: 768px) {
		.profile-affiliations-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
