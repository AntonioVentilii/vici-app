<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { LoaderCircle } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SignInModal from '$lib/components/authn/SignInModal.svelte';
	import Logo from '$lib/components/layout/Logo.svelte';
	import UserDropdown from '$lib/components/layout/UserDropdown.svelte';
	import WalletDropdown from '$lib/components/layout/WalletDropdown.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { navItems } from '$lib/constants/nav.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { authBusy, userIsAdmin, userSignedIn } from '$lib/derived/user.derived';
	import { balancesStore } from '$lib/stores/balances.store';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { localeStore } from '$lib/stores/locale.store';
	import type { NavItem } from '$lib/types/nav';
	import { t } from '$lib/utils/i18n.utils';

	let showSignInModal = $state(false);

	const isActive = (path: AppPath) => {
		const current = page.url.pathname;

		if (current === path) {
			return true;
		}

		if (path === AppPath.Home && current.startsWith('/markets/')) {
			return true;
		}

		if (
			path === AppPath.Profile &&
			(current === AppPath.Wallet ||
				current === AppPath.Settings ||
				current === AppPath.Notifications)
		) {
			return true;
		}

		return false;
	};

	const handleNav = (path: AppPath) => {
		goto(path);
	};

	const openSignInModal = () => {
		showSignInModal = true;
	};

	const visibleNavItems = $derived(navItems.filter(({ adminOnly }) => !adminOnly || $userIsAdmin));
</script>

{#snippet navButton({ labelKey, path, icon: Icon, adminOnly = false }: NavItem)}
	<BaseButton
		class="relative px-4 py-2 text-sm leading-none font-medium transition-colors duration-200 {isActive(
			path
		)
			? adminOnly
				? 'text-primary'
				: 'text-foreground'
			: adminOnly
				? 'text-primary/60 hover:text-primary'
				: 'text-muted-foreground hover:text-foreground'}"
		onclick={() => handleNav(path)}
	>
		<span class="inline-flex items-center gap-1 whitespace-nowrap">
			{#if nonNullish(Icon)}
				<Icon size="16" />
			{/if}
			<span class="whitespace-nowrap">{t({ locale: $localeStore, key: labelKey })}</span>
		</span>
		{#if isActive(path)}
			<span class="bg-primary absolute bottom-0 left-1/2 h-0.5 w-4/5 -translate-x-1/2 rounded-full"
			></span>
		{/if}
	</BaseButton>
{/snippet}

<header
	class="border-ink-line bg-background/95 sticky top-0 z-50 w-full border-b backdrop-blur-md transition-all duration-300"
>
	<div class="container mx-auto flex h-14 items-center justify-between px-4">
		<Logo />

		<nav class="hidden items-center gap-1 md:flex">
			{#each visibleNavItems as item (item.path)}
				{@render navButton(item)}
			{/each}
		</nav>

		<div class="flex items-center gap-4">
			{#if $authBusy}
				<div
					class="text-muted-foreground flex h-10 items-center justify-center px-2"
					aria-label="Checking sign-in status"
					aria-live="polite"
					role="status"
				>
					<LoaderCircle class="animate-spin" aria-hidden="true" size={20} strokeWidth={2.5} />
				</div>
			{:else if $userSignedIn}
				<div class="flex items-center gap-3">
					<WalletDropdown
						balances={{
							balances: $balancesStore ?? {},
							collateral: $collateralsStore?.balances ?? {}
						}}
					/>

					<UserDropdown />
				</div>
			{:else}
				<div class="flex items-center gap-2">
					<Button data-tid={TestId.SignInButton} onclick={openSignInModal}
						>{t({ locale: $localeStore, key: 'nav.signin' })}</Button
					>
				</div>
			{/if}
		</div>
	</div>
</header>

<SignInModal bind:show={showSignInModal} />
