import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { MarketStatus } from '../backend';
import MarketCard from '../components/MarketCard';
import { useGetAllMarkets } from '../hooks/useQueries';

interface MarketsPageProps {
	onViewMarket: (marketId: bigint) => void;
}

export default function MarketsPage({ onViewMarket }: MarketsPageProps) {
	const { data: markets = [], isLoading } = useGetAllMarkets();
	const [searchQuery, setSearchQuery] = useState('');
	const [activeTab, setActiveTab] = useState('all');

	const filterMarkets = () => {
		let filtered = markets;

		// Filter by search query
		if (searchQuery) {
			filtered = filtered.filter(
				(m) =>
					m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
					m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
					m.categories.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
			);
		}

		// Filter by tab
		switch (activeTab) {
			case 'trending':
				filtered = filtered.filter((m) => m.status === MarketStatus.open);
				break;
			case 'expiring':
				filtered = filtered
					.filter((m) => m.status === MarketStatus.open)
					.sort((a, b) => Number(a.expiration) - Number(b.expiration));
				break;
			case 'resolved':
				filtered = filtered.filter((m) => m.status === MarketStatus.resolved);
				break;
		}

		return filtered;
	};

	const filteredMarkets = filterMarkets();

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="space-y-6">
				{/* Header */}
				<div className="space-y-2">
					<h1 className="text-4xl font-bold text-foreground">Markets</h1>
					<p className="text-muted-foreground">Explore and trade on prediction markets</p>
				</div>

				{/* Search */}
				<div className="relative max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search markets..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
					/>
				</div>

				{/* Tabs */}
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList>
						<TabsTrigger value="all">All Markets</TabsTrigger>
						<TabsTrigger value="trending">Trending</TabsTrigger>
						<TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
						<TabsTrigger value="resolved">Resolved</TabsTrigger>
					</TabsList>

					<TabsContent value={activeTab} className="mt-6">
						{isLoading ? (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{[1, 2, 3, 4, 5, 6].map((i) => (
									<Skeleton key={i} className="h-64 rounded-lg" />
								))}
							</div>
						) : filteredMarkets.length > 0 ? (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{filteredMarkets.map((market) => (
									<MarketCard
										key={market.id.toString()}
										market={market}
										onViewMarket={onViewMarket}
									/>
								))}
							</div>
						) : (
							<div className="text-center py-16">
								<p className="text-muted-foreground">No markets found matching your criteria.</p>
							</div>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
