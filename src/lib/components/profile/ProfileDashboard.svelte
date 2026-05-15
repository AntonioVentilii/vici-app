<script lang="ts">
	import { Pencil, Check, X } from 'lucide-svelte';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import AchievementCard from '$lib/components/profile/AchievementCard.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CopyableAddress from '$lib/components/ui/CopyableAddress.svelte';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import { ACHIEVEMENTS } from '$lib/constants/achievements.constants';
	import { ARCHETYPE_MAP } from '$lib/constants/archetypes.constants';
	import { upsertProfile } from '$lib/services/profile.services';
	import { userStore } from '$lib/stores/user.store';
	import type { UserProfile } from '$lib/types/profile';
	import { formatCurrency } from '$lib/utils/format.utils';
	import { stageForStreak, FLAME_STAGE_LABELS } from '$lib/utils/streak.utils';

	interface Props {
		profile: UserProfile;
		viewerPrincipal?: string;
	}

	const { profile, viewerPrincipal }: Props = $props();

	let isEditingNickname = $state(false);
	let editedNickname = $state('');
	let pending = $state(false);

	// Sync editedNickname with profile.nickname when not editing to avoid stale values
	// and fix the Svelte warning about capturing initial value.
	$effect(() => {
		if (!isEditingNickname) {
			editedNickname = profile.nickname;
		}
	});

	const handleSaveNickname = async () => {
		if (editedNickname.trim().length < 2) {
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

			// Update global store
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

	// Calculate display values
	const accuracy = $derived(profile.accuracy ?? 0);
	const streak = $derived(profile.streak ?? 0);
	const level = $derived(profile.level ?? 1);
	const points = $derived(profile.points ?? 0);
	const progressPercent = $derived((points % 500) / 5); // 0-100

	const flameStage = $derived(stageForStreak(streak));
	const flameLabel = $derived(FLAME_STAGE_LABELS[flameStage]);
	const archetype = $derived(profile.archetype ? ARCHETYPE_MAP.get(profile.archetype) : undefined);
</script>

<div class="space-y-8">
	<!-- Top Level Identity Section -->
	<div class="flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
		<div class="flex flex-col items-center gap-6 sm:flex-row">
			<div class="relative">
				<div
					class="border-border ring-primary/10 h-28 w-28 rounded-full border-4 p-1 shadow-xl ring-4"
				>
					<Avatar
						class="h-full w-full bg-[var(--bg-surface)] shadow-inner"
						avatar={profile.avatar}
						nickname={profile.nickname}
						owner={profile.owner}
					/>
				</div>
				<div
					class="bg-primary text-primary-foreground ring-background absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-full font-mono font-bold shadow-lg ring-4"
				>
					{level}
				</div>
			</div>

			<div class="text-center sm:text-left">
				{#if archetype}
					<div
						style="border-color: {archetype.accent}40; border-left: 2px solid {archetype.accent}"
						class="mb-2 inline-flex items-center gap-2 rounded-[4px] border px-2.5 py-1"
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
					<div class="flex items-center gap-2">
						<input
							class="bg-foreground/5 border-border focus:ring-primary rounded-[12px] border px-3 py-1 text-2xl font-black focus:ring-2 focus:outline-none"
							disabled={pending}
							onkeydown={(e) => e.key === 'Enter' && handleSaveNickname()}
							type="text"
							bind:value={editedNickname}
						/>
						<BaseButton
							class="cursor-pointer text-[var(--yes)] hover:text-[var(--yes)]"
							aria-label="Save"
							onclick={handleSaveNickname}
							status={pending
								? 'pending'
								: editedNickname.trim().length < 2
									? 'disabled'
									: 'enabled'}
						>
							<Check size={24} />
						</BaseButton>
						<BaseButton
							class="text-destructive hover:text-destructive cursor-pointer"
							aria-label="Cancel"
							onclick={cancelEdit}
							status={pending ? 'disabled' : 'enabled'}
						>
							<X size={24} />
						</BaseButton>
					</div>
					{#if editedNickname.trim().length < 2}
						<p class="text-destructive mt-1 text-[10px] font-bold uppercase">Min 2 characters</p>
					{/if}
				{:else}
					<h1
						class="font-display text-foreground flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl"
					>
						{profile.nickname}
						{#if viewerPrincipal === profile.owner}
							<button
								class="text-muted-foreground hover:text-primary cursor-pointer transition-colors"
								aria-label="Edit Nickname"
								onclick={() => (isEditingNickname = true)}
							>
								<Pencil size={20} />
							</button>
						{/if}
					</h1>
				{/if}
				<div class="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
					<CopyableAddress address={profile.owner} label="Principal ID" />
				</div>
			</div>
		</div>

		<!-- Level Progress Card (Duolingo Style) -->
		<div class="border-border bg-card w-full max-w-xs space-y-3 rounded-2xl border p-5">
			<div class="flex items-center justify-between">
				<span class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
					Level {level} Progress
				</span>
				<span class="text-primary font-mono text-xs font-black tabular-nums"
					>{points % 500} / 500 XP</span
				>
			</div>
			<div class="h-4 w-full overflow-hidden rounded-full bg-[var(--bg-surface)] p-1 shadow-inner">
				<div
					style="width: {progressPercent}%"
					class="bg-primary h-full rounded-full transition-all duration-1000 ease-out"
				></div>
			</div>
		</div>
	</div>

	<!-- Stats Dashboard Grid -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
		<!-- Accuracy Gauge (Big Metric) -->
		<div
			class="border-primary/20 bg-primary/10 text-foreground flex h-full flex-col justify-between rounded-2xl border p-8"
		>
			<div>
				<span class="text-primary text-xs font-bold tracking-widest uppercase">
					Prediction Accuracy
				</span>
				<div class="mt-6 flex items-baseline gap-2">
					<span class="font-mono text-6xl font-black tabular-nums">{Math.round(accuracy)}%</span>
					<span class="text-muted-foreground">win rate</span>
				</div>
			</div>
			<div class="mt-8 flex items-center gap-3">
				<div class="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-surface)]">
					<div style="width: {accuracy}%" class="h-full bg-[var(--yes)]"></div>
				</div>
				<span class="text-primary text-[10px] font-bold">PRO LEVEL</span>
			</div>
		</div>

		<!-- PnL & Stats Side-Grid -->
		<div class="grid grid-cols-1 gap-6">
			<StatCard
				label="Total Profit"
				size="lg"
				value={formatCurrency({ value: BigInt(Math.floor((profile.pnl ?? 0) * 1e6)), decimals: 6 })}
				variant="success"
			/>
			<StatCard label="Total Predictions" size="lg" value={profile.totalTrades ?? 0} />
		</div>

		<!-- Gamification Side-Grid -->
		<div class="grid grid-cols-1 gap-6">
			<!-- Streak with Flame Character -->
			<div
				class="border-border bg-card hover:border-primary/20 flex flex-col items-center justify-center gap-4 rounded-2xl border p-6 transition-all"
			>
				<div class="char-pop">
					<FlameChar size={80} stage={flameStage} />
				</div>
				<div class="text-center">
					<div class="text-foreground font-mono text-3xl font-black tabular-nums">
						{streak}
					</div>
					<p class="text-muted-foreground text-xs font-bold uppercase">
						Day streak · {flameLabel}
					</p>
				</div>
			</div>

			<!-- Daily Activity Sub-Stat -->
			<div class="flex items-center justify-between rounded-2xl bg-[var(--bg-surface)] px-5 py-3">
				<span class="text-muted-foreground text-[10px] font-bold uppercase">Daily streak</span>
				<div class="flex items-center gap-1.5">
					<FlameChar animate={false} size={18} stage={flameStage} />
					<span class="text-foreground font-mono text-lg font-black tabular-nums">
						{profile.dailyStreak ?? 1}
					</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Activity / Badges Placeholder -->
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<Card padding="lg">
			<h4 class="text-muted-foreground mb-4 text-xs font-bold tracking-widest uppercase">
				Achievements
			</h4>
			<div class="space-y-3">
				{#each ACHIEVEMENTS as achievement (achievement.id)}
					<AchievementCard
						{achievement}
						progress={achievement.id === 'first-blood'
							? (profile.totalTrades ?? 0) > 0
								? 1
								: 0
							: 0}
						unlocked={achievement.id === 'first-blood' && (profile.totalTrades ?? 0) > 0}
					/>
				{/each}
			</div>
		</Card>

		<Card padding="lg">
			<h4 class="text-muted-foreground mb-4 text-xs font-bold tracking-widest uppercase">
				Interests
			</h4>
			<div class="flex flex-wrap gap-2">
				{#each profile.interests ?? [] as interest (interest)}
					<span
						class="bg-foreground/5 text-foreground rounded-[4px] px-3 py-1 text-[10px] font-bold uppercase"
					>
						{interest}
					</span>
				{/each}
			</div>
		</Card>
	</div>
</div>
