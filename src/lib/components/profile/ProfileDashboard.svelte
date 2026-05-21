<script lang="ts">
	import { Pencil, Check, X } from 'lucide-svelte';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import AchievementCard from '$lib/components/profile/AchievementCard.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CopyableAddress from '$lib/components/ui/CopyableAddress.svelte';
	import { ACHIEVEMENTS } from '$lib/constants/achievements.constants';
	import { ARCHETYPE_MAP } from '$lib/constants/archetypes.constants';
	import { ACCURACY_GATE_CALLS, isAccuracyUnlocked } from '$lib/constants/flow-rewards.constants';
	import { MIN_NICKNAME_LENGTH } from '$lib/constants/profile.constants';
	import { upsertProfile } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import type { UserProfile } from '$lib/types/profile';
	import { formatCurrency } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { stageForStreak, FLAME_STAGE_LABELS } from '$lib/utils/streak.utils';

	interface Props {
		profile: UserProfile;
		viewerPrincipal?: string;
	}

	const { profile, viewerPrincipal }: Props = $props();

	let isEditingNickname = $state(false);
	let editedNickname = $state('');
	let pending = $state(false);

	const handleSaveNickname = async () => {
		if (editedNickname.trim().length < MIN_NICKNAME_LENGTH) {
			return;
		}

		pending = true;

		try {
			const updatedData = {
				...profile,
				nickname: editedNickname.trim()
			};

			await upsertProfile({
				key: profile.owner,
				data: updatedData
			});

			userStore.update((curr) => ({
				...curr,
				profile: updatedData
			}));

			isEditingNickname = false;
		} finally {
			pending = false;
		}
	};

	const cancelEdit = () => {
		isEditingNickname = false;
	};

	const startNicknameEdit = () => {
		editedNickname = profile.nickname;
		isEditingNickname = true;
	};

	const accuracy = $derived(profile.accuracy ?? 0);
	// `profile.streak` is the trade-momentum streak (consecutive
	// winning trades) — distinct from `dailyStreak` (day count) which
	// drives the Flame stage. Surface only the day count here; the
	// trade-momentum streak isn't user-facing on this dashboard.
	const dailyStreak = $derived(profile.dailyStreak ?? 0);
	const level = $derived(profile.level ?? 1);
	const points = $derived(profile.points ?? 0);
	const xpInLevel = $derived(points % 500);
	// Progress (0–100) toward the next 500-point level bracket.
	const progressPercent = $derived(xpInLevel / 5);

	const flameStage = $derived(stageForStreak(dailyStreak));
	const flameLabel = $derived(FLAME_STAGE_LABELS[flameStage]);
	const archetype = $derived(profile.archetype ? ARCHETYPE_MAP.get(profile.archetype) : undefined);

	const totalTrades = $derived(profile.totalTrades ?? 0);
	const accuracyUnlocked = $derived(isAccuracyUnlocked(totalTrades));
	const callsUntilAccuracy = $derived(Math.max(0, ACCURACY_GATE_CALLS - totalTrades));

	const oracleInsight = $derived.by(() => {
		const trades = totalTrades;
		const acc = Math.round(accuracy);
		const d = dailyStreak;

		if (trades === 0) {
			return 'No calls yet. The Oracle waits.';
		}

		// Pre-gate: never reveal accuracy %. Calls + streak only.
		if (!accuracyUnlocked) {
			if (d >= 7) {
				return `${d}-day streak across ${trades} ${trades === 1 ? 'call' : 'calls'}. Consistency compounds.`;
			}

			return `${trades} ${trades === 1 ? 'call' : 'calls'} logged. Accuracy unlocks at ${ACCURACY_GATE_CALLS}.`;
		}

		if (acc >= 80) {
			return `${acc}% accuracy across ${trades} calls. The Oracle approves.`;
		}

		if (d >= 7) {
			return `${d}-day streak and ${acc}% accuracy. Consistency compounds.`;
		}

		if (acc >= 60) {
			return `${acc}% accuracy over ${trades} calls. Above the crowd.`;
		}

		return `${trades} calls logged. ${acc}% hit rate. Room to sharpen.`;
	});

	const streakBlocks = $derived.by(() => {
		const activeBlocks = Math.min(dailyStreak, 30);

		return Array.from({ length: 30 }, (_, index) => index >= 30 - activeBlocks);
	});

	const achievementProgress = (achievementId: string) => {
		if (achievementId === 'first-blood') {
			return totalTrades > 0 ? 1 : 0;
		}

		if (achievementId === 'on-fire') {
			return Math.min((profile.streak ?? 0) / 10, 1);
		}

		if (achievementId === 'oracle') {
			return Math.min(totalTrades / 50, accuracyUnlocked && accuracy >= 80 ? 1 : 0.8);
		}

		if (achievementId === 'marathon') {
			return Math.min(dailyStreak / 30, 1);
		}

		if (achievementId === 'lvl-25') {
			return Math.min(level / 25, 1);
		}

		return 0;
	};

	const achievementUnlocked = (achievementId: string) => {
		if (achievementId === 'first-blood') {
			return totalTrades > 0;
		}

		if (achievementId === 'on-fire') {
			return (profile.streak ?? 0) >= 10;
		}

		if (achievementId === 'oracle') {
			return accuracyUnlocked && accuracy >= 80 && totalTrades >= 50;
		}

		if (achievementId === 'marathon') {
			return dailyStreak >= 30;
		}

		if (achievementId === 'lvl-25') {
			return level >= 25;
		}

		return false;
	};
