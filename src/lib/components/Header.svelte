<script lang="ts">
	import { mockBackend } from '$lib/services/mockBackend';
	import { onMount } from 'svelte';
	import Login from './Login.svelte';
	import Logout from './Logout.svelte';

	let balances = $state({ icp: 0n, ckUSDC: 0n });
	let isAdmin = $state(false);

	onMount(async () => {
		balances = await mockBackend.getBalances();
		isAdmin = await mockBackend.isAdmin();
	});

	const formatBalance = (b: bigint) => Number(b) / 100_000_000;
</script>

<header
	class="fixed top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-md transition-all duration-300"
>
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<!-- Logo -->
		<div class="flex items-center gap-8">
			<a href="/" class="flex items-center gap-2 group">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white shadow-lg transition-transform group-hover:scale-110"
				>
					V
				</div>
				<span
					class="text-xl font-extrabold tracking-tight text-white drop-shadow-sm sm:block hidden"
				>
					VICI <span class="text-indigo-400">SOCIAL</span>
				</span>
			</a>

			<!-- Desktop Nav -->
			<nav class="hidden md:flex items-center gap-1">
				<a
					href="/"
					class="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
				>
					Markets
				</a>
				<a
					href="/leaderboard"
					class="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
				>
					Leaderboard
				</a>
				<a
					href="/portfolio"
					class="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
				>
					Portfolio
				</a>
				<a
					href="/wallet"
					class="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
				>
					Wallet
				</a>
				{#if isAdmin}
					<a
						href="/admin"
						class="px-4 py-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
					>
						Admin
					</a>
				{/if}
			</nav>
		</div>

		<!-- Right side -->
		<div class="flex items-center gap-4">
			<div class="hidden sm:flex flex-col items-end gap-0.5">
				<div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
					<span class="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
					Live Balances
				</div>
				<div class="flex items-center gap-3">
					<span class="text-sm font-bold text-white"
						>{formatBalance(balances.icp).toFixed(2)} <span class="text-[10px] text-gray-400">ICP</span></span
					>
					<span class="h-3 w-[1px] bg-white/10"></span>
					<span class="text-sm font-bold text-white"
						>{formatBalance(balances.ckUSDC).toFixed(2)} <span class="text-[10px] text-gray-400">ckUSDC</span></span
					>
				</div>
			</div>

			<div class="h-8 w-[1px] bg-white/10 sm:block hidden"></div>

			<div class="flex items-center gap-2">
				<Login />
				<Logout />
			</div>
		</div>
	</div>
</header>
