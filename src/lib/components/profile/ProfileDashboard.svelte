<script lang="ts">
	import { Pencil, Check, X } from 'lucide-svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CopyableAddress from '$lib/components/ui/CopyableAddress.svelte';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import { upsertProfile } from '$lib/services/profile.services';
	import { userStore } from '$lib/stores/user.store';
	import type { UserProfile } from '$lib/types/profile';
	import { formatCurrency } from '$lib/utils/format.utils';

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

	// Dynamic flame color based on streak
	const flameColor = $derived(
		streak >= 10
			? 'from-purple-500 to-pink-500'
			: streak >= 5
				? 'from-orange-500 to-red-600'
				: 'from-amber-400 to-orange-500'
	);
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
				{#if isEditingNickname}
					<div class="flex items-center gap-2">
						<input
							class="bg-foreground/5 border-border focus:ring-primary rounded-lg border px-3 py-1 text-2xl font-black focus:ring-2 focus:outline-none"
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
		<div class="border-border bg-card w-full max-w-xs space-y-3 rounded-lg border p-5">
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
			class="border-primary/20 bg-primary/10 text-foreground flex h-full flex-col justify-between rounded-lg border p-8"
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
			<!-- Daily Fire Streak (Duolingo Style) -->
			<div
				class="border-border bg-card hover:border-primary/20 flex flex-col items-center justify-center gap-4 rounded-lg border p-6 transition-all"
			>
				<div class="relative">
					<div
						class="absolute -inset-4 rounded-full bg-gradient-to-tr {flameColor} opacity-20 blur-xl"
					></div>
					<div
						class="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr {flameColor} text-4xl shadow-lg"
					>
						🔥
					</div>
				</div>
				<div class="text-center">
					<div class="text-foreground text-3xl font-black">
						{profile.dailyStreak ?? 1} Day Streak
					</div>
					<p class="text-muted-foreground text-xs font-bold uppercase">Daily Activity</p>
				</div>
			</div>

			<!-- Success Streak Sub-Stat -->
			<div class="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-5 py-3">
				<span class="text-muted-foreground text-[10px] font-bold uppercase">Success Streak</span>
				<div class="flex items-center gap-1">
					<span class="text-foreground font-mono text-lg font-black">{streak}</span>
					<span class="text-xs">🏆</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Activity / Badges Placeholder -->
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<Card padding="lg">
			<h4 class="text-muted-foreground mb-6 text-xs font-bold tracking-widest uppercase">
				Achievements
			</h4>
			<div class="flex flex-wrap gap-4 py-4">
				{#each Array(4) as _, i (i)}
					<div
						class="bg-foreground/5 flex h-16 w-16 cursor-help items-center justify-center rounded-2xl opacity-40 grayscale transition-all hover:scale-110 hover:opacity-100 hover:grayscale-0"
						title="Locked Achievement"
					>
						<span class="text-2xl">🏆</span>
					</div>
				{/each}
				<div
					class="border-primary/30 bg-primary/10 flex h-16 w-16 animate-bounce items-center justify-center rounded-2xl border-2 text-2xl"
					title="Early Adopter"
				>
					🚀
				</div>
			</div>
		</Card>

		<Card padding="lg">
			<h4 class="text-muted-foreground mb-4 text-xs font-bold tracking-widest uppercase">
				Interests
			</h4>
			<div class="flex flex-wrap gap-2">
				{#each profile.interests ?? [] as interest (interest)}
					<span
						class="bg-foreground/5 text-foreground rounded-lg px-3 py-1 text-[10px] font-bold uppercase"
					>
						{interest}
					</span>
				{/each}
			</div>
		</Card>
	</div>
</div>
