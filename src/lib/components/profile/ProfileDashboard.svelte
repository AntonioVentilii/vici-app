<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { Pencil, Check, X } from 'lucide-svelte';
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
					class="h-28 w-28 rounded-full border-4 border-white p-1 shadow-xl ring-4 ring-indigo-50"
				>
					<div
						class="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-100 shadow-inner"
					>
						{#if nonNullish(profile.avatar)}
							<img class="h-full w-full object-cover" alt={profile.nickname} src={profile.avatar} />
						{:else}
							<span class="text-4xl font-black text-slate-300">{profile.nickname[0]}</span>
						{/if}
					</div>
				</div>
				<div
					class="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 font-bold text-white shadow-lg ring-4 ring-white"
				>
					{level}
				</div>
			</div>

			<div class="text-center sm:text-left">
				{#if isEditingNickname}
					<div class="flex items-center gap-2">
						<input
							class="bg-foreground/5 border-border rounded-lg border px-3 py-1 text-2xl font-black focus:ring-2 focus:ring-indigo-500 focus:outline-none"
							disabled={pending}
							onkeydown={(e) => e.key === 'Enter' && handleSaveNickname()}
							type="text"
							bind:value={editedNickname}
						/>
						<button
							class="cursor-pointer text-emerald-500 hover:text-emerald-600 disabled:opacity-50"
							aria-label="Save"
							disabled={pending || editedNickname.trim().length < 2}
							onclick={handleSaveNickname}
						>
							<Check size={24} />
						</button>
						<button
							class="cursor-pointer text-red-500 hover:text-red-600 disabled:opacity-50"
							aria-label="Cancel"
							disabled={pending}
							onclick={cancelEdit}
						>
							<X size={24} />
						</button>
					</div>
					{#if editedNickname.trim().length < 2}
						<p class="mt-1 text-[10px] font-bold text-red-500 uppercase">Min 2 characters</p>
					{/if}
				{:else}
					<h1
						class="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl"
					>
						{profile.nickname}
						{#if viewerPrincipal === profile.owner}
							<button
								class="text-muted-foreground cursor-pointer transition-colors hover:text-indigo-600"
								aria-label="Edit Nickname"
								onclick={() => (isEditingNickname = true)}
							>
								<Pencil size={20} />
							</button>
						{/if}
					</h1>
				{/if}
				<p class="mt-1 text-sm font-medium text-slate-500">
					{profile.owner}
				</p>
				<div class="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
					<CopyableAddress address={profile.owner} label="Principal ID" />
				</div>
			</div>
		</div>

		<!-- Level Progress Card (Duolingo Style) -->
		<div class="w-full max-w-xs space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
			<div class="flex items-center justify-between">
				<span class="text-xs font-bold tracking-widest text-slate-400 uppercase">
					Level {level} Progress
				</span>
				<span class="text-xs font-black text-indigo-600">{points % 500} / 500 XP</span>
			</div>
			<div class="h-4 w-full overflow-hidden rounded-full bg-slate-100 p-1 shadow-inner">
				<div
					style="width: {progressPercent}%"
					class="h-full rounded-full bg-indigo-500 transition-all duration-1000 ease-out"
				></div>
			</div>
		</div>
	</div>

	<!-- Stats Dashboard Grid -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
		<!-- Accuracy Gauge (Big Metric) -->
		<div
			class="flex h-full flex-col justify-between rounded-3xl bg-indigo-600 p-8 text-white shadow-xl shadow-indigo-100"
		>
			<div>
				<span class="text-xs font-bold tracking-widest text-indigo-100 uppercase">
					Prediction Accuracy
				</span>
				<div class="mt-6 flex items-baseline gap-2">
					<span class="text-6xl font-black">{Math.round(accuracy)}%</span>
					<span class="text-indigo-200">win rate</span>
				</div>
			</div>
			<div class="mt-8 flex items-center gap-3">
				<div class="h-2 flex-1 overflow-hidden rounded-full bg-indigo-800">
					<div style="width: {accuracy}%" class="h-full bg-emerald-400"></div>
				</div>
				<span class="text-[10px] font-bold text-indigo-200">PRO LEVEL</span>
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
				class="flex flex-col items-center justify-center gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md"
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
					<div class="text-3xl font-black text-slate-950">
						{profile.dailyStreak ?? 1} Day Streak
					</div>
					<p class="text-xs font-bold text-slate-400 uppercase">Daily Activity</p>
				</div>
			</div>

			<!-- Success Streak Sub-Stat -->
			<div class="flex items-center justify-between rounded-2xl bg-slate-50 px-5 py-3 shadow-inner">
				<span class="text-[10px] font-bold text-slate-400 uppercase">Success Streak</span>
				<div class="flex items-center gap-1">
					<span class="text-lg font-black text-slate-950">{streak}</span>
					<span class="text-xs">🏆</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Activity / Badges Placeholder -->
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<Card padding="lg">
			<h4 class="mb-6 text-xs font-bold tracking-widest text-slate-400 uppercase">Achievements</h4>
			<div class="flex flex-wrap gap-4 py-4">
				{#each Array(4) as _, i (i)}
					<div
						class="flex h-16 w-16 cursor-help items-center justify-center rounded-2xl bg-slate-50 opacity-40 grayscale transition-all hover:scale-110 hover:opacity-100 hover:grayscale-0"
						title="Locked Achievement"
					>
						<span class="text-2xl">🏆</span>
					</div>
				{/each}
				<div
					class="flex h-16 w-16 animate-bounce items-center justify-center rounded-2xl border-2 border-indigo-200 bg-indigo-50 text-2xl shadow-sm"
					title="Early Adopter"
				>
					🚀
				</div>
			</div>
		</Card>

		<Card padding="lg">
			<h4 class="mb-4 text-xs font-bold tracking-widest text-slate-400 uppercase">Interests</h4>
			<div class="flex flex-wrap gap-2">
				{#each profile.interests ?? [] as interest (interest)}
					<span
						class="rounded-lg bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600 uppercase"
					>
						{interest}
					</span>
				{/each}
			</div>
		</Card>
	</div>
</div>
