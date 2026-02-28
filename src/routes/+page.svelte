<script lang="ts">
	import Protected from '$lib/components/auth/Protected.svelte';
	import AdminPage from '$lib/components/pages/AdminPage.svelte';
	import LeaderboardPage from '$lib/components/pages/LeaderboardPage.svelte';
	import MarketsPage from '$lib/components/pages/MarketsPage.svelte';
	import PortfolioPage from '$lib/components/pages/PortfolioPage.svelte';
	import WalletPage from '$lib/components/pages/WalletPage.svelte';
	import { navStore } from '$lib/stores/nav.store';
</script>

<svelte:head>
	<title>Vici Social Markets | Predict. Trade. Win.</title>
	<meta
		name="description"
		content="Trade on binary outcome markets with social features on the Internet Computer."
	/>
</svelte:head>

{#if $navStore === 'markets'}
	<MarketsPage />
{:else if $navStore === 'leaderboard'}
	<LeaderboardPage />
{:else if $navStore === 'portfolio'}
	<PortfolioPage />
{:else if $navStore === 'wallet'}
	<WalletPage />
{:else if $navStore === 'admin'}
	<Protected
		description="Sign in with an admin account to manage markets and resolve predictions."
		title="Admin Access"
	>
		<AdminPage />
	</Protected>
{/if}
