<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import type { RegistryDid } from '$declarations';
	import Button from '$lib/components/ui/Button.svelte';
	import { listGroups } from '$lib/services/group.services';
	import { createMarket } from '$lib/services/market.services';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { ButtonStatus } from '$lib/types/components';

	interface Props {
		onAddMarketSuccess: () => Promise<void>;
	}

	const { onAddMarketSuccess }: Props = $props();

	let status = $state<ButtonStatus>('enabled');

	let title = $state('');
	let description = $state('');
	let expiryDate = $state('');

	let marketType = $state<'Binary' | 'Categorical'>('Binary');
	let outcomes = $state<string[]>(['Option A', 'Option B']);
	let socialRewardTitle = $state('');
	let socialRewardDescription = $state('');

	let selectedDomain = $state<'ViciXp' | 'Social'>('ViciXp');

	let isRestricted = $state(false);
	let availableGroups = $state<RegistryDid.Group[]>([]);
	let selectedGroupIds = $state<string[]>([]);

	onMount(async () => {
		try {
			availableGroups = await listGroups();
		} catch {
			// Groups API may not be available yet
		}
	});

	const addOutcome = () => {
		outcomes = [...outcomes, `Option ${String.fromCharCode(65 + outcomes.length)}`];
	};

	const removeOutcome = (index: number) => {
		if (outcomes.length > 2) {
			outcomes = outcomes.filter((_, i) => i !== index);
		}
	};

	const onCreate = async () => {
		if (isNullish(title) || isNullish(description) || isNullish(expiryDate)) {
			return;
		}

		status = 'pending';

		const tradingAccess: RegistryDid.TradingAccess[] =
			isRestricted && selectedGroupIds.length > 0
				? [{ Restricted: { groups: selectedGroupIds } }]
				: [{ Open: null }];

		const domain: RegistryDid.BalanceDomain =
			selectedDomain === 'Social' ? { Social: null } : { ViciXp: null };

		try {
			await createMarket({
				title,
				description,
				expiryDate: BigInt(new Date(expiryDate).getTime()),
				outcomes: marketType === 'Categorical' ? outcomes : [],
				balanceDomain: domain,
				socialReward:
					selectedDomain === 'Social'
						? {
								title: socialRewardTitle,
								description: socialRewardDescription
							}
						: undefined,
				tradingAccess
			});

			title = '';
			description = '';
			expiryDate = '';
			outcomes = ['Option A', 'Option B'];
			socialRewardTitle = '';
			socialRewardDescription = '';
			marketType = 'Binary';
			isRestricted = false;
			selectedGroupIds = [];

			await onAddMarketSuccess();

			notificationsStore.add({
				title: 'Success',
				message: 'Market created successfully!',
				type: 'success'
			});
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Error',
				message: (e as Error).message,
				type: 'error'
			});
		} finally {
			status = 'enabled';
		}
	};
</script>

