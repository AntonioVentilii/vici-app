<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import type { RegistryDid } from '$declarations';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { listGroups } from '$lib/services/group.services';
	import { createMarket } from '$lib/services/market.services';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { ButtonStatus } from '$lib/types/components';
	import { refreshMarkets } from '$lib/utils/refresh.utils';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	const { isOpen, onClose }: Props = $props();

	let status = $state<ButtonStatus>('enabled');
	let title = $state('');
	let description = $state('');
	let expiryDate = $state('');
	let stakes = $state<'vxp' | 'bragging'>('bragging');
	let audience = $state<'public' | 'friends' | 'group'>('public');
	let availableGroups = $state<RegistryDid.Group[]>([]);
	let selectedGroupIds = $state<string[]>([]);

	onMount(async () => {
		try {
			availableGroups = await listGroups();
		} catch {
			// Groups API may not be available yet
		}
	});

	const reset = () => {
		title = '';
		description = '';
		expiryDate = '';
		stakes = 'bragging';
		audience = 'public';
		selectedGroupIds = [];
		status = 'enabled';
	};

	const close = () => {
		reset();
		onClose();
	};

	const onCreate = async () => {
		if (isNullish(title) || !title.trim()) {
			notificationsStore.add({
				title: 'Missing Title',
				message: 'Give your challenge a question or title.',
				type: 'warning'
			});

			return;
		}

		if (isNullish(expiryDate)) {
			notificationsStore.add({
				title: 'Missing Date',
				message: 'Set an expiry date for your challenge.',
				type: 'warning'
			});

			return;
		}

		status = 'pending';

		const domain: RegistryDid.BalanceDomain =
			stakes === 'vxp' ? { ViciXp: null } : { Social: null };

		const tradingAccess: RegistryDid.TradingAccess[] =
			audience === 'group' && selectedGroupIds.length > 0
				? [{ Restricted: { groups: selectedGroupIds } }]
				: [{ Open: null }];

		try {
			await createMarket({
				title,
				description: description || title,
				expiryDate: BigInt(new Date(expiryDate).getTime()),
				balanceDomain: domain,
				socialReward:
					stakes === 'bragging'
						? { title: 'Fun Dare', description: 'Loser pays the dare!' }
						: undefined,
				tradingAccess
			});

			notificationsStore.add({
				title: 'Challenge Created',
				message: 'Your challenge is live!',
				type: 'success'
			});

			refreshMarkets();
			close();
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Creation Failed',
				message: (e as Error).message,
				type: 'error'
			});
		} finally {
			status = 'enabled';
		}
	};
</script>

