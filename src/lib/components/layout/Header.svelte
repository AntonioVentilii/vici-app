<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SignInModal from '$lib/components/authn/SignInModal.svelte';
	import UserDropdown from '$lib/components/layout/UserDropdown.svelte';
	import WalletDropdown from '$lib/components/layout/WalletDropdown.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { userIsAdmin, userSignedIn } from '$lib/derived/user.derived';
	import { getBalances } from '$lib/services/wallet.service';
	import type { WalletBalance } from '$lib/types/wallet';

	let balances = $state<WalletBalance>({ balances: {}, collateral: {} });

	let showSignInModal = $state(false);

	onMount(async () => {
		balances = await getBalances();
	});

	const isActive = (path: AppPath) => page.url.pathname === path;

	const handleNav = (path: AppPath) => {
		goto(path);
	};

	const openSignInModal = () => {
		showSignInModal = true;
	};

	interface NavItem {
		label: string;
		path: AppPath;
		adminOnly?: boolean;
	}

	const navItems: NavItem[] = [
		{ label: 'Markets', path: AppPath.Home },
		{ label: 'Rush', path: AppPath.Rush },
		{ label: 'Leaderboard', path: AppPath.Leaderboard },
		{ label: 'Portfolio', path: AppPath.Portfolio },
		{ label: 'Admin', path: AppPath.Admin, adminOnly: true }
	];

	const visibleNavItems = $derived(navItems.filter(({ adminOnly }) => !adminOnly || $userIsAdmin));
</script>

{#snippet navButton({ label, path, adminOnly = false }: NavItem)}
	<button
		class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive(path)
			? adminOnly
				? 'bg-primary/10 text-primary'
				: 'bg-primary text-primary-foreground'
			: adminOnly
				? 'text-primary/60 hover:bg-primary/5 hover:text-primary'
				: 'hover:bg-muted/50 hover:text-foreground'}"
		onclick={() => handleNav(path)}
	>
		{label}
	</button>
{/snippet}

<header
	class="border-border bg-background/95 sticky top-0 z-50 w-full border-b backdrop-blur-md transition-all duration-300"
>
	<div class="container mx-auto flex h-16 items-center justify-between px-4">
		<!-- Logo -->
		<button class="group flex items-center gap-2" onclick={() => handleNav(AppPath.Home)}>
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
			{#each visibleNavItems as item (item.path)}
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
