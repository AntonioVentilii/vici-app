<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import type { RegistryDid } from '$declarations';
	import SocialPremiumPicker from '$lib/components/social/SocialPremiumPicker.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import {
		DEFAULT_SOCIAL_PREMIUM_ID,
		formatSocialPremium,
		type SocialPremiumOptionId
	} from '$lib/constants/social-premium.constants';
	import { listGroups } from '$lib/services/group.services';
	import { createMarket } from '$lib/services/market.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { ButtonStatus } from '$lib/types/components';
	import { t } from '$lib/utils/i18n.utils';
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
	let socialPremiumId = $state<SocialPremiumOptionId>(DEFAULT_SOCIAL_PREMIUM_ID);
	let socialPremiumCustom = $state('');
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
		socialPremiumId = DEFAULT_SOCIAL_PREMIUM_ID;
		socialPremiumCustom = '';
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
				title: t({ locale: $localeStore, key: 'challenge.create.error.missing_title' }),
				message: t({ locale: $localeStore, key: 'challenge.create.error.missing_title_message' }),
				type: 'warning'
			});

			return;
		}

		if (isNullish(expiryDate)) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'challenge.create.error.missing_date' }),
				message: t({ locale: $localeStore, key: 'challenge.create.error.missing_date_message' }),
				type: 'warning'
			});

			return;
		}

		const socialReward =
			stakes === 'bragging'
				? formatSocialPremium({
						optionId: socialPremiumId,
						customTitle: socialPremiumCustom,
						locale: $localeStore
					})
				: undefined;

		if (stakes === 'bragging' && socialReward === undefined) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'challenge.create.error.missing_premium' }),
				message: t({
					locale: $localeStore,
					key: 'challenge.create.error.missing_premium_message'
				}),
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
				socialReward,
				tradingAccess
			});

			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'challenge.create.created.title' }),
				message: t({ locale: $localeStore, key: 'challenge.create.created.message' }),
				type: 'success'
			});

			refreshMarkets();
			close();
		} catch (e: unknown) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'challenge.create.failed.title' }),
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
			<h3 class="text-foreground text-2xl font-black">
				{t({ locale: $localeStore, key: 'challenge.create.title' })}
			</h3>
			<p class="text-muted-foreground mt-1 text-sm">
				{t({ locale: $localeStore, key: 'challenge.create.sub' })}
			</p>
		</div>

		<div class="space-y-2">
			<label
				class="text-muted-foreground text-xs font-bold tracking-widest uppercase"
				for="ch-title"
			>
				{t({ locale: $localeStore, key: 'challenge.create.question_label' })}
			</label>
			<input
				id="ch-title"
				class="bg-foreground/5 text-foreground ring-border focus:bg-card focus:ring-primary w-full rounded-2xl border-none px-5 py-4 text-lg font-bold ring-1 ring-inset focus:ring-2"
				placeholder={t({ locale: $localeStore, key: 'challenge.create.question_placeholder' })}
				type="text"
				bind:value={title}
			/>
		</div>

		<div class="space-y-2">
			<label
				class="text-muted-foreground text-xs font-bold tracking-widest uppercase"
				for="ch-desc"
			>
				{t({ locale: $localeStore, key: 'challenge.create.details_label' })}
				<span class="text-muted-foreground font-normal">
					{t({ locale: $localeStore, key: 'challenge.create.details_optional' })}
				</span>
			</label>
			<textarea
				id="ch-desc"
				class="bg-foreground/5 text-foreground ring-border focus:bg-card focus:ring-primary w-full rounded-2xl border-none px-5 py-3 text-sm ring-1 ring-inset focus:ring-2"
				placeholder={t({ locale: $localeStore, key: 'challenge.create.details_placeholder' })}
				rows="2"
				bind:value={description}
			></textarea>
		</div>

		<div class="space-y-2">
			<label
				class="text-muted-foreground text-xs font-bold tracking-widest uppercase"
				for="ch-expiry"
			>
				{t({ locale: $localeStore, key: 'challenge.create.expiry_label' })}
			</label>
			<input
				id="ch-expiry"
				class="bg-foreground/5 text-foreground ring-border focus:bg-card focus:ring-primary w-full rounded-2xl border-none px-5 py-4 ring-1 ring-inset focus:ring-2"
				type="datetime-local"
				bind:value={expiryDate}
			/>
		</div>

		<div class="space-y-3">
			<span class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
				{t({ locale: $localeStore, key: 'challenge.create.stakes' })}
			</span>
			<div class="grid grid-cols-2 gap-3">
				<button
					class="rounded-2xl border-2 px-4 py-3 text-center font-bold transition-all {stakes ===
					'bragging'
						? 'border-primary bg-primary/10 text-primary'
						: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
					onclick={() => (stakes = 'bragging')}
					type="button"
				>
					<div class="text-sm">
						{t({ locale: $localeStore, key: 'challenge.create.stakes.bragging' })}
					</div>
					<div class="text-[10px] font-normal opacity-70">
						{t({ locale: $localeStore, key: 'challenge.create.stakes.bragging_sub' })}
					</div>
				</button>
				<button
					class="rounded-2xl border-2 px-4 py-3 text-center font-bold transition-all {stakes ===
					'vxp'
						? 'border-primary bg-primary/10 text-primary'
						: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
					onclick={() => (stakes = 'vxp')}
					type="button"
				>
					<div class="text-sm">
						{t({ locale: $localeStore, key: 'challenge.create.stakes.vxp' })}
					</div>
					<div class="text-[10px] font-normal opacity-70">
						{t({ locale: $localeStore, key: 'challenge.create.stakes.vxp_sub' })}
					</div>
				</button>
			</div>
		</div>

		{#if stakes === 'bragging'}
			<SocialPremiumPicker
				customTitle={socialPremiumCustom}
				onChange={({ optionId, customTitle }) => {
					socialPremiumId = optionId;
					socialPremiumCustom = customTitle;
				}}
				optionId={socialPremiumId}
			/>
		{/if}

		<div class="space-y-3">
			<span class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
				{t({ locale: $localeStore, key: 'challenge.create.audience' })}
			</span>
			<div class="grid grid-cols-3 gap-2">
				<button
					class="rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all {audience ===
					'public'
						? 'border-foreground bg-foreground text-background'
						: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
					onclick={() => (audience = 'public')}
					type="button"
				>
					{t({ locale: $localeStore, key: 'challenge.create.audience.public' })}
				</button>
				<button
					class="rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all {audience ===
					'friends'
						? 'border-foreground bg-foreground text-background'
						: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
					onclick={() => (audience = 'friends')}
					type="button"
				>
					{t({ locale: $localeStore, key: 'challenge.create.audience.friends' })}
				</button>
				<button
					class="rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all {audience ===
					'group'
						? 'border-foreground bg-foreground text-background'
						: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
					onclick={() => (audience = 'group')}
					type="button"
				>
					{t({ locale: $localeStore, key: 'challenge.create.audience.group' })}
				</button>
			</div>
		</div>

		{#if audience === 'group'}
			<div class="bg-foreground/5 space-y-2 rounded-2xl p-4">
				{#if availableGroups.length === 0}
					<p class="text-muted-foreground text-sm italic">
						{t({ locale: $localeStore, key: 'challenge.create.no_groups' })}
					</p>
				{:else}
					{#each availableGroups as group (group.group_id)}
						<label
							class="bg-card ring-border hover:bg-foreground/5 flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 ring-1 transition-colors ring-inset"
						>
							<input
								class="accent-primary"
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
							<span class="text-foreground text-sm font-semibold">{group.name}</span>
							<span class="text-muted-foreground ml-auto text-xs">{group.members.length}</span>
						</label>
					{/each}
				{/if}
			</div>
		{/if}

		<div class="bg-primary/5 ring-primary/10 rounded-2xl p-4 ring-1 ring-inset">
			<p class="text-muted-foreground text-xs leading-relaxed">
				<strong>{t({ locale: $localeStore, key: 'challenge.create.how_it_works_prefix' })}</strong>
				{#if stakes === 'bragging'}
					{t({ locale: $localeStore, key: 'challenge.create.how_it_works.bragging' })}
				{:else}
					{t({ locale: $localeStore, key: 'challenge.create.how_it_works.vxp' })}
				{/if}
			</p>
		</div>

		<Button class="w-full py-4 text-lg font-black" onclick={onCreate} {status}>
			{#snippet busyLabel()}
				{t({ locale: $localeStore, key: 'challenge.create.cta_busy' })}
			{/snippet}
			{t({ locale: $localeStore, key: 'challenge.create.cta' })}
		</Button>
	</div>
</Modal>
