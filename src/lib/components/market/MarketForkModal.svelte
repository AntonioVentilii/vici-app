<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { RegistryDid } from '$declarations';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import {
		getOrCreateFollowersGroup,
		getOrCreateFriendsGroup,
		listGroups
	} from '$lib/services/group.services';
	import { forkMarket } from '$lib/services/market.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		isOpen: boolean;
		market: Market;
		onClose: () => void;
	}

	const { isOpen, market, onClose }: Props = $props();

	let mode = $state<'Friends' | 'Followers' | 'Group'>('Friends');
	let availableGroups = $state<RegistryDid.Group[]>([]);
	let selectedGroupId = $state<string | null>(null);
	let loadingGroups = $state(false);
	let forking = $state(false);

	onMount(async () => {
		loadingGroups = true;

		try {
			const all = await listGroups();
			availableGroups = all;
		} catch (e) {
			console.error('Failed to load groups', e);
		} finally {
			loadingGroups = false;
		}
	});

	const handleFork = async () => {
		forking = true;

		try {
			let targetGroupIds: string[] = [];

			if (mode === 'Friends') {
				const friendsGroupId = await getOrCreateFriendsGroup();
				targetGroupIds = [friendsGroupId];
			} else if (mode === 'Followers') {
				const followersGroupId = await getOrCreateFollowersGroup();
				targetGroupIds = [followersGroupId];
			} else if (selectedGroupId) {
				targetGroupIds = [selectedGroupId];
			} else {
				throw new Error(t({ locale: $localeStore, key: 'market.fork.error.select_group' }));
			}

			const newMarketId = await forkMarket({
				marketId: market.id,
				groupIds: targetGroupIds
			});

			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'market.fork.notify.success_title' }),
				message: t({ locale: $localeStore, key: 'market.fork.notify.success_message' }),
				type: 'success'
			});

			onClose();
			goto(`/markets/${newMarketId}`);
		} catch (e: unknown) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'market.fork.notify.fail_title' }),
				message:
					e instanceof Error
						? e.message
						: t({ locale: $localeStore, key: 'market.fork.notify.unknown_error' }),
				type: 'error'
			});
		} finally {
			forking = false;
		}
	};
</script>

<Modal {isOpen} {onClose}>
	<div class="space-y-6">
		<div class="space-y-2">
			<h2 class="text-foreground text-2xl font-black">
				{t({ locale: $localeStore, key: 'market.fork.title' })}
			</h2>
			<p class="text-muted-foreground text-sm">
				{t({ locale: $localeStore, key: 'market.fork.sub_prefix' })}
				<span class="text-foreground font-bold">"{market.title}"</span>
				{t({ locale: $localeStore, key: 'market.fork.sub_suffix' })}
			</p>
		</div>

		<div class="space-y-4">
			<div class="flex gap-4">
				<button
					class="flex-1 rounded-2xl border-2 px-4 py-3 text-center transition-all {mode ===
					'Friends'
						? 'border-primary bg-primary/10 text-primary'
						: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
					onclick={() => (mode = 'Friends')}
				>
					<span class="block text-lg">👫</span>
					<span class="text-xs font-bold tracking-wider uppercase"
						>{t({ locale: $localeStore, key: 'leaderboard.tab.friends' })}</span
					>
				</button>
				<button
					class="flex-1 rounded-2xl border-2 px-4 py-3 text-center transition-all {mode ===
					'Followers'
						? 'border-primary bg-primary/10 text-primary'
						: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
					onclick={() => (mode = 'Followers')}
				>
					<span class="block text-lg">📣</span>
					<span class="text-xs font-bold tracking-wider uppercase"
						>{t({ locale: $localeStore, key: 'market.fork.mode.followers' })}</span
					>
				</button>
				<button
					class="flex-1 rounded-2xl border-2 px-4 py-3 text-center transition-all {mode === 'Group'
						? 'border-primary bg-primary/10 text-primary'
						: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
					onclick={() => (mode = 'Group')}
				>
					<span class="block text-lg">🏘️</span>
					<span class="text-xs font-bold tracking-wider uppercase"
						>{t({ locale: $localeStore, key: 'market.fork.mode.group' })}</span
					>
				</button>
			</div>

			{#if mode === 'Friends'}
				<div class="bg-foreground/5 ring-border rounded-2xl p-4 text-center ring-1">
					<p class="text-muted-foreground text-xs leading-relaxed">
						{t({ locale: $localeStore, key: 'market.fork.friends_desc' })}
					</p>
				</div>
			{:else if mode === 'Followers'}
				<div class="bg-foreground/5 ring-border rounded-2xl p-4 text-center ring-1">
					<p class="text-muted-foreground text-xs leading-relaxed">
						{t({ locale: $localeStore, key: 'market.fork.followers_desc' })}
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#if loadingGroups}
						<div class="text-muted-foreground py-4 text-center text-xs">
							{t({ locale: $localeStore, key: 'market.fork.loading_groups' })}
						</div>
					{:else if availableGroups.length === 0}
						<p class="text-muted-foreground py-4 text-center text-xs italic">
							{t({ locale: $localeStore, key: 'market.fork.no_groups' })}
						</p>
					{:else}
						<div class="max-h-48 space-y-2 overflow-y-auto pr-1">
							{#each availableGroups as group (group.group_id)}
								<label
									class="border-border bg-card hover:bg-foreground/5 flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
								>
									<input
										name="group"
										class="accent-primary"
										checked={selectedGroupId === group.group_id}
										onchange={() => (selectedGroupId = group.group_id)}
										type="radio"
										value={group.group_id}
									/>
									<span class="text-foreground text-sm font-semibold">{group.name}</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="pt-4">
			<Button
				class="w-full"
				onclick={handleFork}
				size="lg"
				status={forking ? 'pending' : mode === 'Group' && !selectedGroupId ? 'disabled' : 'enabled'}
			>
				{forking
					? t({ locale: $localeStore, key: 'market.fork.creating' })
					: t({ locale: $localeStore, key: 'market.fork.start' })}
			</Button>
		</div>
	</div>
</Modal>
