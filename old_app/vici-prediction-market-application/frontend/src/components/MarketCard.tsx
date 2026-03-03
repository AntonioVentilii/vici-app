import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Lock } from 'lucide-react';
import { MarketSnapshot, MarketStatus } from '../backend';

interface MarketCardProps {
	market: MarketSnapshot;
	onViewMarket: (marketId: bigint) => void;
}

export default function MarketCard({ market, onViewMarket }: MarketCardProps) {
	const getStatusBadge = (status: MarketStatus) => {
		switch (status) {
			case MarketStatus.open:
				return (
					<Badge variant="default" className="bg-chart-2">
						Open
					</Badge>
				);
			case MarketStatus.closed:
				return <Badge variant="secondary">Closed</Badge>;
			case MarketStatus.resolved:
				return <Badge variant="outline">Resolved</Badge>;
		}
	};

	const formatDate = (timestamp: bigint) => {
		const date = new Date(Number(timestamp) / 1000000);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	};

	const isExpiringSoon = () => {
		const now = Date.now() * 1000000;
		const timeLeft = Number(market.expiration) - now;
		const daysLeft = timeLeft / (1000000 * 1000 * 60 * 60 * 24);
		return daysLeft < 7 && daysLeft > 0;
	};

	return (
		<Card
			className="hover:shadow-lg transition-shadow cursor-pointer group"
			onClick={() => onViewMarket(market.id)}
		>
			<CardHeader className="space-y-3">
				<div className="flex items-start justify-between gap-2">
					<CardTitle className="text-lg font-semibold leading-tight group-hover:text-primary transition-colors">
						{market.title}
					</CardTitle>
					<div className="flex gap-1">
						{getStatusBadge(market.status)}
						{market.inviteOnly && (
							<Badge variant="outline" className="gap-1">
								<Lock className="h-3 w-3" />
							</Badge>
						)}
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					{market.categories.map((category, idx) => (
						<Badge key={idx} variant="secondary" className="text-xs">
							{category}
						</Badge>
					))}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-muted-foreground line-clamp-2">{market.description}</p>

				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1">
						<div className="text-xs text-muted-foreground">Yes</div>
						<div className="text-2xl font-bold text-chart-2">
							{Math.round(market.oddsYes * 100)}¢
						</div>
					</div>
					<div className="space-y-1">
						<div className="text-xs text-muted-foreground">No</div>
						<div className="text-2xl font-bold text-destructive">
							{Math.round(market.oddsNo * 100)}¢
						</div>
					</div>
				</div>

				<div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
					<div className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						<span>{formatDate(market.expiration)}</span>
					</div>
					{isExpiringSoon() && (
						<Badge variant="outline" className="text-xs border-destructive text-destructive">
							Expiring Soon
						</Badge>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
