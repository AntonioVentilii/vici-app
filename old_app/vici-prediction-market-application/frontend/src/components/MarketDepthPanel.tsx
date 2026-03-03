import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { PositionType } from '../backend';
import { useGetMarket, useGetMarketDepth } from '../hooks/useQueries';

interface MarketDepthPanelProps {
	marketId: bigint;
}

export default function MarketDepthPanel({ marketId }: MarketDepthPanelProps) {
	const { data: depthPositions = [], isLoading: depthLoading } = useGetMarketDepth(marketId);
	const { data: market, isLoading: marketLoading } = useGetMarket(marketId);

	if (depthLoading || marketLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		);
	}

	if (!market) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				<p>Market not found</p>
			</div>
		);
	}

	const yesPositions = depthPositions.filter((p) => p.positionType === PositionType.yes);
	const noPositions = depthPositions.filter((p) => p.positionType === PositionType.no);

	const totalYesVolume = yesPositions.reduce((sum, p) => sum + Number(p.amount), 0);
	const totalNoVolume = noPositions.reduce((sum, p) => sum + Number(p.amount), 0);

	return (
		<div className="space-y-6">
			{/* Current Forecasts */}
			<div className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
				<h3 className="text-sm font-medium text-muted-foreground mb-4">Current Market Forecasts</h3>
				<div className="grid grid-cols-2 gap-6">
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5 text-chart-2" />
							<span className="text-sm font-medium text-chart-2">YES</span>
						</div>
						<div className="text-4xl font-bold text-chart-2">
							{Math.round(market.oddsYes * 100)}%
						</div>
						<div className="text-xs text-muted-foreground">
							{Math.round(market.oddsYes * 100)}¢ per share
						</div>
					</div>
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<TrendingDown className="h-5 w-5 text-destructive" />
							<span className="text-sm font-medium text-destructive">NO</span>
						</div>
						<div className="text-4xl font-bold text-destructive">
							{Math.round(market.oddsNo * 100)}%
						</div>
						<div className="text-xs text-muted-foreground">
							{Math.round(market.oddsNo * 100)}¢ per share
						</div>
					</div>
				</div>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-2 gap-4">
				<div className="p-4 bg-chart-2/10 rounded-lg border border-chart-2/20">
					<div className="flex items-center gap-2 mb-2">
						<TrendingUp className="h-4 w-4 text-chart-2" />
						<span className="text-sm font-medium text-chart-2">YES Positions</span>
					</div>
					<div className="text-2xl font-bold">Ꝟ {totalYesVolume.toLocaleString()}</div>
					<div className="text-xs text-muted-foreground">{yesPositions.length} positions</div>
				</div>
				<div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
					<div className="flex items-center gap-2 mb-2">
						<TrendingDown className="h-4 w-4 text-destructive" />
						<span className="text-sm font-medium text-destructive">NO Positions</span>
					</div>
					<div className="text-2xl font-bold">Ꝟ {totalNoVolume.toLocaleString()}</div>
					<div className="text-xs text-muted-foreground">{noPositions.length} positions</div>
				</div>
			</div>

			{/* Order Book Table */}
			{depthPositions.length === 0 ? (
				<div className="text-center py-8 text-muted-foreground border rounded-lg">
					<p>No open positions yet. Be the first to trade!</p>
				</div>
			) : (
				<div className="border rounded-lg">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Trader</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Odds</TableHead>
								<TableHead className="text-right">Amount</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{depthPositions.map((position, idx) => (
								<TableRow key={idx}>
									<TableCell className="font-medium">{position.nickname}</TableCell>
									<TableCell>
										{position.positionType === PositionType.yes ? (
											<Badge
												variant="outline"
												className="bg-chart-2/10 text-chart-2 border-chart-2/20"
											>
												<TrendingUp className="h-3 w-3 mr-1" />
												YES
											</Badge>
										) : (
											<Badge
												variant="outline"
												className="bg-destructive/10 text-destructive border-destructive/20"
											>
												<TrendingDown className="h-3 w-3 mr-1" />
												NO
											</Badge>
										)}
									</TableCell>
									<TableCell>{Math.round(position.odds * 100)}¢</TableCell>
									<TableCell className="text-right font-semibold">
										Ꝟ {Number(position.amount).toLocaleString()}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
