import { useGetMarketAnalytics } from '../hooks/useQueries';
import { Skeleton } from '@/components/ui/skeleton';
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer
} from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface MarketAnalyticsChartProps {
	marketId: bigint;
}

export default function MarketAnalyticsChart({ marketId }: MarketAnalyticsChartProps) {
	const { data: analytics = [], isLoading } = useGetMarketAnalytics(marketId);

	if (isLoading) {
		return <Skeleton className="h-80 w-full" />;
	}

	if (analytics.length === 0) {
		return (
			<div className="text-muted-foreground py-12 text-center">
				<p>No analytics data available yet.</p>
			</div>
		);
	}

	const chartData = analytics.map((point) => ({
		time: new Date(Number(point.timestamp) / 1000000).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit'
		}),
		volume: Number(point.volume),
		yesOdds: Math.round(point.oddsYes * 100),
		noOdds: Math.round(point.oddsNo * 100)
	}));

	return (
		<Tabs defaultValue="odds" className="w-full">
			<TabsList className="grid w-full grid-cols-2">
				<TabsTrigger value="odds">Odds Trends</TabsTrigger>
				<TabsTrigger value="volume">Volume</TabsTrigger>
			</TabsList>

			<TabsContent value="odds" className="mt-4">
				<ResponsiveContainer width="100%" height={300}>
					<LineChart data={chartData}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
						<XAxis
							dataKey="time"
							className="text-xs"
							tick={{ fill: 'hsl(var(--muted-foreground))' }}
						/>
						<YAxis
							className="text-xs"
							tick={{ fill: 'hsl(var(--muted-foreground))' }}
							label={{ value: 'Odds (¢)', angle: -90, position: 'insideLeft' }}
						/>
						<Tooltip
							contentStyle={{
								backgroundColor: 'hsl(var(--popover))',
								border: '1px solid hsl(var(--border))',
								borderRadius: '0.5rem'
							}}
						/>
						<Legend />
						<Line
							type="monotone"
							dataKey="yesOdds"
							stroke="hsl(var(--chart-2))"
							strokeWidth={2}
							name="YES Odds"
							dot={false}
						/>
						<Line
							type="monotone"
							dataKey="noOdds"
							stroke="hsl(var(--destructive))"
							strokeWidth={2}
							name="NO Odds"
							dot={false}
						/>
					</LineChart>
				</ResponsiveContainer>
			</TabsContent>

			<TabsContent value="volume" className="mt-4">
				<ResponsiveContainer width="100%" height={300}>
					<BarChart data={chartData}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
						<XAxis
							dataKey="time"
							className="text-xs"
							tick={{ fill: 'hsl(var(--muted-foreground))' }}
						/>
						<YAxis
							className="text-xs"
							tick={{ fill: 'hsl(var(--muted-foreground))' }}
							label={{ value: 'Volume (Ꝟ)', angle: -90, position: 'insideLeft' }}
						/>
						<Tooltip
							contentStyle={{
								backgroundColor: 'hsl(var(--popover))',
								border: '1px solid hsl(var(--border))',
								borderRadius: '0.5rem'
							}}
						/>
						<Legend />
						<Bar
							dataKey="volume"
							fill="hsl(var(--chart-1))"
							name="Trading Volume"
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
			</TabsContent>
		</Tabs>
	);
}
