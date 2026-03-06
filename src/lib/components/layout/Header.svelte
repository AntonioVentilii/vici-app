<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SignInModal from '$lib/components/authn/SignInModal.svelte';
	import UserDropdown from '$lib/components/layout/UserDropdown.svelte';
	import WalletDropdown from '$lib/components/layout/WalletDropdown.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { userIsAdmin, userSignedIn } from '$lib/derived/user.derived';
	import { getBalances } from '$lib/services/wallet.service';
	import { navStore, navigateTo, type Page } from '$lib/stores/nav.store';
	import type { WalletBalance } from '$lib/types/wallet';

	let balances = $state<WalletBalance>({ icp: ZERO, ckUsdc: ZERO, collateral: ZERO });

	let showSignInModal = $state(false);

	onMount(async () => {
		balances = await getBalances();
	});

	const isActive = (path: Page) => $navStore === path && page.url.pathname === '/';

	const handleNav = (p: Page) => {
		navigateTo(p);
	};

	const openSignInModal = () => {
		showSignInModal = true;
	};

	interface NavItem {
		label: string;
		page: Page;
		adminOnly?: boolean;
	}

	const navItems: NavItem[] = [
		{ label: 'Markets', page: 'markets' },
		{ label: 'Rush', page: 'rush' },
		{ label: 'Leaderboard', page: 'leaderboard' },
		{ label: 'Portfolio', page: 'portfolio' },
		{ label: 'Admin', page: 'admin', adminOnly: true }
	];

	const visibleNavItems = $derived(navItems.filter(({ adminOnly }) => !adminOnly || $userIsAdmin));
</script>

{#snippet navButton({ label, page: navPage, adminOnly = false }: NavItem)}
	<button
		class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive(navPage)
			? adminOnly
				? 'bg-primary/10 text-primary'
				: 'bg-primary text-primary-foreground'
			: adminOnly
				? 'text-primary/60 hover:bg-primary/5 hover:text-primary'
				: 'hover:bg-muted/50 hover:text-foreground'}"
		onclick={() => handleNav(navPage)}
	>
		{label}
	</button>
{/snippet}

<header
	class="border-border bg-background/95 sticky top-0 z-50 w-full border-b backdrop-blur-md transition-all duration-300"
>
	<div class="container mx-auto flex h-16 items-center justify-between px-4">
		<!-- Logo -->
		<button class="group flex items-center gap-2" onclick={() => handleNav('markets')}>
			<div
				class="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg font-bold shadow-lg transition-transform group-hover:scale-110"
			>
				V
			</div>
			<span
				class="hidden text-xl font-extrabold tracking-tight text-slate-950 drop-shadow-sm sm:block"
			>
				Veni. Vidi. <span class="text-primary">VICI</span>.
			</span>
		</button>

		<!-- Desktop Nav -->
		<nav class="hidden items-center gap-1 md:flex">
			{#each visibleNavItems as item (item.page)}
				{@render navButton(item)}
			{/each}
		</nav>

		<!-- Right side -->
		<div class="flex items-center gap-4">
			{#if $userSignedIn}
				<div class="flex items-center gap-3">
					<WalletDropdown {balances} />
					<UserDropdown />
				</div>
			{:else}
				<div class="flex items-center gap-2">
					<Button onclick={openSignInModal}>Sign in</Button>
				</div>
			{/if}
		</div>
	</div>
</header>

<SignInModal bind:show={showSignInModal} />
