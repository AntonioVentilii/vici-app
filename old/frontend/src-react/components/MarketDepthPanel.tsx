import { useGetMarketDepth, useGetMarket } from '../hooks/useQueries';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { PositionType } from '../backend';

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
			<div className="text-muted-foreground py-8 text-center">
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
			<div className="from-primary/5 to-primary/10 border-primary/20 rounded-lg border bg-gradient-to-br p-6">
				<h3 className="text-muted-foreground mb-4 text-sm font-medium">Current Market Forecasts</h3>
				<div className="grid grid-cols-2 gap-6">
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<TrendingUp className="text-chart-2 h-5 w-5" />
							<span className="text-chart-2 text-sm font-medium">YES</span>
						</div>
						<div className="text-chart-2 text-4xl font-bold">
							{Math.round(market.oddsYes * 100)}%
						</div>
						<div className="text-muted-foreground text-xs">
							{Math.round(market.oddsYes * 100)}¢ per share
						</div>
					</div>
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<TrendingDown className="text-destructive h-5 w-5" />
							<span className="text-destructive text-sm font-medium">NO</span>
						</div>
						<div className="text-destructive text-4xl font-bold">
							{Math.round(market.oddsNo * 100)}%
						</div>
						<div className="text-muted-foreground text-xs">
							{Math.round(market.oddsNo * 100)}¢ per share
						</div>
					</div>
				</div>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-2 gap-4">
				<div className="bg-chart-2/10 border-chart-2/20 rounded-lg border p-4">
					<div className="mb-2 flex items-center gap-2">
						<TrendingUp className="text-chart-2 h-4 w-4" />
						<span className="text-chart-2 text-sm font-medium">YES Positions</span>
					</div>
					<div className="text-2xl font-bold">Ꝟ {totalYesVolume.toLocaleString()}</div>
					<div className="text-muted-foreground text-xs">{yesPositions.length} positions</div>
				</div>
				<div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
					<div className="mb-2 flex items-center gap-2">
						<TrendingDown className="text-destructive h-4 w-4" />
						<span className="text-destructive text-sm font-medium">NO Positions</span>
					</div>
					<div className="text-2xl font-bold">Ꝟ {totalNoVolume.toLocaleString()}</div>
					<div className="text-muted-foreground text-xs">{noPositions.length} positions</div>
				</div>
			</div>

			{/* Order Book Table */}
			{depthPositions.length === 0 ? (
				<div className="text-muted-foreground rounded-lg border py-8 text-center">
					<p>No open positions yet. Be the first to trade!</p>
				</div>
			) : (
				<div className="rounded-lg border">
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
												<TrendingUp className="mr-1 h-3 w-3" />
												YES
											</Badge>
										) : (
											<Badge
												variant="outline"
												className="bg-destructive/10 text-destructive border-destructive/20"
											>
												<TrendingDown className="mr-1 h-3 w-3" />
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
