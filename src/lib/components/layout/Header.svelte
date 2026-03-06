<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Logout from '$lib/components/authn/Logout.svelte';
	import SignInModal from '$lib/components/authn/SignInModal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { userRole, userSignedIn } from '$lib/derived/user.derived';
	import { getBalances } from '$lib/services/wallet.service';
	import { navStore, navigateTo, type Page } from '$lib/stores/nav.store';
	import { UserRole } from '$lib/types/user';
	import type { WalletBalance } from '$lib/types/wallet';

	let balances = $state<WalletBalance>({ icp: ZERO, ckUsdc: ZERO, collateral: ZERO });

	let showSignInModal = $state(false);

	const isAdmin = $derived($userRole === UserRole.ADMIN);

	onMount(async () => {
		balances = await getBalances();
	});

	const formatBalance = (b: bigint) => Number(b) / 100_000_000;

	const isActive = (path: Page) => $navStore === path && page.url.pathname === '/';

	const handleNav = (p: Page) => {
		navigateTo(p);
	};

	const openSignInModal = () => {
		showSignInModal = true;
	};
</script>

<header
	class="border-border bg-background/90 fixed top-0 z-50 w-full border-b backdrop-blur-md transition-all duration-300"
>
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<!-- Logo -->
		<div class="flex items-center gap-8">
			<button class="group flex items-center gap-2" onclick={() => handleNav('markets')}>
				<div
					class="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg font-bold shadow-lg transition-transform group-hover:scale-110"
				>
					V
				</div>
				<span
					class="hidden text-xl font-extrabold tracking-tight text-slate-950 drop-shadow-sm sm:block"
				>
					VICI <span class="text-primary">SOCIAL</span>
				</span>
			</button>

			<!-- Desktop Nav -->
			<nav class="hidden items-center gap-1 md:flex">
				<button
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('markets')
						? 'bg-muted text-foreground'
						: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
					onclick={() => handleNav('markets')}
				>
					Markets
				</button>
				<button
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('rush')
						? 'bg-muted text-foreground'
						: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
					onclick={() => handleNav('rush')}
				>
					Rush
				</button>
				<button
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('leaderboard')
						? 'bg-muted text-foreground'
						: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
					onclick={() => handleNav('leaderboard')}
				>
					Leaderboard
				</button>
				<button
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('portfolio')
						? 'bg-muted text-foreground'
						: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
					onclick={() => handleNav('portfolio')}
				>
					Portfolio
				</button>
				<button
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('wallet')
						? 'bg-slate-100 text-slate-950'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}"
					onclick={() => handleNav('wallet')}
				>
					Wallet
				</button>
				{#if isAdmin}
					<button
						class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('admin')
							? 'bg-primary/10 text-primary'
							: 'text-primary/60 hover:bg-primary/5 hover:text-primary'}"
						onclick={() => handleNav('admin')}
					>
						Admin
					</button>
				{/if}
			</nav>
		</div>

		<!-- Right side -->
		<div class="flex items-center gap-4">
			{#if $userSignedIn}
				<div class="hidden flex-col items-end gap-0.5 sm:flex">
					<div class="flex items-center gap-3">
						<span class="text-foreground text-sm font-bold">
							{formatBalance(balances.icp).toFixed(2)}
							<span class="text-muted-foreground text-[10px]">ICP</span>
						</span>

						<span class="bg-border h-3 w-px"></span>

						<span class="text-foreground text-sm font-bold">
							{formatBalance(balances.ckUsdc).toFixed(2)}
							<span class="text-muted-foreground text-[10px]">ckUSDC</span>
						</span>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<Logout />
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
