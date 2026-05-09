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
	import type { AppPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { authBusy, userIsAdmin, userSignedIn } from '$lib/derived/user.derived';
	import { balancesStore } from '$lib/stores/balances.store';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import type { NavItem } from '$lib/types/nav';

	let showSignInModal = $state(false);

	const isActive = (path: AppPath) => page.url.pathname === path;

	const handleNav = (path: AppPath) => {
		goto(path);
	};

	const openSignInModal = () => {
		showSignInModal = true;
	};

	const visibleNavItems = $derived(navItems.filter(({ adminOnly }) => !adminOnly || $userIsAdmin));
</script>

{#snippet navButton({ label, path, icon: Icon, adminOnly = false }: NavItem)}
	<BaseButton
		class="rounded-lg px-4 py-2 text-sm leading-none font-medium {isActive(path)
			? adminOnly
				? 'bg-primary/10 text-primary'
				: 'bg-primary text-primary-foreground'
			: adminOnly
				? 'text-primary/60 hover:bg-primary/5 hover:text-primary'
				: 'hover:bg-muted/50 hover:text-foreground'}"
		onclick={() => handleNav(path)}
	>
		<span class="inline-flex items-center gap-1 whitespace-nowrap">
			{#if nonNullish(Icon)}
				<Icon size="16" />
			{/if}
			<span class="whitespace-nowrap">{label}</span>
		</span>
	</BaseButton>
{/snippet}

<header
	class="border-border bg-background/95 sticky top-0 z-50 w-full border-b backdrop-blur-md transition-all duration-300"
>
	<div class="container mx-auto flex h-16 items-center justify-between px-4">
		<!-- Left side -->
		<Logo />

		<!-- Desktop Nav -->
		<nav class="hidden items-center gap-1 md:flex">
			{#each visibleNavItems as item (item.path)}
				{@render navButton(item)}
			{/each}
		</nav>

		<!-- Right side -->
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
					<Button data-tid={TestId.SignInButton} onclick={openSignInModal}>Sign in</Button>
				</div>
			{/if}
		</div>
	</div>
</header>

<SignInModal bind:show={showSignInModal} />
