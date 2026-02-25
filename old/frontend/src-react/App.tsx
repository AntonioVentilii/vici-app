import { useEffect, useState } from 'react';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useGetCallerUserProfile, useIsCallerAdmin } from './hooks/useQueries';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import MarketsPage from './pages/MarketsPage';
import MarketDetailPage from './pages/MarketDetailPage';
import PortfolioPage from './pages/PortfolioPage';
import LeaderboardPage from './pages/LeaderboardPage';
import LearnPage from './pages/LearnPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import RushPage from './pages/RushPage';
import WalletPage from './pages/WalletPage';
import ProfileSetupModal from './components/ProfileSetupModal';
import AccessDeniedScreen from './components/AccessDeniedScreen';

export type Page =
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

export default function App() {
	const { identity } = useInternetIdentity();
	const { data: userProfile, isLoading: profileLoading, isFetched } = useGetCallerUserProfile();
	const { data: isAdmin } = useIsCallerAdmin();
	const [currentPage, setCurrentPage] = useState<Page>('home');
	const [selectedMarketId, setSelectedMarketId] = useState<bigint | null>(null);

	const isAuthenticated = !!identity;
	const showProfileSetup = isAuthenticated && !profileLoading && isFetched && userProfile === null;

	// Navigate to market detail
	const navigateToMarket = (marketId: bigint) => {
		setSelectedMarketId(marketId);
		setCurrentPage('market-detail');
	};

	// Navigate back from market detail
	const navigateBack = () => {
		setCurrentPage('markets');
		setSelectedMarketId(null);
	};

	// Show access denied for non-authenticated users trying to access protected pages
	if (
		!isAuthenticated &&
		['portfolio', 'profile', 'admin', 'rush', 'wallet'].includes(currentPage)
	) {
		return (
			<ThemeProvider attribute="class" defaultTheme="light" enableSystem>
				<div className="bg-background flex min-h-screen flex-col">
					<Header currentPage={currentPage} onNavigate={setCurrentPage} />
					<AccessDeniedScreen />
					<Footer />
					<Toaster />
				</div>
			</ThemeProvider>
		);
	}

	return (
		<ThemeProvider attribute="class" defaultTheme="light" enableSystem>
			<div className="bg-background flex min-h-screen flex-col">
				<Header currentPage={currentPage} onNavigate={setCurrentPage} />

				<main className="flex-1">
					{currentPage === 'home' && <HomePage onViewMarket={navigateToMarket} />}
					{currentPage === 'markets' && <MarketsPage onViewMarket={navigateToMarket} />}
					{currentPage === 'market-detail' && selectedMarketId && (
						<MarketDetailPage marketId={selectedMarketId} onBack={navigateBack} />
					)}
					{currentPage === 'portfolio' && <PortfolioPage onViewMarket={navigateToMarket} />}
					{currentPage === 'leaderboard' && <LeaderboardPage />}
					{currentPage === 'learn' && <LearnPage onNavigate={setCurrentPage} />}
					{currentPage === 'profile' && <ProfilePage />}
					{currentPage === 'admin' && isAdmin && <AdminPage />}
					{currentPage === 'rush' && <RushPage onNavigate={setCurrentPage} />}
					{currentPage === 'wallet' && <WalletPage />}
				</main>

				<Footer />

				{showProfileSetup && <ProfileSetupModal />}
				<Toaster />
			</div>
		</ThemeProvider>
	);
}
