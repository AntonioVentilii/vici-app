<script lang="ts">
	import { markets } from '../stores/markets';
	import Card from '../components/ui/Card.svelte';
	import Button from '../components/ui/Button.svelte';
	import Accordion from '../components/ui/Accordion.svelte';
	import {
		Coins,
		TrendingUp,
		Award,
		Shield,
		Clock,
		Users,
		BarChart3,
		ArrowRight
	} from 'lucide-svelte';

	export let onNavigate: (page: string) => void;

	$: openMarketsCount = $markets.markets.filter((m) => m.status === 'open').length;
</script>

<div class="w-full">
	<!-- Hero Banner -->
	<section class="border-border relative w-full overflow-hidden border-b">
		<div
			class="absolute inset-0 bg-cover bg-center"
			style="background-image: url(/assets/generated/hero-banner.dim_1200x400.png)"
		>
			<div class="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50" />
		</div>
		<div class="relative container mx-auto px-4 py-16 md:py-24 lg:py-28">
			<div class="max-w-2xl space-y-6 text-white">
				<h1 class="text-4xl leading-tight font-bold drop-shadow-lg md:text-5xl lg:text-6xl">
					Predict. Trade. Win.
				</h1>
				<p class="text-lg text-white/95 drop-shadow-md md:text-xl">
					Vici is a prediction market where you can trade on real-world events. Buy and sell
					predictions using Vici Coins (Ꝟ).
				</p>
				<div class="flex flex-wrap gap-3 pt-2">
					<Button
						size="lg"
						on:click={() => onNavigate('markets')}
						class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
					>
						Explore Markets
						<ArrowRight size={20} class="ml-2" />
					</Button>
				</div>
			</div>
		</div>
	</section>

	<!-- Stats Section -->
	<section class="border-border border-b bg-slate-50/50">
		<div class="container mx-auto px-4 py-12">
			<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
				<div class="space-y-2 text-center">
					<div class="flex justify-center">
						<div class="rounded-full bg-blue-100 p-4">
							<TrendingUp size={32} class="text-blue-600" />
						</div>
					</div>
					<div class="text-foreground text-3xl font-bold">
						{openMarketsCount}
					</div>
					<div class="text-muted-foreground text-sm">Active Markets</div>
				</div>
				<div class="space-y-2 text-center">
					<div class="flex justify-center">
						<div class="rounded-full bg-orange-100 p-4">
							<BarChart3 size={32} class="text-orange-600" />
						</div>
					</div>
					<div class="text-foreground text-3xl font-bold">Ꝟ 1,000</div>
					<div class="text-muted-foreground text-sm">Starting Coins</div>
				</div>
				<div class="space-y-2 text-center">
					<div class="flex justify-center">
						<div class="rounded-full bg-green-100 p-4">
							<Clock size={32} class="text-green-600" />
						</div>
					</div>
					<div class="text-foreground text-3xl font-bold">24/7</div>
					<div class="text-muted-foreground text-sm">Trading Available</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Feature Highlights -->
	<section class="border-border border-b bg-slate-50">
		<div class="container mx-auto px-4 py-16">
			<div class="mb-12 space-y-4 text-center">
				<h2 class="text-foreground text-3xl font-bold">Why Trade on Vici?</h2>
				<p class="text-muted-foreground mx-auto max-w-2xl">
					Experience the power of prediction markets
				</p>
			</div>

			<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
				<div
					class="space-y-4 rounded-xl border border-slate-100 bg-white p-6 text-center shadow-sm"
				>
					<div class="flex justify-center">
						<div class="bg-primary/10 rounded-full p-4">
							<TrendingUp size={40} class="text-primary" />
						</div>
					</div>
					<h3 class="text-foreground text-xl font-semibold">Prediction Markets</h3>
					<p class="text-muted-foreground">
						Trade on real-world events and outcomes. Markets aggregate collective knowledge to
						forecast the future.
					</p>
				</div>

				<div
					class="space-y-4 rounded-xl border border-slate-100 bg-white p-6 text-center shadow-sm"
				>
					<div class="flex justify-center">
						<div class="bg-primary/10 rounded-full p-4">
							<Coins size={40} class="text-primary" />
						</div>
					</div>
					<h3 class="text-foreground text-xl font-semibold">Simple Trading</h3>
					<p class="text-muted-foreground">
						Buy YES or NO positions with Vici Coins. Easy to understand, exciting to trade,
						rewarding to win.
					</p>
				</div>

				<div
					class="space-y-4 rounded-xl border border-slate-100 bg-white p-6 text-center shadow-sm"
				>
					<div class="flex justify-center">
						<div class="bg-primary/10 rounded-full p-4">
							<Users size={40} class="text-primary" />
						</div>
					</div>
					<h3 class="text-foreground text-xl font-semibold">Community Driven</h3>
					<p class="text-muted-foreground">
						Join a community of traders. Discuss markets, share insights, and compete on the
						leaderboard.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Educational Content -->
	<div class="container mx-auto px-4 py-12">
		<div class="space-y-12">
			<!-- Key Concepts -->
			<div>
				<h2 class="text-foreground mb-8 text-center text-3xl font-bold">Key Concepts</h2>
				<div class="grid gap-6 md:grid-cols-3">
					<Card>
						<div class="p-6">
							<Coins size={40} class="text-primary mb-4" />
							<h3 class="mb-2 text-xl font-bold">Vici Coins</h3>
							<p class="text-muted-foreground">
								Vici Coins are the currency used to trade on prediction markets. New users start
								with 1,000 coins.
							</p>
						</div>
					</Card>

					<Card>
						<div class="p-6">
							<TrendingUp size={40} class="mb-4 text-blue-600" />
							<h3 class="mb-2 text-xl font-bold">Market Odds</h3>
							<p class="text-muted-foreground">
								Odds represent the market's prediction. Higher odds mean higher potential returns
								but lower probability.
							</p>
						</div>
					</Card>

					<Card>
						<div class="p-6">
							<Award size={40} class="mb-4 text-orange-600" />
							<h3 class="mb-2 text-xl font-bold">Payouts</h3>
							<p class="text-muted-foreground">
								When a market resolves, winning positions receive payouts based on the amount
								invested and odds.
							</p>
						</div>
					</Card>
				</div>
			</div>

			<!-- How to Trade -->
			<Card>
				<div class="space-y-6 p-6 md:p-8">
					<h2 class="text-2xl font-bold">How to Trade</h2>
					<div class="grid gap-8 md:grid-cols-2">
						<div class="space-y-4">
							<div class="flex gap-4">
								<div
									class="bg-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
								>
									1
								</div>
								<div>
									<h3 class="text-foreground mb-1 font-semibold">Browse Markets</h3>
									<p class="text-muted-foreground text-sm">
										Explore available prediction markets on topics you're interested in or
										knowledgeable about.
									</p>
								</div>
							</div>

							<div class="flex gap-4">
								<div
									class="bg-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
								>
									2
								</div>
								<div>
									<h3 class="text-foreground mb-1 font-semibold">Choose Your Position</h3>
									<p class="text-muted-foreground text-sm">
										Decide whether you think the outcome will be YES or NO. Check the current odds
										before trading.
									</p>
								</div>
							</div>

							<div class="flex gap-4">
								<div
									class="bg-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
								>
									3
								</div>
								<div>
									<h3 class="text-foreground mb-1 font-semibold">Place Your Trade</h3>
									<p class="text-muted-foreground text-sm">
										Enter the amount of Vici Coins you want to invest and confirm your trade.
									</p>
								</div>
							</div>
						</div>

						<div class="space-y-4">
							<div class="flex gap-4">
								<div
									class="bg-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
								>
									4
								</div>
								<div>
									<h3 class="text-foreground mb-1 font-semibold">Track Your Position</h3>
									<p class="text-muted-foreground text-sm">
										Monitor your open positions in your portfolio. Watch as market odds change over
										time.
									</p>
								</div>
							</div>

							<div class="flex gap-4">
								<div
									class="bg-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
								>
									5
								</div>
								<div>
									<h3 class="text-foreground mb-1 font-semibold">Wait for Resolution</h3>
									<p class="text-muted-foreground text-sm">
										Markets resolve when the outcome is determined. This happens after the
										expiration date.
									</p>
								</div>
							</div>

							<div class="flex gap-4">
								<div
									class="bg-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
								>
									6
								</div>
								<div>
									<h3 class="text-foreground mb-1 font-semibold">Collect Winnings</h3>
									<p class="text-muted-foreground text-sm">
										If your prediction was correct, you'll automatically receive your payout in Vici
										Coins.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</Card>

			<!-- FAQ -->
			<Card>
				<div class="space-y-6 p-6 md:p-8">
					<h2 class="text-2xl font-bold">Frequently Asked Questions</h2>
					<div class="divide-border divide-y">
						<Accordion title="What are Vici Coins?">
							Vici Coins are the virtual currency used on the Vici platform. Every new user receives
							1,000 Vici Coins to start trading. You can use them to buy positions in prediction
							markets and earn more by making correct predictions.
						</Accordion>

						<Accordion title="How do market odds work?">
							Market odds represent the price to buy a position. For example, if YES is trading at
							60¢, you pay 60 Vici Coins for a position that pays 100 coins if YES wins. The odds
							reflect the market's collective prediction about the outcome.
						</Accordion>

						<Accordion title="When do I get paid?">
							Payouts are automatically distributed when a market is resolved by an admin. If your
							prediction was correct, you'll receive your winnings immediately. The payout amount
							depends on your investment and the odds at which you bought your position.
						</Accordion>

						<Accordion title="Can I sell my positions?">
							Currently, positions cannot be sold before market resolution. Once you buy a position,
							you hold it until the market resolves. This feature may be added in future updates.
						</Accordion>

						<Accordion title="What happens if a market is closed?">
							When a market closes, no new trades can be placed. The market remains closed until an
							admin resolves it by declaring the outcome. Once resolved, all winning positions
							receive their payouts automatically.
						</Accordion>

						<Accordion title="How is the leaderboard calculated?">
							The leaderboard ranks users by their total Vici Coin balance. This includes your
							starting coins, any winnings from resolved markets, and coins granted by admins, minus
							any coins spent on trades.
						</Accordion>
					</div>
				</div>
			</Card>

			<!-- Trading Tips -->
			<Card>
				<div class="p-6 md:p-8">
					<h2 class="mb-6 text-2xl font-bold">Trading Tips</h2>
					<div class="grid gap-8 md:grid-cols-2">
						<div class="flex gap-4">
							<Shield size={24} class="text-primary mt-1 shrink-0" />
							<div>
								<h3 class="text-foreground mb-1 font-semibold">Start Small</h3>
								<p class="text-muted-foreground text-sm">
									Begin with smaller trades to learn how the platform works before investing larger
									amounts.
								</p>
							</div>
						</div>

						<div class="flex gap-4">
							<Clock size={24} class="text-primary mt-1 shrink-0" />
							<div>
								<h3 class="text-foreground mb-1 font-semibold">Check Expiration Dates</h3>
								<p class="text-muted-foreground text-sm">
									Always review when a market expires. Markets expiring soon may have more certain
									outcomes.
								</p>
							</div>
						</div>

						<div class="flex gap-4">
							<TrendingUp size={24} class="text-primary mt-1 shrink-0" />
							<div>
								<h3 class="text-foreground mb-1 font-semibold">Follow the Trends</h3>
								<p class="text-muted-foreground text-sm">
									Watch how odds change over time. Significant shifts may indicate new information
									or sentiment.
								</p>
							</div>
						</div>

						<div class="flex gap-4">
							<Users size={24} class="text-primary mt-1 shrink-0" />
							<div>
								<h3 class="text-foreground mb-1 font-semibold">Engage with Community</h3>
								<p class="text-muted-foreground text-sm">
									Read market discussions and share your insights. Community knowledge can help
									inform your trades.
								</p>
							</div>
						</div>
					</div>
				</div>
			</Card>
		</div>
	</div>
</div>
