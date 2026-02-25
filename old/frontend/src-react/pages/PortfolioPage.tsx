import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { PositionType, Variant_trade_deposit_payout } from '../backend';
import {
	useGetAllMarkets,
	useGetCallerPositions,
	useGetCallerTransactions,
	useGetCallerUserProfile
} from '../hooks/useQueries';

interface PortfolioPageProps {
	onViewMarket: (marketId: bigint) => void;
}

export default function PortfolioPage({ onViewMarket }: PortfolioPageProps) {
	const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
	const { data: positions = [], isLoading: positionsLoading } = useGetCallerPositions();
	const { data: transactions = [], isLoading: transactionsLoading } = useGetCallerTransactions();
	const { data: markets = [] } = useGetAllMarkets();

	const getMarketTitle = (marketId: bigint) => {
		const market = markets.find((m) => m.id === marketId);
		return market?.title || 'Unknown Market';
	};

	const formatDate = (timestamp: bigint) => {
		const date = new Date(Number(timestamp) / 1000000);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	};

	const totalInvested = positions.reduce((sum, pos) => sum + Number(pos.amount), 0);

	if (profileLoading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<Skeleton className="mb-8 h-12 w-64" />
				<div className="mb-8 grid gap-6 md:grid-cols-3">
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="space-y-8">
				{/* Header */}
				<div>
					<h1 className="text-foreground text-4xl font-bold">Portfolio</h1>
					<p className="text-muted-foreground mt-2">Track your positions and performance</p>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Balance</CardTitle>
							<Wallet className="text-muted-foreground h-4 w-4" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								Ꝟ {Number(userProfile?.balance || 0).toLocaleString()}
							</div>
							<p className="text-muted-foreground text-xs">Vici Coins</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Open Positions</CardTitle>
							<Activity className="text-muted-foreground h-4 w-4" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{positions.length}</div>
							<p className="text-muted-foreground text-xs">Active trades</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Invested</CardTitle>
							<TrendingUp className="text-muted-foreground h-4 w-4" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">Ꝟ {totalInvested.toLocaleString()}</div>
							<p className="text-muted-foreground text-xs">Vici Coins</p>
						</CardContent>
					</Card>
				</div>

				{/* Tabs */}
				<Tabs defaultValue="positions">
					<TabsList>
						<TabsTrigger value="positions">Open Positions</TabsTrigger>
						<TabsTrigger value="transactions">Transaction History</TabsTrigger>
					</TabsList>

					<TabsContent value="positions" className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle>Open Positions</CardTitle>
							</CardHeader>
							<CardContent>
								{positionsLoading ? (
									<div className="space-y-3">
										{[1, 2, 3].map((i) => (
											<Skeleton key={i} className="h-16" />
										))}
									</div>
								) : positions.length > 0 ? (
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Market</TableHead>
													<TableHead>Position</TableHead>
													<TableHead>Amount</TableHead>
													<TableHead>Odds</TableHead>
													<TableHead>Date</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{positions.map((position, idx) => (
													<TableRow
														key={idx}
														className="hover:bg-accent/50 cursor-pointer"
														onClick={() => onViewMarket(position.marketId)}
													>
														<TableCell className="font-medium">
															{getMarketTitle(position.marketId)}
														</TableCell>
														<TableCell>
															{position.positionType === PositionType.yes ? (
																<Badge className="bg-chart-2">
																	<TrendingUp className="mr-1 h-3 w-3" />
																	Yes
																</Badge>
															) : (
																<Badge variant="destructive">
																	<TrendingDown className="mr-1 h-3 w-3" />
																	No
																</Badge>
															)}
														</TableCell>
														<TableCell>Ꝟ {Number(position.amount).toLocaleString()}</TableCell>
														<TableCell>{Math.round(position.odds * 100)}¢</TableCell>
														<TableCell className="text-muted-foreground">
															{formatDate(position.createdAt)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								) : (
									<div className="text-muted-foreground py-12 text-center">
										<p>No open positions yet. Start trading to see your positions here!</p>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="transactions" className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle>Transaction History</CardTitle>
							</CardHeader>
							<CardContent>
								{transactionsLoading ? (
									<div className="space-y-3">
										{[1, 2, 3, 4, 5].map((i) => (
											<Skeleton key={i} className="h-16" />
										))}
									</div>
								) : transactions.length > 0 ? (
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Type</TableHead>
													<TableHead>Market</TableHead>
													<TableHead>Amount</TableHead>
													<TableHead>Date</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{transactions.map((tx) => (
													<TableRow key={tx.id.toString()}>
														<TableCell>
															<Badge
																variant={
																	tx.transactionType === Variant_trade_deposit_payout.deposit
																		? 'default'
																		: tx.transactionType === Variant_trade_deposit_payout.payout
																			? 'default'
																			: 'secondary'
																}
															>
																{tx.transactionType === Variant_trade_deposit_payout.trade
																	? 'Trade'
																	: tx.transactionType === Variant_trade_deposit_payout.deposit
																		? 'Deposit'
																		: 'Payout'}
															</Badge>
														</TableCell>
														<TableCell>{tx.marketId ? getMarketTitle(tx.marketId) : '-'}</TableCell>
														<TableCell
															className={
																tx.transactionType === Variant_trade_deposit_payout.trade
																	? 'text-destructive'
																	: 'text-chart-2'
															}
														>
															{tx.transactionType === Variant_trade_deposit_payout.trade
																? '-'
																: '+'}
															Ꝟ {Number(tx.amount).toLocaleString()}
														</TableCell>
														<TableCell className="text-muted-foreground">
															{formatDate(tx.createdAt)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								) : (
									<div className="text-muted-foreground py-12 text-center">
										<p>No transactions yet.</p>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
