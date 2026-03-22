<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SignInModal from '$lib/components/authn/SignInModal.svelte';
	import UserDropdown from '$lib/components/layout/UserDropdown.svelte';
	import WalletDropdown from '$lib/components/layout/WalletDropdown.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { navItems } from '$lib/constants/nav.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { userIsAdmin, userSignedIn } from '$lib/derived/user.derived';
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
		<!-- Logo -->
		<BaseButton class="group flex items-center gap-2" onclick={() => handleNav(AppPath.Home)}>
			<div
				class="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg font-bold shadow-lg transition-transform group-hover:scale-110"
			>
				V
			</div>
			<span
				class="text-foreground hidden font-serif text-xl font-extrabold tracking-tight drop-shadow-sm sm:block"
			>
				Veni. Vidi. <span class="text-primary">VICI</span>.
			</span>
		</BaseButton>

		<!-- Desktop Nav -->
		<nav class="hidden items-center gap-1 md:flex">
			{#each visibleNavItems as item (item.path)}
				{@render navButton(item)}
			{/each}
		</nav>

		<!-- Right side -->
		<div class="flex items-center gap-4">
			{#if $userSignedIn}
				<div class="flex items-center gap-3">
					<WalletDropdown
						balances={{ balances: $balancesStore, collateral: $collateralsStore.balances }}
					/>

					<UserDropdown />
				</div>
			{:else}
				<div class="flex items-center gap-2">
					<Button onclick={openSignInModal} testId={TestId.SignInButton}>Sign in</Button>
				</div>
			{/if}
		</div>
	</div>
</header>

<SignInModal bind:show={showSignInModal} />
