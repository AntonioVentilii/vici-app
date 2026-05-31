<script lang="ts">
	import { signOut } from '@junobuild/core';
	import { Settings } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import DomainSwitch from '$lib/components/layout/DomainSwitch.svelte';
	import AppearancePicker from '$lib/components/ui/AppearancePicker.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import PopOver from '$lib/components/ui/PopOver.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { isDev } from '$lib/env/app.env';
	import { localeStore } from '$lib/stores/locale.store';
	import { setAuthBusy } from '$lib/stores/user.store';
	import type { ButtonStatus } from '$lib/types/components';
	import { t } from '$lib/utils/i18n.utils';

	let open = $state(false);
	let signOutStatus = $state<ButtonStatus>('enabled');

	const goToProfile = () => {
		open = false;

		goto(AppPath.Profile);
	};

	const goToSettings = () => {
		open = false;

		goto(AppPath.Settings);
	};

	const doSignOut = async () => {
		signOutStatus = 'pending';
		setAuthBusy(true);

		try {
			await signOut();
			open = false;
		} finally {
			signOutStatus = 'enabled';
		}
	};
</script>

<PopOver bind:open>
	{#snippet trigger()}
		<BaseButton
			class="bg-foreground/5 text-muted-foreground hover:bg-foreground/8 hover:text-foreground h-10 w-10 rounded-full active:scale-95"
			aria-label={t({ locale: $localeStore, key: 'a11y.user_profile' })}
			data-tid={TestId.UserMenu}
		>
			<svg
				fill="none"
				height="20"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				viewBox="0 0 24 24"
				width="20"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		</BaseButton>
	{/snippet}

	{#snippet content()}
		<div class="w-72 py-1">
			<BaseButton
				class="text-foreground hover:bg-primary/10 hover:text-primary flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-medium"
				onclick={goToProfile}
			>
				<svg
					fill="none"
					height="16"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					width="16"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
					<circle cx="12" cy="7" r="4" />
				</svg>
				{t({ locale: $localeStore, key: 'nav.profile' })}
			</BaseButton>

			<BaseButton
				class="text-foreground hover:bg-primary/10 hover:text-primary flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-medium"
				onclick={goToSettings}
			>
				<Settings size={16} strokeWidth={1.8} />
				{t({ locale: $localeStore, key: 'settings.title' })}
			</BaseButton>

			<div class="border-border my-1 border-t"></div>

			{#if isDev()}
				<!--
					Balance-domain switch is a dev-only convenience for toggling
					between playground and settlement balances. Not surfaced in
					production — regular users only see the playground domain.
				-->
				<DomainSwitch />
			{/if}

			<div class="flex items-center justify-between gap-3 px-4 py-2">
				<span class="text-muted-foreground eyebrow-xs">
					{t({ locale: $localeStore, key: 'layout.user.theme' })}
				</span>
				<AppearancePicker />
			</div>

			<div class="border-border my-1 border-t"></div>

			<BaseButton
				class="text-danger hover:bg-danger/10 w-full gap-3 px-4 py-2 text-left text-sm font-medium"
				data-tid={TestId.Logout}
				onclick={doSignOut}
				status={signOutStatus}
			>
				<svg
					fill="none"
					height="16"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					width="16"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
					<polyline points="16 17 21 12 16 7" />
					<line x1="21" x2="9" y1="12" y2="12" />
				</svg>
				{t({ locale: $localeStore, key: 'layout.user.log_out' })}
			</BaseButton>
		</div>
	{/snippet}
</PopOver>