<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
	<h2 class="mb-6 text-2xl font-bold text-slate-950">Create New Market</h2>
	<div class="space-y-6">
		<div class="space-y-2">
			<label class="text-xs font-bold tracking-widest text-slate-500 uppercase" for="market-title">
				Market Title
			</label>
			<input
				id="market-title"
				class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-600"
				oninput={(e) => (title = e.currentTarget.value)}
				placeholder="e.g., Will Bitcoin hit $100k by 2027?"
				type="text"
				value={title}
			/>
		</div>

		<div class="space-y-2">
			<label
				class="text-xs font-bold tracking-widest text-slate-500 uppercase"
				for="market-description"
			>
				Description
			</label>
			<textarea
				id="market-description"
				class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-600"
				oninput={(e) => (description = e.currentTarget.value)}
				placeholder="Provide detailed criteria for resolution..."
				rows="4"
				value={description}
			></textarea>
		</div>

		<div class="space-y-2">
			<label class="text-xs font-bold tracking-widest text-slate-500 uppercase" for="expiry-date">
				Expiry Date
			</label>
			<input
				id="expiry-date"
				class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-600"
				oninput={(e) => (expiryDate = e.currentTarget.value)}
				type="datetime-local"
				value={expiryDate}
			/>
		</div>

		<div class="space-y-4">
			<span class="text-xs font-bold tracking-widest text-slate-500 uppercase"> Market Type </span>
			<div class="flex gap-4">
				<button
					class="flex-1 rounded-2xl border-2 px-6 py-4 font-bold transition-all {marketType ===
					'Binary'
						? 'border-indigo-600 bg-indigo-50 text-indigo-700'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (marketType = 'Binary')}
					type="button"
				>
					Binary (Yes/No)
				</button>
				<button
					class="flex-1 rounded-2xl border-2 px-6 py-4 font-bold transition-all {marketType ===
					'Categorical'
						? 'border-indigo-600 bg-indigo-50 text-indigo-700'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (marketType = 'Categorical')}
					type="button"
				>
					Categorical (Multi)
				</button>
			</div>
		</div>

		{#if marketType === 'Categorical'}
			<div class="space-y-4 rounded-3xl bg-slate-50 p-6">
				<div class="flex items-center justify-between">
					<span class="text-xs font-bold tracking-widest text-slate-500 uppercase"> Outcomes </span>
					<button
						class="text-xs font-bold text-indigo-600 hover:text-indigo-700"
						onclick={addOutcome}
						type="button"
					>
						+ Add Outcome
					</button>
				</div>
				<div class="space-y-3">
					{#each outcomes as outcome, i (i)}
						<div class="flex gap-2">
							<input
								class="flex-1 rounded-xl border-none bg-white px-4 py-3 text-sm text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-600"
								oninput={(e) => (outcomes[i] = e.currentTarget.value)}
								placeholder={`Outcome ${i + 1}`}
								type="text"
								value={outcome}
							/>
							{#if outcomes.length > 2}
								<button
									class="rounded-xl bg-white px-4 py-3 text-slate-400 ring-1 ring-slate-200 ring-inset hover:text-red-500"
									aria-label="Remove outcome"
									onclick={() => removeOutcome(i)}
									type="button"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											d="M6 18L18 6M6 6l12 12"
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
										/>
									</svg>
								</button>
							{/if}
						</div>
					{/each}
				</div>
				<p class="text-[10px] text-slate-400">
					Minimum 2 outcomes required. Each outcome will be tradable as a YES position.
				</p>
			</div>
		{/if}

		<!-- Balance Domain -->
		<div class="space-y-4">
			<span class="text-xs font-bold tracking-widest text-slate-500 uppercase">
				Balance Domain
			</span>
			<div class="flex gap-4">
				<button
					class="flex-1 rounded-2xl border-2 px-6 py-4 font-bold transition-all {selectedDomain ===
					'ViciXp'
						? 'border-indigo-600 bg-indigo-50 text-indigo-700'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (selectedDomain = 'ViciXp')}
					type="button"
				>
					ViciXp (Playground)
				</button>
				<button
					class="flex-1 rounded-2xl border-2 px-6 py-4 font-bold transition-all {selectedDomain ===
					'Social'
						? 'border-fuchsia-600 bg-fuchsia-50 text-fuchsia-700'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (selectedDomain = 'Social')}
					type="button"
				>
					Social (Fun Dare)
				</button>
			</div>
		</div>

		{#if selectedDomain === 'Social'}
			<div class="space-y-4 rounded-3xl bg-fuchsia-50 p-6 ring-1 ring-fuchsia-100 ring-inset">
				<span class="text-xs font-bold tracking-widest text-fuchsia-700 uppercase">
					Social Reward (Fun Dare)
				</span>
				<div class="space-y-4">
					<div class="space-y-2">
						<label class="text-[10px] font-bold text-fuchsia-600 uppercase" for="reward-title">
							Reward Title
						</label>
						<input
							id="reward-title"
							class="w-full rounded-xl border-none bg-white px-4 py-3 text-sm text-slate-950 ring-1 ring-fuchsia-200 ring-inset focus:ring-2 focus:ring-fuchsia-600"
							oninput={(e) => (socialRewardTitle = e.currentTarget.value)}
							placeholder="e.g., Pizza 🍕"
							type="text"
							value={socialRewardTitle}
						/>
					</div>
					<div class="space-y-2">
						<label class="text-[10px] font-bold text-fuchsia-600 uppercase" for="reward-desc">
							Reward Description
						</label>
						<textarea
							id="reward-desc"
							class="w-full rounded-xl border-none bg-white px-4 py-3 text-sm text-slate-950 ring-1 ring-fuchsia-200 ring-inset focus:ring-2 focus:ring-fuchsia-600"
							oninput={(e) => (socialRewardDescription = e.currentTarget.value)}
							placeholder="e.g., Winner gets a pizza of their choice."
							rows="2"
							value={socialRewardDescription}
						></textarea>
					</div>
				</div>
			</div>
		{/if}

		<!-- Trading Access -->
		<div class="space-y-4">
			<span class="text-xs font-bold tracking-widest text-slate-500 uppercase">
				Trading Access
			</span>
			<div class="flex gap-4">
				<button
					class="flex-1 rounded-2xl border-2 px-6 py-4 font-bold transition-all {!isRestricted
						? 'border-indigo-600 bg-indigo-50 text-indigo-700'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (isRestricted = false)}
					type="button"
				>
					Open to All
				</button>
				<button
					class="flex-1 rounded-2xl border-2 px-6 py-4 font-bold transition-all {isRestricted
						? 'border-amber-500 bg-amber-50 text-amber-700'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (isRestricted = true)}
					type="button"
				>
					Closed Circle
				</button>
			</div>
		</div>

		{#if isRestricted}
			<div class="space-y-3 rounded-3xl bg-amber-50/50 p-6">
				<span class="text-xs font-bold tracking-widest text-amber-700 uppercase">
					Restrict to Groups
				</span>
				{#if availableGroups.length === 0}
					<p class="text-sm text-amber-600 italic">
						No groups created yet. Create a group first to restrict market access.
					</p>
				{:else}
					<div class="space-y-2">
						{#each availableGroups as group (group.group_id)}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-amber-200 transition-colors ring-inset hover:bg-amber-50"
							>
								<input
									class="accent-amber-600"
									checked={selectedGroupIds.includes(group.group_id)}
									onchange={() => {
										if (selectedGroupIds.includes(group.group_id)) {
											selectedGroupIds = selectedGroupIds.filter((id) => id !== group.group_id);
										} else {
											selectedGroupIds = [...selectedGroupIds, group.group_id];
										}
									}}
									type="checkbox"
								/>
								<span class="text-sm font-semibold text-slate-800">{group.name}</span>
								<span class="ml-auto text-xs text-slate-400">
									{group.members.length} members
								</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<Button class="w-full" onclick={onCreate} size="lg" {status}>Deploy Market</Button>
	</div>
</div>
