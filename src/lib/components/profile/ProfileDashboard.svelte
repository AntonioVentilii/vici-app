<script lang="ts">
	import {
		Check,
		ChevronRight,
		Eye,
		Flame,
		Pencil,
		Star,
		Target,
		Timer,
		Users,
		X,
		Zap
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import ReferralCard from '$lib/components/profile/ReferralCard.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { ARCHETYPE_MAP } from '$lib/constants/archetypes.constants';
	import { ACCURACY_GATE_CALLS, isAccuracyUnlocked } from '$lib/constants/flow-rewards.constants';
	import { MIN_NICKNAME_LENGTH } from '$lib/constants/profile.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { checkNicknameAvailability, upsertProfile } from '$lib/services/profile.services';
	import {
		friendRequestsCountStore,
		friendsCountStore,
		refreshFriendRelations
	} from '$lib/stores/friends.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import type { UserProfile } from '$lib/types/profile';
	import { evaluateAchievements } from '$lib/utils/achievements.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { FLAME_STAGE_LABEL_KEYS, stageForStreak } from '$lib/utils/streak.utils';

	interface Props {
		profile: UserProfile;
		viewerPrincipal?: string;
	}

	const { profile, viewerPrincipal }: Props = $props();

	let isEditingNickname = $state(false);
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

		// Editing user's own current nickname is always "available" —
		// short-circuit the round-trip so the UI never flashes "taken"
		// while the user is mid-edit on their own handle.
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

	const onNicknameInput = (event: Event) => {
		if (event.currentTarget instanceof HTMLInputElement) {
			editedNickname = event.currentTarget.value;
			scheduleNicknameAvailabilityCheck(editedNickname);
		}
	};

	const handleSaveNickname = async () => {
		const trimmed = editedNickname.trim();

		if (trimmed.length < MIN_NICKNAME_LENGTH) {
			return;
		}

		// Final pre-flight against the satellite — the typing-time hint
		// can be stale (debounce window, race with another user). The
		// assertion still has the last word; this just gives us a
		// proper toast instead of an unhandled rejection.
		if (trimmed.toLowerCase() !== profile.nickname.trim().toLowerCase()) {
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
			const updatedData = {
				...profile,
				nickname: trimmed
			};

			await upsertProfile({ key: profile.owner, data: updatedData });
			userStore.update((curr) => ({ ...curr, profile: updatedData }));
			isEditingNickname = false;
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

	const cancelEdit = () => {
		if (nicknameCheckTimer) {
			clearTimeout(nicknameCheckTimer);
		}

		isEditingNickname = false;
		nicknameStatus = undefined;
		nicknameChecking = false;
	};

	const startNicknameEdit = () => {
		editedNickname = profile.nickname;
		isEditingNickname = true;
		nicknameStatus = 'available';
		nicknameChecking = false;
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

	const accuracy = $derived(profile.accuracy ?? 0);
	// `profile.streak` is the trade-momentum streak (consecutive
	// winning trades); `dailyStreak` is the day count behind the Flame
	// stage. The visible streak on this dashboard is the day count.
	const dailyStreak = $derived(profile.dailyStreak ?? 0);
	const level = $derived(profile.level ?? 1);
	const points = $derived(profile.points ?? 0);
	const xpInLevel = $derived(points % 500);
	const nextLevelTarget = $derived(level * 500);
	const xpProgressPercent = $derived((xpInLevel / 500) * 100);

	const flameStage = $derived(stageForStreak(dailyStreak));
	const flameLabel = $derived(t({ locale: $localeStore, key: FLAME_STAGE_LABEL_KEYS[flameStage] }));
	const archetype = $derived(profile.archetype ? ARCHETYPE_MAP.get(profile.archetype) : undefined);

	const totalTrades = $derived(profile.totalTrades ?? 0);
	const winRate = $derived(profile.winRate ?? profile.accuracy ?? 0);
	const wins = $derived(Math.round((winRate / 100) * totalTrades));
	const accuracyUnlocked = $derived(isAccuracyUnlocked(totalTrades));
	const callsUntilAccuracy = $derived(Math.max(0, ACCURACY_GATE_CALLS - totalTrades));

	const accuracyDisplay = $derived(
		accuracyUnlocked
			? `${(Math.round(accuracy * 10) / 10).toFixed(1)}%`
			: t({
					locale: $localeStore,
					key: 'profile.dashboard.accuracy_remaining',
					params: { count: callsUntilAccuracy }
				})
	);

	const oracleInsight = $derived.by(() => {
		const trades = totalTrades;
		const acc = Math.round(accuracy);
		const d = dailyStreak;

		if (trades === 0) {
			return t({ locale: $localeStore, key: 'profile.dashboard.oracle.no_calls' });
		}

		if (!accuracyUnlocked) {
			if (d >= 7) {
				return t({
					locale: $localeStore,
					key:
						trades === 1
							? 'profile.dashboard.oracle.gate_streak_one'
							: 'profile.dashboard.oracle.gate_streak',
					params: { days: d, trades }
				});
			}

			return t({
				locale: $localeStore,
				key:
					trades === 1
						? 'profile.dashboard.oracle.gate_no_streak_one'
						: 'profile.dashboard.oracle.gate_no_streak',
				params: { trades, gate: ACCURACY_GATE_CALLS }
			});
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

	const streakBlocks = $derived.by(() => {
		const activeBlocks = Math.min(dailyStreak, 30);

		return Array.from({ length: 30 }, (_, index) => index >= 30 - activeBlocks);
	});

	const achievementIcons = {
		target: Target,
		flame: Flame,
		eye: Eye,
		zap: Zap,
		timer: Timer,
		star: Star
	};

	const isOwnProfile = $derived(viewerPrincipal === profile.owner);
	const friendsCount = $derived($friendsCountStore);
	const pendingFriendRequestsCount = $derived($friendRequestsCountStore);

	const friendsSubKey = $derived<
		'profile.dashboard.friends.count' | 'profile.dashboard.friends.empty'
	>(friendsCount > 0 ? 'profile.dashboard.friends.count' : 'profile.dashboard.friends.empty');

	onMount(() => {
		if (isOwnProfile) {
			void refreshFriendRelations();
		}
	});

	// `profile.unlockedAchievements` is the persisted source of truth
	// (append-only; written by `profile.services.ts` after each stats
	// sync). The live evaluator runs on the same snapshot to drive
	// progress bars on not-yet-earned cards — and as a fallback that
	// keeps the UI honest when persistence lags (e.g. an offline
	// session before the next sync writes).
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
</script>

<div class="profile-dashboard">
	<section class="profile-identity">
		<div class="profile-identity-row">
			<div class="profile-avatar">
				<Avatar
					class="h-full w-full"
					avatar={profile.avatar}
					nickname={profile.nickname}
					owner={profile.owner}
				/>
			</div>

			<div class="profile-identity-meta">
				{#if isEditingNickname}
					<div class="profile-nickname-edit">
						<input
							aria-describedby="profile-nickname-status"
							aria-invalid={nicknameStatus === 'taken' ||
								nicknameStatus === 'too_short' ||
								nicknameStatus === 'check_failed'}
							aria-label={t({ locale: $localeStore, key: 'profile.dashboard.nickname_label' })}
							disabled={pending}
							oninput={onNicknameInput}
							onkeydown={(e) => e.key === 'Enter' && handleSaveNickname()}
							type="text"
							value={editedNickname}
						/>
						<BaseButton
							class="text-yes hover:text-yes"
							aria-label={t({ locale: $localeStore, key: 'profile.dashboard.save' })}
							onclick={handleSaveNickname}
							status={saveStatus}
						>
							<Check size={18} />
						</BaseButton>
						<BaseButton
							class="text-destructive hover:text-destructive"
							aria-label={t({ locale: $localeStore, key: 'profile.dashboard.cancel' })}
							onclick={cancelEdit}
							status={pending ? 'disabled' : 'enabled'}
						>
							<X size={18} />
						</BaseButton>
					</div>
					{#if nicknameHintKey}
						<p
							id="profile-nickname-status"
							class="profile-nickname-hint"
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
				{:else}
					<div class="profile-handle-row">
						<h1 class="profile-handle">@{profile.nickname}</h1>
						{#if archetype}
							<span
								style="color: {archetype.accent}; background: color-mix(in srgb, {archetype.accent} 14%, transparent);"
								class="profile-archetype-chip"
								>{t({ locale: $localeStore, key: archetype.tagKey })}</span
							>
						{/if}
						{#if viewerPrincipal === profile.owner}
							<button
								class="profile-edit-btn"
								aria-label={t({ locale: $localeStore, key: 'profile.dashboard.edit_nickname' })}
								onclick={startNicknameEdit}
								type="button"
							>
								<Pencil aria-hidden="true" size={14} strokeWidth={1.8} />
							</button>
						{/if}
					</div>
				{/if}

				<p class="profile-stats-line">
					{t({ locale: $localeStore, key: 'profile.dashboard.stats_line', params: { level } })}
				</p>
				<p class="profile-fire-line">
					<Flame aria-hidden="true" size={14} strokeWidth={2} />
					{t({
						locale: $localeStore,
						key:
							totalTrades === 1 ? 'profile.dashboard.fire_line_one' : 'profile.dashboard.fire_line',
						params: { streak: dailyStreak, trades: totalTrades }
					})}
				</p>
			</div>
		</div>

		<div class="profile-level-row">
			<span class="profile-level-label">
				{t({ locale: $localeStore, key: 'profile.dashboard.level_badge', params: { level } })}
			</span>
			<span class="num profile-level-target">
				{points.toLocaleString()} / {nextLevelTarget.toLocaleString()} XP
			</span>
		</div>
		<div class="profile-level-bar" role="presentation">
			<span style:width={`${xpProgressPercent}%`}></span>
		</div>
	</section>

	{#if archetype}
		<section style:--archetype-accent={archetype.accent} class="profile-archetype-card">
			<p class="profile-archetype-eyebrow">
				{t({
					locale: $localeStore,
					key: 'profile.dashboard.your_archetype',
					params: { tag: t({ locale: $localeStore, key: archetype.tagKey }) }
				})}
			</p>
			<p class="profile-archetype-name">
				{t({ locale: $localeStore, key: archetype.nameKey })}
			</p>
			<p class="profile-archetype-body">
				{t({ locale: $localeStore, key: archetype.descriptionKey })}
			</p>
		</section>
	{/if}

	{#if isOwnProfile}
		<button
			class="profile-friends-row"
			onclick={() => goto(resolve(AppPath.Friends))}
			type="button"
		>
			<span class="profile-friends-icon" aria-hidden="true">
				<Users size={16} strokeWidth={1.8} />
			</span>
			<span class="profile-friends-copy">
				<span class="profile-friends-label">
					{t({ locale: $localeStore, key: 'profile.dashboard.friends' })}
				</span>
				<span class="profile-friends-sub">
					{t({
						locale: $localeStore,
						key: friendsSubKey,
						params: { count: friendsCount }
					})}
				</span>
			</span>
			{#if pendingFriendRequestsCount > 0}
				<span class="profile-friends-badge num">
					{t({
						locale: $localeStore,
						key: 'profile.dashboard.friends.pending',
						params: { count: pendingFriendRequestsCount }
					})}
				</span>
			{/if}
			<span class="profile-friends-chevron" aria-hidden="true">
				<ChevronRight size={16} strokeWidth={1.8} />
			</span>
		</button>

		<ReferralCard {profile} />
	{/if}

	<section class="profile-skill">
		<h2 class="profile-section-title">
			{t({ locale: $localeStore, key: 'profile.dashboard.skill' })}
		</h2>
		<div class="profile-skill-grid">
			<div class="profile-stat">
				<span class="profile-stat-label">
					{t({ locale: $localeStore, key: 'profile.dashboard.accuracy_short' })}
				</span>
				<span class="num profile-stat-value">{accuracyDisplay}</span>
			</div>
			<div class="profile-stat">
				<span class="profile-stat-label">
					{t({ locale: $localeStore, key: 'profile.dashboard.calls_short' })}
				</span>
				<span class="num profile-stat-value">{totalTrades}</span>
			</div>
			<div class="profile-stat">
				<span class="profile-stat-label">
					{t({ locale: $localeStore, key: 'profile.dashboard.wins' })}
				</span>
				<span class="num profile-stat-value">{wins}</span>
			</div>
			<div class="profile-stat">
				<span class="profile-stat-label">
					{t({ locale: $localeStore, key: 'profile.dashboard.streak_short' })}
				</span>
				<span class="num profile-stat-value">{dailyStreak}d</span>
			</div>
		</div>
	</section>

	<section class="profile-activity">
		<div class="profile-activity-head">
			<span class="profile-activity-label">
				{t({ locale: $localeStore, key: 'profile.dashboard.last_30_days' })}
			</span>
			<span class="profile-activity-meta">
				<span class="num">{dailyStreak}</span>
				<span>{flameLabel}</span>
			</span>
		</div>
		<div class="profile-activity-grid" role="presentation">
			{#each streakBlocks as isActive, index (`day-${index}`)}
				<span class:is-active={isActive}></span>
			{/each}
		</div>
	</section>

	<section class="profile-achievements">
		<div class="profile-achievements-head">
			<h2 class="profile-section-title">
				{t({ locale: $localeStore, key: 'profile.dashboard.achievements' })}
			</h2>
			<button class="profile-achievements-all" type="button">
				{t({ locale: $localeStore, key: 'profile.dashboard.all' })}
			</button>
		</div>
		<div class="profile-achievements-rail">
			{#each achievementEvaluations as evaluation (evaluation.id)}
				{@const Icon = achievementIcons[evaluation.def.icon]}
				{@const unlocked = persistedUnlocks.has(evaluation.id) || evaluation.unlocked}
				{@const progressPercent = Math.round(evaluation.progress * 100)}
				<div class="profile-achievement-card" class:is-unlocked={unlocked}>
					<span class="profile-achievement-icon" aria-hidden="true">
						<Icon size={16} strokeWidth={1.8} />
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

	/* Identity card ---------------------------------------------------- */
	.profile-identity {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem;
		border: 1px solid var(--border-base);
		border-radius: 1.5rem;
		background: var(--bg-popover);
		box-shadow: var(--shadow-card);
	}

	.profile-identity-row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.profile-avatar {
		width: 3.5rem;
		height: 3.5rem;
		flex-shrink: 0;
		overflow: hidden;
		border-radius: 999px;
		background: var(--bg-surface);
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
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
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

	.profile-nickname-edit {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	.profile-nickname-edit input {
		min-width: 0;
		flex: 1;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		padding: 0.45rem 0.6rem;
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 700;
	}

	.profile-nickname-hint {
		margin: 0.35rem 0 0;
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: var(--leading-snug);
	}

	.profile-nickname-hint.is-warning {
		color: var(--no);
	}

	.profile-stats-line,
	.profile-fire-line {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.profile-fire-line :global(svg) {
		color: var(--char-flame);
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
		background: linear-gradient(90deg, var(--hold-deep), var(--color-primary));
		transition: width var(--d-state) var(--ease-vici);
	}

	/* Archetype card --------------------------------------------------- */
	.profile-archetype-card {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.85rem 1rem;
		border-left: 3px solid var(--archetype-accent, var(--color-primary));
		border-radius: 1.25rem;
		background: color-mix(
			in srgb,
			var(--archetype-accent, var(--color-primary)) 8%,
			var(--bg-surface)
		);
	}

	.profile-archetype-eyebrow {
		margin: 0;
		color: var(--archetype-accent, var(--color-primary));
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-archetype-name {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 700;
	}

	.profile-archetype-body {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-normal);
	}

	/* Skill grid ------------------------------------------------------- */
	.profile-skill {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.profile-skill-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.profile-stat {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.85rem;
		border: 1px solid var(--border-base);
		border-radius: 1rem;
		background: var(--bg-popover);
	}

	.profile-stat-label {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-stat-value {
		color: var(--text-base);
		font-size: var(--t-20);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
	}

	/* Friends row ------------------------------------------------------ */
	.profile-friends-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-base);
		border-radius: 1.25rem;
		background: var(--bg-popover);
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.profile-friends-row:hover {
		border-color: var(--border-strong);
		background: color-mix(in srgb, var(--color-primary) 4%, var(--bg-popover));
	}

	.profile-friends-icon {
		display: inline-flex;
		width: 1.85rem;
		height: 1.85rem;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
	}

	.profile-friends-copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.profile-friends-label {
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 700;
	}

	.profile-friends-sub {
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.profile-friends-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.5rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--color-primary) 16%, transparent);
		color: var(--color-primary);
		font-size: var(--t-12);
		font-weight: 700;
	}

	.profile-friends-chevron {
		display: inline-flex;
		color: var(--text-muted);
	}

	/* Last 30 days ----------------------------------------------------- */
	.profile-activity {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-base);
		border-radius: 1.25rem;
		background: var(--bg-popover);
	}

	.profile-activity-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.profile-activity-label {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-activity-meta {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 700;
	}

	.profile-activity-meta .num {
		color: var(--color-primary);
	}

	.profile-activity-grid {
		display: grid;
		grid-template-columns: repeat(15, minmax(0, 1fr));
		gap: 0.3rem;
	}

	.profile-activity-grid span {
		aspect-ratio: 1;
		border-radius: 0.25rem;
		background: color-mix(in srgb, var(--color-primary) 18%, transparent);
	}

	.profile-activity-grid span.is-active {
		background: var(--color-primary);
	}

	/* Achievements ----------------------------------------------------- */
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

	.profile-achievement-card.is-unlocked {
		border-color: color-mix(in srgb, var(--color-primary) 30%, var(--border-base));
	}

	.profile-achievement-icon {
		display: inline-flex;
		width: 1.85rem;
		height: 1.85rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--color-primary) 14%, transparent);
		color: var(--color-primary);
	}

	.profile-achievement-card:not(.is-unlocked) .profile-achievement-icon {
		background: var(--bg-surface);
		color: var(--text-muted);
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
		border: 1px solid var(--border-base);
		border-radius: 1.25rem;
		background: color-mix(in srgb, var(--char-oracle) 6%, var(--bg-popover));
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

	@media (min-width: 768px) {
		.profile-skill-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
