import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Coins, TrendingUp, Award, Shield, Clock, Users, BarChart3, ArrowRight } from 'lucide-react';
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
      <section className="relative w-full border-b border-border overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/assets/generated/hero-banner.dim_1200x400.png)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50" />
        </div>
        <div className="relative container mx-auto px-4 py-16 md:py-24 lg:py-28">
          <div className="max-w-2xl space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight drop-shadow-lg">
              Predict. Trade. Win.
            </h1>
            <p className="text-lg md:text-xl text-white/95 drop-shadow-md">
              Vici is a prediction market where you can trade on real-world events. Buy and sell predictions using Vici Coins (Ꝟ).
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" onClick={() => onNavigate('markets')} className="font-semibold shadow-lg">
                Explore Markets
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-b border-border bg-accent/5">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="rounded-full bg-chart-2/10 p-4">
                  <TrendingUp className="h-8 w-8 text-chart-2" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">{openMarkets.length}</div>
              <div className="text-sm text-muted-foreground">Active Markets</div>
            </div>
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="rounded-full bg-chart-1/10 p-4">
                  <BarChart3 className="h-8 w-8 text-chart-1" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">Ꝟ 1,000</div>
              <div className="text-sm text-muted-foreground">Starting Coins</div>
            </div>
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="rounded-full bg-chart-3/10 p-4">
                  <Clock className="h-8 w-8 text-chart-3" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">24/7</div>
              <div className="text-sm text-muted-foreground">Trading Available</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="bg-accent/5 border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-foreground">Why Trade on Vici?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Experience the power of prediction markets
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <TrendingUp className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-foreground">Prediction Markets</h3>
              <p className="text-muted-foreground">
                Trade on real-world events and outcomes. Markets aggregate collective knowledge to forecast the future.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Coins className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-foreground">Simple Trading</h3>
              <p className="text-muted-foreground">
                Buy YES or NO positions with Vici Coins. Easy to understand, exciting to trade, rewarding to win.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Users className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-foreground">Community Driven</h3>
              <p className="text-muted-foreground">
                Join a community of traders. Discuss markets, share insights, and compete on the leaderboard.
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
            <h2 className="text-3xl font-bold text-foreground mb-6 text-center">Key Concepts</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <Coins className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Vici Coins</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Vici Coins are the currency used to trade on prediction markets. New users start with 1,000 coins.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <TrendingUp className="h-10 w-10 text-chart-2 mb-2" />
                  <CardTitle>Market Odds</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Odds represent the market's prediction. Higher odds mean higher potential returns but lower probability.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Award className="h-10 w-10 text-chart-1 mb-2" />
                  <CardTitle>Payouts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    When a market resolves, winning positions receive payouts based on the amount invested and odds.
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
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Browse Markets</h3>
                      <p className="text-sm text-muted-foreground">
                        Explore available prediction markets on topics you're interested in or knowledgeable about.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Choose Your Position</h3>
                      <p className="text-sm text-muted-foreground">
                        Decide whether you think the outcome will be YES or NO. Check the current odds before trading.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Place Your Trade</h3>
                      <p className="text-sm text-muted-foreground">
                        Enter the amount of Vici Coins you want to invest and confirm your trade.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      4
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Track Your Position</h3>
                      <p className="text-sm text-muted-foreground">
                        Monitor your open positions in your portfolio. Watch as market odds change over time.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      5
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Wait for Resolution</h3>
                      <p className="text-sm text-muted-foreground">
                        Markets resolve when the outcome is determined. This happens after the expiration date.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      6
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Collect Winnings</h3>
                      <p className="text-sm text-muted-foreground">
                        If your prediction was correct, you'll automatically receive your payout in Vici Coins.
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
                    Vici Coins are the virtual currency used on the Vici platform. Every new user receives 1,000 Vici
                    Coins to start trading. You can use them to buy positions in prediction markets and earn more by
                    making correct predictions.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>How do market odds work?</AccordionTrigger>
                  <AccordionContent>
                    Market odds represent the price to buy a position. For example, if YES is trading at 60¢, you pay 60
                    Vici Coins for a position that pays 100 coins if YES wins. The odds reflect the market's collective
                    prediction about the outcome.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>When do I get paid?</AccordionTrigger>
                  <AccordionContent>
                    Payouts are automatically distributed when a market is resolved by an admin. If your prediction was
                    correct, you'll receive your winnings immediately. The payout amount depends on your investment and
                    the odds at which you bought your position.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger>Can I sell my positions?</AccordionTrigger>
                  <AccordionContent>
                    Currently, positions cannot be sold before market resolution. Once you buy a position, you hold it
                    until the market resolves. This feature may be added in future updates.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5">
                  <AccordionTrigger>What happens if a market is closed?</AccordionTrigger>
                  <AccordionContent>
                    When a market closes, no new trades can be placed. The market remains closed until an admin resolves
                    it by declaring the outcome. Once resolved, all winning positions receive their payouts automatically.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-6">
                  <AccordionTrigger>How is the leaderboard calculated?</AccordionTrigger>
                  <AccordionContent>
                    The leaderboard ranks users by their total Vici Coin balance. This includes your starting coins, any
                    winnings from resolved markets, and coins granted by admins, minus any coins spent on trades.
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
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex gap-3">
                  <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Start Small</h3>
                    <p className="text-sm text-muted-foreground">
                      Begin with smaller trades to learn how the platform works before investing larger amounts.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Clock className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Check Expiration Dates</h3>
                    <p className="text-sm text-muted-foreground">
                      Always review when a market expires. Markets expiring soon may have more certain outcomes.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <TrendingUp className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Follow the Trends</h3>
                    <p className="text-sm text-muted-foreground">
                      Watch how odds change over time. Significant shifts may indicate new information or sentiment.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Users className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Engage with Community</h3>
                    <p className="text-sm text-muted-foreground">
                      Read market discussions and share your insights. Community knowledge can help inform your trades.
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
