<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from './stores/auth';
	import { userProfile, isAdmin } from './stores/profile';
	import { Toaster } from 'sonner';
	import Header from './components/Header.svelte';
	import Footer from './components/Footer.svelte';
	import HomePage from './pages/HomePage.svelte';
	import MarketsPage from './pages/MarketsPage.svelte';
	import MarketDetailPage from './pages/MarketDetailPage.svelte';
	import PortfolioPage from './pages/PortfolioPage.svelte';
	import LeaderboardPage from './pages/LeaderboardPage.svelte';
	import LearnPage from './pages/LearnPage.svelte';
	import ProfilePage from './pages/ProfilePage.svelte';
	import AdminPage from './pages/AdminPage.svelte';
	import RushPage from './pages/RushPage.svelte';
	import WalletPage from './pages/WalletPage.svelte';
	import ProfileSetupModal from './components/ProfileSetupModal.svelte';
	import AccessDeniedScreen from './components/AccessDeniedScreen.svelte';

	type Page =
		| 'home'
		| 'markets'
		| 'market-detail'
		| 'portfolio'
		| 'leaderboard'
		| 'learn'
		| 'profile'
		| 'admin'
		| 'rush'
		| 'wallet';

	let currentPage: Page = 'home';
	let selectedMarketId: bigint | null = null;

	$: isAuthenticated =
		$auth.loginStatus === 'success' ||
		(!!$auth.identity && !$auth.identity.getPrincipal().isAnonymous());
	$: showsProfileSetup =
		isAuthenticated &&
		!$userProfile.isLoading &&
		$userProfile.isFetched &&
		$userProfile.profile === null;

	const navigateToMarket = (marketId: bigint) => {
		selectedMarketId = marketId;
		currentPage = 'market-detail';
	};

	const navigateBack = () => {
		currentPage = 'markets';
		selectedMarketId = null;
	};

	const handleNavigate = (page: string) => {
		currentPage = page as Page;
		if (page !== 'market-detail') {
			selectedMarketId = null;
		}
	};

	$: isProtectedRoute = ['portfolio', 'profile', 'admin', 'rush', 'wallet'].includes(currentPage);
	$: showAccessDenied = !isAuthenticated && isProtectedRoute;
</script>

<div class="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
	<Header {currentPage} onNavigate={handleNavigate} />

	<main class="flex flex-1 flex-col">
		{#if showAccessDenied}
			<AccessDeniedScreen />
		{:else if currentPage === 'home'}
			<HomePage onViewMarket={navigateToMarket} />
		{:else if currentPage === 'markets'}
			<MarketsPage onViewMarket={navigateToMarket} />
		{:else if currentPage === 'market-detail' && selectedMarketId}
			<MarketDetailPage marketId={selectedMarketId} onBack={navigateBack} />
		{:else if currentPage === 'portfolio'}
			<PortfolioPage onViewMarket={navigateToMarket} />
		{:else if currentPage === 'leaderboard'}
			<LeaderboardPage />
		{:else if currentPage === 'learn'}
			<LearnPage onNavigate={handleNavigate} />
		{:else if currentPage === 'profile'}
			<ProfilePage />
		{:else if currentPage === 'admin' && $isAdmin}
			<AdminPage />
		{:else if currentPage === 'rush'}
			<RushPage onNavigate={handleNavigate} />
		{:else if currentPage === 'wallet'}
			<WalletPage />
		{/if}
	</main>

	<Footer />

	{#if showsProfileSetup}
		<ProfileSetupModal />
	{/if}

	<Toaster position="top-right" richColors />
</div>

<style>
	:global(:root) {
		--primary: 15 23 42;
		--primary-foreground: 248 250 252;
	}

	:global(body) {
		background-color: rgb(248, 250, 252);
		color: rgb(15, 23, 42);
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}
</style>
