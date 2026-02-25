import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
	Coins,
	TrendingUp,
	Award,
	Shield,
	Clock,
	Users,
	BarChart3,
	ArrowRight
} from 'lucide-react';
import { useGetAllMarkets } from '../hooks/useQueries';
import { MarketStatus } from '../backend';
import type { Page } from '../App';

interface LearnPageProps {
	onNavigate: (page: Page) => void;
}

export default function LearnPage({ onNavigate }: LearnPageProps) {
	const { data: markets = [] } = useGetAllMarkets();
	const openMarkets = markets.filter((m) => m.status === MarketStatus.open);

	return (
		<div className="w-full">
			{/* Hero Banner */}
			<section className="border-border relative w-full overflow-hidden border-b">
				<div
					className="absolute inset-0 bg-cover bg-center"
					style={{ backgroundImage: 'url(/assets/generated/hero-banner.dim_1200x400.png)' }}
				>
					<div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50" />
				</div>
				<div className="relative container mx-auto px-4 py-16 md:py-24 lg:py-28">
					<div className="max-w-2xl space-y-6">
						<h1 className="text-4xl leading-tight font-bold text-white drop-shadow-lg md:text-5xl lg:text-6xl">
							Predict. Trade. Win.
						</h1>
						<p className="text-lg text-white/95 drop-shadow-md md:text-xl">
							Vici is a prediction market where you can trade on real-world events. Buy and sell
							predictions using Vici Coins (Ꝟ).
						</p>
						<div className="flex flex-wrap gap-3 pt-2">
							<Button
								size="lg"
								onClick={() => onNavigate('markets')}
								className="font-semibold shadow-lg"
							>
								Explore Markets
								<ArrowRight className="ml-2 h-5 w-5" />
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Stats Section */}
			<section className="border-border bg-accent/5 border-b">
				<div className="container mx-auto px-4 py-12">
					<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
						<div className="space-y-2 text-center">
							<div className="flex justify-center">
								<div className="bg-chart-2/10 rounded-full p-4">
									<TrendingUp className="text-chart-2 h-8 w-8" />
								</div>
							</div>
							<div className="text-foreground text-3xl font-bold">{openMarkets.length}</div>
							<div className="text-muted-foreground text-sm">Active Markets</div>
						</div>
						<div className="space-y-2 text-center">
							<div className="flex justify-center">
								<div className="bg-chart-1/10 rounded-full p-4">
									<BarChart3 className="text-chart-1 h-8 w-8" />
								</div>
							</div>
							<div className="text-foreground text-3xl font-bold">Ꝟ 1,000</div>
							<div className="text-muted-foreground text-sm">Starting Coins</div>
						</div>
						<div className="space-y-2 text-center">
							<div className="flex justify-center">
								<div className="bg-chart-3/10 rounded-full p-4">
									<Clock className="text-chart-3 h-8 w-8" />
								</div>
							</div>
							<div className="text-foreground text-3xl font-bold">24/7</div>
							<div className="text-muted-foreground text-sm">Trading Available</div>
						</div>
					</div>
				</div>
			</section>

			{/* Feature Highlights */}
			<section className="bg-accent/5 border-border border-b">
				<div className="container mx-auto px-4 py-16">
					<div className="mb-12 space-y-4 text-center">
						<h2 className="text-foreground text-3xl font-bold">Why Trade on Vici?</h2>
						<p className="text-muted-foreground mx-auto max-w-2xl">
							Experience the power of prediction markets
						</p>
					</div>

					<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
						<div className="space-y-4 text-center">
							<div className="flex justify-center">
								<div className="bg-primary/10 rounded-full p-4">
									<TrendingUp className="text-primary h-10 w-10" />
								</div>
							</div>
							<h3 className="text-foreground text-xl font-semibold">Prediction Markets</h3>
							<p className="text-muted-foreground">
								Trade on real-world events and outcomes. Markets aggregate collective knowledge to
								forecast the future.
							</p>
						</div>

						<div className="space-y-4 text-center">
							<div className="flex justify-center">
								<div className="bg-primary/10 rounded-full p-4">
									<Coins className="text-primary h-10 w-10" />
								</div>
							</div>
							<h3 className="text-foreground text-xl font-semibold">Simple Trading</h3>
							<p className="text-muted-foreground">
								Buy YES or NO positions with Vici Coins. Easy to understand, exciting to trade,
								rewarding to win.
							</p>
						</div>

						<div className="space-y-4 text-center">
							<div className="flex justify-center">
								<div className="bg-primary/10 rounded-full p-4">
									<Users className="text-primary h-10 w-10" />
								</div>
							</div>
							<h3 className="text-foreground text-xl font-semibold">Community Driven</h3>
							<p className="text-muted-foreground">
								Join a community of traders. Discuss markets, share insights, and compete on the
								leaderboard.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Educational Content */}
			<div className="container mx-auto px-4 py-12">
				<div className="space-y-12">
					{/* Key Concepts */}
					<div>
						<h2 className="text-foreground mb-6 text-center text-3xl font-bold">Key Concepts</h2>
						<div className="grid gap-6 md:grid-cols-3">
							<Card>
								<CardHeader>
									<Coins className="text-primary mb-2 h-10 w-10" />
									<CardTitle>Vici Coins</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground">
										Vici Coins are the currency used to trade on prediction markets. New users start
										with 1,000 coins.
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<TrendingUp className="text-chart-2 mb-2 h-10 w-10" />
									<CardTitle>Market Odds</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground">
										Odds represent the market's prediction. Higher odds mean higher potential
										returns but lower probability.
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<Award className="text-chart-1 mb-2 h-10 w-10" />
									<CardTitle>Payouts</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground">
										When a market resolves, winning positions receive payouts based on the amount
										invested and odds.
									</p>
								</CardContent>
							</Card>
						</div>
					</div>

					{/* How to Trade */}
					<Card>
						<CardHeader>
							<CardTitle className="text-2xl">How to Trade</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid gap-8 md:grid-cols-2">
								<div className="space-y-4">
									<div className="flex gap-4">
										<div className="bg-primary text-primary-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold">
											1
										</div>
										<div>
											<h3 className="text-foreground mb-1 font-semibold">Browse Markets</h3>
											<p className="text-muted-foreground text-sm">
												Explore available prediction markets on topics you're interested in or
												knowledgeable about.
											</p>
										</div>
									</div>

									<div className="flex gap-4">
										<div className="bg-primary text-primary-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold">
											2
										</div>
										<div>
											<h3 className="text-foreground mb-1 font-semibold">Choose Your Position</h3>
											<p className="text-muted-foreground text-sm">
												Decide whether you think the outcome will be YES or NO. Check the current
												odds before trading.
											</p>
										</div>
									</div>

									<div className="flex gap-4">
										<div className="bg-primary text-primary-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold">
											3
										</div>
										<div>
											<h3 className="text-foreground mb-1 font-semibold">Place Your Trade</h3>
											<p className="text-muted-foreground text-sm">
												Enter the amount of Vici Coins you want to invest and confirm your trade.
											</p>
										</div>
									</div>
								</div>

								<div className="space-y-4">
									<div className="flex gap-4">
										<div className="bg-primary text-primary-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold">
											4
										</div>
										<div>
											<h3 className="text-foreground mb-1 font-semibold">Track Your Position</h3>
											<p className="text-muted-foreground text-sm">
												Monitor your open positions in your portfolio. Watch as market odds change
												over time.
											</p>
										</div>
									</div>

									<div className="flex gap-4">
										<div className="bg-primary text-primary-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold">
											5
										</div>
										<div>
											<h3 className="text-foreground mb-1 font-semibold">Wait for Resolution</h3>
											<p className="text-muted-foreground text-sm">
												Markets resolve when the outcome is determined. This happens after the
												expiration date.
											</p>
										</div>
									</div>

									<div className="flex gap-4">
										<div className="bg-primary text-primary-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold">
											6
										</div>
										<div>
											<h3 className="text-foreground mb-1 font-semibold">Collect Winnings</h3>
											<p className="text-muted-foreground text-sm">
												If your prediction was correct, you'll automatically receive your payout in
												Vici Coins.
											</p>
										</div>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* FAQ */}
					<Card>
						<CardHeader>
							<CardTitle className="text-2xl">Frequently Asked Questions</CardTitle>
						</CardHeader>
						<CardContent>
							<Accordion type="single" collapsible className="w-full">
								<AccordionItem value="item-1">
									<AccordionTrigger>What are Vici Coins?</AccordionTrigger>
									<AccordionContent>
										Vici Coins are the virtual currency used on the Vici platform. Every new user
										receives 1,000 Vici Coins to start trading. You can use them to buy positions in
										prediction markets and earn more by making correct predictions.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-2">
									<AccordionTrigger>How do market odds work?</AccordionTrigger>
									<AccordionContent>
										Market odds represent the price to buy a position. For example, if YES is
										trading at 60¢, you pay 60 Vici Coins for a position that pays 100 coins if YES
										wins. The odds reflect the market's collective prediction about the outcome.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-3">
									<AccordionTrigger>When do I get paid?</AccordionTrigger>
									<AccordionContent>
										Payouts are automatically distributed when a market is resolved by an admin. If
										your prediction was correct, you'll receive your winnings immediately. The
										payout amount depends on your investment and the odds at which you bought your
										position.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-4">
									<AccordionTrigger>Can I sell my positions?</AccordionTrigger>
									<AccordionContent>
										Currently, positions cannot be sold before market resolution. Once you buy a
										position, you hold it until the market resolves. This feature may be added in
										future updates.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-5">
									<AccordionTrigger>What happens if a market is closed?</AccordionTrigger>
									<AccordionContent>
										When a market closes, no new trades can be placed. The market remains closed
										until an admin resolves it by declaring the outcome. Once resolved, all winning
										positions receive their payouts automatically.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-6">
									<AccordionTrigger>How is the leaderboard calculated?</AccordionTrigger>
									<AccordionContent>
										The leaderboard ranks users by their total Vici Coin balance. This includes your
										starting coins, any winnings from resolved markets, and coins granted by admins,
										minus any coins spent on trades.
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						</CardContent>
					</Card>

					{/* Trading Tips */}
					<Card>
						<CardHeader>
							<CardTitle className="text-2xl">Trading Tips</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid gap-6 md:grid-cols-2">
								<div className="flex gap-3">
									<Shield className="text-primary mt-1 h-6 w-6 flex-shrink-0" />
									<div>
										<h3 className="text-foreground mb-1 font-semibold">Start Small</h3>
										<p className="text-muted-foreground text-sm">
											Begin with smaller trades to learn how the platform works before investing
											larger amounts.
										</p>
									</div>
								</div>

								<div className="flex gap-3">
									<Clock className="text-primary mt-1 h-6 w-6 flex-shrink-0" />
									<div>
										<h3 className="text-foreground mb-1 font-semibold">Check Expiration Dates</h3>
										<p className="text-muted-foreground text-sm">
											Always review when a market expires. Markets expiring soon may have more
											certain outcomes.
										</p>
									</div>
								</div>

								<div className="flex gap-3">
									<TrendingUp className="text-primary mt-1 h-6 w-6 flex-shrink-0" />
									<div>
										<h3 className="text-foreground mb-1 font-semibold">Follow the Trends</h3>
										<p className="text-muted-foreground text-sm">
											Watch how odds change over time. Significant shifts may indicate new
											information or sentiment.
										</p>
									</div>
								</div>

								<div className="flex gap-3">
									<Users className="text-primary mt-1 h-6 w-6 flex-shrink-0" />
									<div>
										<h3 className="text-foreground mb-1 font-semibold">Engage with Community</h3>
										<p className="text-muted-foreground text-sm">
											Read market discussions and share your insights. Community knowledge can help
											inform your trades.
										</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
