<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Logout from '$lib/components/auth/Logout.svelte';
	import SignIn from '$lib/components/auth/SignIn.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { isAdmin as isAdminService } from '$lib/services/auth.service';
	import { getBalances } from '$lib/services/wallet.service';
	import type { WalletBalance } from '$lib/types/wallet';

	let balances = $state<WalletBalance>({ icp: ZERO, ckUsdc: ZERO });
	let isAdmin = $state(false);

	onMount(async () => {
		balances = await getBalances();
		isAdmin = await isAdminService();
	});

	const formatBalance = (b: bigint) => Number(b) / 100_000_000;

	const isActive = (path: string) => {
		if (path === '/') {
			return page.url.pathname === '/';
		}
		return page.url.pathname.startsWith(path);
	};
</script>

<header
	class="fixed top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md transition-all duration-300"
>
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<!-- Logo -->
		<div class="flex items-center gap-8">
			<a class="group flex items-center gap-2" href="/">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 font-bold text-white shadow-lg transition-transform group-hover:scale-110"
				>
					V
				</div>
				<span
					class="hidden text-xl font-extrabold tracking-tight text-slate-950 drop-shadow-sm sm:block"
				>
					VICI <span class="text-indigo-600">SOCIAL</span>
				</span>
			</a>

			<!-- Desktop Nav -->
			<nav class="hidden items-center gap-1 md:flex">
				<a
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('/')
						? 'bg-slate-100 text-slate-950'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}"
					href="/"
				>
					Markets
				</a>
				<a
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('/leaderboard')
						? 'bg-slate-100 text-slate-950'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}"
					href="/leaderboard"
				>
					Leaderboard
				</a>
				<a
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('/portfolio')
						? 'bg-slate-100 text-slate-950'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}"
					href="/portfolio"
				>
					Portfolio
				</a>
				<a
					class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('/wallet')
						? 'bg-slate-100 text-slate-950'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}"
					href="/wallet"
				>
					Wallet
				</a>
				{#if isAdmin}
					<a
						class="rounded-lg px-4 py-2 text-sm font-medium transition-all {isActive('/admin')
							? 'bg-indigo-500/10 text-indigo-400'
							: 'text-indigo-400/60 hover:bg-indigo-500/5 hover:text-indigo-400'}"
						href="/admin"
					>
						Admin
					</a>
				{/if}
			</nav>
		</div>

		<!-- Right side -->
		<div class="flex items-center gap-4">
			{#if $userSignedIn}
				<div class="hidden flex-col items-end gap-0.5 sm:flex">
					<div
						class="flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-400 uppercase"
					>
						<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500"></span>
						Live Balances
					</div>
					<div class="flex items-center gap-3">
						<span class="text-sm font-bold text-slate-950"
							>{formatBalance(balances.icp).toFixed(2)}
							<span class="text-[10px] text-slate-500">ICP</span></span
						>
						<span class="h-3 w-px bg-slate-200"></span>
						<span class="text-sm font-bold text-slate-950"
							>{formatBalance(balances.ckUsdc).toFixed(2)}
							<span class="text-[10px] text-slate-500">ckUSDC</span></span
						>
					</div>
				</div>

				<div class="hidden h-8 w-px bg-white/10 sm:block"></div>
			{/if}

			<div class="flex items-center gap-2">
				<SignIn />
				<Logout />
			</div>
		</div>
	</div>
</header>