<Modal {isOpen} onClose={close}>
	<div class="space-y-6">
		<div>
			<h3 class="text-2xl font-black text-slate-950">Create a Challenge</h3>
			<p class="mt-1 text-sm text-slate-500">
				Ask a question and let your circle predict the answer.
			</p>
		</div>

		<!-- Question -->
		<div class="space-y-2">
			<label class="text-xs font-bold tracking-widest text-slate-500 uppercase" for="ch-title">
				What's the question?
			</label>
			<input
				id="ch-title"
				class="w-full rounded-2xl border-none bg-slate-50 px-5 py-4 text-lg font-bold text-slate-950 ring-1 ring-slate-200 ring-inset focus:bg-white focus:ring-2 focus:ring-fuchsia-500"
				placeholder="e.g., Will I quit smoking by June?"
				type="text"
				bind:value={title}
			/>
		</div>

		<!-- Description (optional) -->
		<div class="space-y-2">
			<label class="text-xs font-bold tracking-widest text-slate-500 uppercase" for="ch-desc">
				Details
				<span class="font-normal text-slate-400">(optional)</span>
			</label>
			<textarea
				id="ch-desc"
				class="w-full rounded-2xl border-none bg-slate-50 px-5 py-3 text-sm text-slate-950 ring-1 ring-slate-200 ring-inset focus:bg-white focus:ring-2 focus:ring-fuchsia-500"
				placeholder="Add context or resolution criteria..."
				rows="2"
				bind:value={description}
			></textarea>
		</div>

		<!-- Expiry -->
		<div class="space-y-2">
			<label class="text-xs font-bold tracking-widest text-slate-500 uppercase" for="ch-expiry">
				When does it expire?
			</label>
			<input
				id="ch-expiry"
				class="w-full rounded-2xl border-none bg-slate-50 px-5 py-4 text-slate-950 ring-1 ring-slate-200 ring-inset focus:bg-white focus:ring-2 focus:ring-fuchsia-500"
				type="datetime-local"
				bind:value={expiryDate}
			/>
		</div>

		<!-- Stakes -->
		<div class="space-y-3">
			<span class="text-xs font-bold tracking-widest text-slate-500 uppercase">Stakes</span>
			<div class="grid grid-cols-2 gap-3">
				<button
					class="rounded-2xl border-2 px-4 py-3 text-center font-bold transition-all {stakes ===
					'bragging'
						? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (stakes = 'bragging')}
					type="button"
				>
					<div class="text-sm">Fun Dare</div>
					<div class="text-[10px] font-normal opacity-70">Pizza, push-ups, beer...</div>
				</button>
				<button
					class="rounded-2xl border-2 px-4 py-3 text-center font-bold transition-all {stakes ===
					'vxp'
						? 'border-indigo-500 bg-indigo-50 text-indigo-700'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (stakes = 'vxp')}
					type="button"
				>
					<div class="text-sm">VXP Points</div>
					<div class="text-[10px] font-normal opacity-70">Playground stakes</div>
				</button>
			</div>
		</div>

		<!-- Audience -->
		<div class="space-y-3">
			<span class="text-xs font-bold tracking-widest text-slate-500 uppercase">Who can play?</span>
			<div class="grid grid-cols-3 gap-2">
				<button
					class="rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all {audience ===
					'public'
						? 'border-slate-900 bg-slate-900 text-white'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (audience = 'public')}
					type="button"
				>
					Public
				</button>
				<button
					class="rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all {audience ===
					'friends'
						? 'border-slate-900 bg-slate-900 text-white'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (audience = 'friends')}
					type="button"
				>
					Friends
				</button>
				<button
					class="rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all {audience ===
					'group'
						? 'border-slate-900 bg-slate-900 text-white'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (audience = 'group')}
					type="button"
				>
					Group
				</button>
			</div>
		</div>

		{#if audience === 'group'}
			<div class="space-y-2 rounded-2xl bg-slate-50 p-4">
				{#if availableGroups.length === 0}
					<p class="text-sm text-slate-500 italic">
						No groups yet. Create one from your Profile page first.
					</p>
				{:else}
					{#each availableGroups as group (group.group_id)}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200 transition-colors ring-inset hover:bg-slate-50"
						>
							<input
								class="accent-slate-900"
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
							<span class="ml-auto text-xs text-slate-400">{group.members.length}</span>
						</label>
					{/each}
				{/if}
			</div>
		{/if}

		<!-- Explainer -->
		<div class="rounded-2xl bg-gradient-to-br from-fuchsia-50 to-violet-50 p-4">
			<p class="text-xs leading-relaxed text-fuchsia-900/70">
				<strong>How it works:</strong> Your challenge appears in the markets feed.
				{#if stakes === 'bragging'}
					Participants predict YES or NO — the loser pays the dare!
				{:else}
					Participants stake VXP points — correct predictors win the pot.
				{/if}
				You resolve the outcome when the time comes.
			</p>
		</div>

		<Button class="w-full py-4 text-lg font-black" onclick={onCreate} {status}>
			{#snippet busyLabel()}
				Creating...
			{/snippet}
			Launch Challenge
		</Button>
	</div>
</Modal>