</script>

<div class="space-y-6">
	<section
		style="--profile-accent: {archetype?.accent ?? 'var(--primary)'}"
		class="border-border bg-card shadow-card relative overflow-hidden rounded-[2rem] border p-5 md:p-8"
	>
		<div
			style="background: var(--profile-accent)"
			class="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full opacity-20 blur-3xl"
		></div>

		<div class="relative grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-end">
			<div class="flex flex-col gap-5 sm:flex-row sm:items-center">
				<div class="relative w-fit">
					<div
						class="border-border bg-background/60 ring-primary/10 h-24 w-24 rounded-full border-4 p-1 shadow-xl ring-4 sm:h-28 sm:w-28"
					>
						<Avatar
							class="bg-card h-full w-full shadow-inner"
							avatar={profile.avatar}
							nickname={profile.nickname}
							owner={profile.owner}
						/>
					</div>
					<div
						class="bg-primary text-primary-foreground ring-background absolute -right-2 -bottom-2 flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm font-black shadow-lg ring-4"
						aria-label={t({
							locale: $localeStore,
							key: 'profile.dashboard.level_badge',
							params: { level }
						})}
					>
						{level}
					</div>
				</div>

				<div class="min-w-0 flex-1">
					{#if archetype}
						<div
							style="border-color: {archetype.accent}40; border-left: 2px solid {archetype.accent}"
							class="bg-background/35 mb-3 inline-flex items-center gap-2 rounded-sm border px-2.5 py-1"
						>
							<span
								style="color: {archetype.accent}"
								class="text-[10px] font-bold tracking-widest uppercase"
							>
								{archetype.tag}
							</span>
						</div>
					{/if}

					{#if isEditingNickname}
						<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
							<input
								class="bg-foreground/5 border-border focus:ring-primary rounded-xl border px-3 py-2 text-2xl font-black focus:ring-2 focus:outline-none"
								aria-label={t({ locale: $localeStore, key: 'profile.dashboard.nickname_label' })}
								disabled={pending}
								onkeydown={(e) => e.key === 'Enter' && handleSaveNickname()}
								type="text"
								bind:value={editedNickname}
							/>
							<div class="flex gap-2">
								<BaseButton
									class="text-yes hover:text-yes"
									aria-label={t({ locale: $localeStore, key: 'profile.dashboard.save' })}
									onclick={handleSaveNickname}
									status={pending
										? 'pending'
										: editedNickname.trim().length < MIN_NICKNAME_LENGTH
											? 'disabled'
											: 'enabled'}
								>
									<Check size={22} />
								</BaseButton>
								<BaseButton
									class="text-destructive hover:text-destructive"
									aria-label={t({ locale: $localeStore, key: 'profile.dashboard.cancel' })}
									onclick={cancelEdit}
									status={pending ? 'disabled' : 'enabled'}
								>
									<X size={22} />
								</BaseButton>
							</div>
						</div>
						{#if editedNickname.trim().length < MIN_NICKNAME_LENGTH}
							<p class="text-destructive mt-1 text-[10px] font-bold uppercase">
								{t({
									locale: $localeStore,
									key: 'profile.dashboard.nickname_min',
									params: { count: MIN_NICKNAME_LENGTH }
								})}
							</p>
						{/if}
					{:else}
						<h1
							class="font-display text-foreground flex min-w-0 items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl"
						>
							<span class="truncate">@{profile.nickname}</span>
							{#if viewerPrincipal === profile.owner}
								<button
									class="text-muted-foreground hover:text-primary shrink-0 transition-colors"
									aria-label={t({ locale: $localeStore, key: 'profile.dashboard.edit_nickname' })}
									onclick={startNicknameEdit}
								>
									<Pencil size={20} />
								</button>
							{/if}
						</h1>
					{/if}

					<div class="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
						<CopyableAddress
							address={profile.owner}
							label={t({ locale: $localeStore, key: 'profile.dashboard.principal' })}
						/>
					</div>

					<div class="mt-4 grid grid-cols-3 gap-2">
						<div class="border-border bg-background/35 rounded-xl border px-3 py-2">
							<p class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
								{t({
									locale: $localeStore,
									key: 'profile.dashboard.level_badge',
									params: { level }
								})}
							</p>
							<p class="text-foreground mt-1 font-mono text-sm font-black tabular-nums">
								{level}
							</p>
						</div>
						<div class="border-border bg-background/35 rounded-xl border px-3 py-2">
							<p class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
								{t({ locale: $localeStore, key: 'profile.dashboard.calls' })}
							</p>
							<p class="text-foreground mt-1 font-mono text-sm font-black tabular-nums">
								{totalTrades}
							</p>
						</div>
						<div class="border-border bg-background/35 rounded-xl border px-3 py-2">
							<p class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
								{t({
									locale: $localeStore,
									key: 'profile.dashboard.streak_stage',
									params: { stage: flameLabel }
								})}
							</p>
							<p class="text-foreground mt-1 font-mono text-sm font-black tabular-nums">
								{dailyStreak}
							</p>
						</div>
					</div>
				</div>
			</div>

			<div class="border-border bg-background/45 space-y-3 rounded-2xl border p-4 sm:p-5">
				<div class="flex items-center justify-between gap-3">
					<span class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
						{t({
							locale: $localeStore,
							key: 'profile.dashboard.level_progress',
							params: { level }
						})}
					</span>
					<span class="text-primary font-mono text-xs font-black tabular-nums">
						{xpInLevel} / 500 XP
					</span>
				</div>
				<div class="bg-card h-3 w-full overflow-hidden rounded-full p-1 shadow-inner">
					<div
						style="width: {progressPercent}%"
						class="bg-primary h-full rounded-full transition-all duration-1000 ease-out"
					></div>
				</div>
				<p class="text-muted-foreground text-xs">
					{t({
						locale: $localeStore,
						key: 'profile.dashboard.total_xp',
						params: { xp: points }
					})}
				</p>
			</div>
		</div>
	</section>

	<section class="grid grid-cols-1 gap-3 md:grid-cols-4">
		<div
			class="border-primary/20 bg-primary/10 text-foreground rounded-2xl border p-5 md:col-span-2"
		>
			{#if accuracyUnlocked}
				<span class="text-primary text-xs font-bold tracking-widest uppercase">
					{t({ locale: $localeStore, key: 'profile.dashboard.accuracy' })}
				</span>
				<div class="mt-5 flex items-baseline gap-2">
					<span class="font-mono text-5xl font-black tabular-nums">
						{Math.round(accuracy)}%
					</span>
					<span class="text-muted-foreground">
						{t({ locale: $localeStore, key: 'profile.dashboard.win_rate' })}
					</span>
				</div>
				<div class="mt-6 flex items-center gap-3">
					<div class="bg-card h-2 flex-1 overflow-hidden rounded-full">
						<div style="width: {accuracy}%" class="bg-yes h-full"></div>
					</div>
					<span class="text-primary text-[10px] font-bold tracking-widest uppercase">
						{t({ locale: $localeStore, key: 'profile.dashboard.pro_level' })}
					</span>
				</div>
			{:else}
				<!-- Pre-gate state: accuracy is hidden until the user has
				     `ACCURACY_GATE_CALLS` lifetime calls. Calls + streak
				     are the visible stats until then. See
				     `docs/ai/frontend/design.md` §7.5 for the rule. -->
				<span class="text-primary text-xs font-bold tracking-widest uppercase">
					{t({ locale: $localeStore, key: 'profile.dashboard.calls_logged' })}
				</span>
				<div class="mt-5 flex items-baseline gap-2">
					<span class="font-mono text-5xl font-black tabular-nums">{totalTrades}</span>
					<span class="text-muted-foreground">
						{t({ locale: $localeStore, key: 'profile.dashboard.calls' })}
					</span>
				</div>
				<div class="mt-6 flex items-center gap-3">
					<div class="bg-card h-2 flex-1 overflow-hidden rounded-full">
						<div
							style="width: {(totalTrades / ACCURACY_GATE_CALLS) * 100}%"
							class="bg-primary h-full"
						></div>
					</div>
					<span class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
						{t({
							locale: $localeStore,
							key: 'profile.dashboard.until_accuracy',
							params: { count: callsUntilAccuracy }
						})}
					</span>
				</div>
			{/if}
		</div>

		<div class="border-border bg-card rounded-2xl border p-5">
			<span class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
				{t({ locale: $localeStore, key: 'profile.dashboard.total_profit' })}
			</span>
			<p class="text-foreground mt-4 font-mono text-2xl font-black tabular-nums">
				{formatCurrency({ value: BigInt(Math.floor((profile.pnl ?? 0) * 1e6)), decimals: 6 })}
			</p>
		</div>

		<div class="border-border bg-card rounded-2xl border p-5">
			<span class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
				{t({ locale: $localeStore, key: 'profile.dashboard.predictions' })}
			</span>
			<p class="text-foreground mt-4 font-mono text-2xl font-black tabular-nums">
				{totalTrades}
			</p>
		</div>
	</section>

	{#if archetype}
		<section class="border-border bg-card shadow-card rounded-2xl border p-5">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p
						style="color: {archetype.accent}"
						class="text-[10px] font-black tracking-[0.16em] uppercase"
					>
						{archetype.tag}
					</p>
					<h3 class="text-foreground mt-1 text-lg font-semibold tracking-tight">
						{archetype.name}
					</h3>
				</div>
				<p class="text-muted-foreground max-w-xl text-sm leading-relaxed">
					{archetype.description}
				</p>
			</div>
		</section>
	{/if}

	<section class="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
		<div
			class="border-border bg-card shadow-card flex flex-col items-center justify-center gap-4 rounded-2xl border p-6"
		>
			<div class="char-pop">
				<FlameChar size={88} stage={flameStage} />
			</div>
			<div class="text-center">
				<div class="text-foreground font-mono text-4xl font-black tabular-nums">
					{dailyStreak}
				</div>
				<p class="text-muted-foreground text-xs font-bold uppercase">
					{t({
						locale: $localeStore,
						key: 'profile.dashboard.streak_stage',
						params: { stage: flameLabel }
					})}
				</p>
			</div>
		</div>

		<div class="border-border bg-card shadow-card rounded-2xl border p-5">
			<div class="mb-4 flex items-center justify-between gap-3">
				<div>
					<h3 class="text-foreground text-sm font-bold tracking-widest uppercase">
						{t({ locale: $localeStore, key: 'profile.dashboard.recent_activity' })}
					</h3>
					<p class="text-muted-foreground mt-1 text-xs">
						{t({ locale: $localeStore, key: 'profile.dashboard.recent_activity_sub' })}
					</p>
				</div>
				<div class="flex items-center gap-1.5">
					<FlameChar animate={false} size={18} stage={flameStage} />
					<span class="text-foreground font-mono text-lg font-black tabular-nums">
						{dailyStreak}
					</span>
				</div>
			</div>
			<div class="grid grid-cols-10 gap-1.5 sm:grid-cols-[repeat(15,minmax(0,1fr))] sm:gap-2">
				{#each streakBlocks as isActive, index (`streak-${index}`)}
					<div
						class={[
							'aspect-square rounded-[0.35rem] border transition-colors',
							isActive
								? 'border-primary/30 bg-primary/70 shadow-card'
								: 'border-border bg-foreground/5'
						]}
					></div>
				{/each}
			</div>
		</div>
	</section>

	<div class="border-border bg-card shadow-card flex items-center gap-4 rounded-2xl border p-5">
		<div class="flex-none">
			<OracleChar size={48} />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span style="color: var(--char-oracle)" class="eyebrow">
					{t({ locale: $localeStore, key: 'profile.dashboard.oracle_insight' })}
				</span>
			</div>
			<p class="text-foreground mt-1 text-sm leading-relaxed">{oracleInsight}</p>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.7fr]">
		<Card padding="lg">
			<h4 class="text-muted-foreground mb-4 text-xs font-bold tracking-widest uppercase">
				{t({ locale: $localeStore, key: 'profile.dashboard.achievements' })}
			</h4>
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				{#each ACHIEVEMENTS as achievement (achievement.id)}
					<AchievementCard
						{achievement}
						progress={achievementProgress(achievement.id)}
						unlocked={achievementUnlocked(achievement.id)}
					/>
				{/each}
			</div>
		</Card>

		<Card padding="lg">
			<h4 class="text-muted-foreground mb-4 text-xs font-bold tracking-widest uppercase">
				{t({ locale: $localeStore, key: 'profile.dashboard.interests' })}
			</h4>
			{#if (profile.interests ?? []).length > 0}
				<div class="flex flex-wrap gap-2">
					{#each profile.interests ?? [] as interest (interest)}
						<span
							class="bg-foreground/5 text-foreground rounded-sm px-3 py-1 text-[10px] font-bold uppercase"
						>
							{interest}
						</span>
					{/each}
				</div>
			{:else}
				<p class="text-muted-foreground text-sm">
					{t({ locale: $localeStore, key: 'profile.dashboard.no_interests' })}
				</p>
			{/if}
		</Card>
	</div>
</div>
