import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, ArrowUp, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PositionType } from '../backend';
import { useGetRushQueue, usePlaceTrade } from '../hooks/useQueries';

interface RushPageProps {
	onNavigate: (page: 'markets' | 'home') => void;
}

export default function RushPage({ onNavigate }: RushPageProps) {
	const { data: markets = [], isLoading } = useGetRushQueue(10);
	const placeTradeMutation = usePlaceTrade();

	const [currentIndex, setCurrentIndex] = useState(0);
	const [tradeAmount, setTradeAmount] = useState('100');
	const [touchStart, setTouchStart] = useState<number | null>(null);
	const [touchEnd, setTouchEnd] = useState<number | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	const minSwipeDistance = 50;

	const currentMarket = markets[currentIndex];

	// Handle keyboard events
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (isProcessing) return;

			if (e.key === 'ArrowRight') {
				e.preventDefault();
				handleYes();
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault();
				handleNo();
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				handleSkip();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [currentIndex, tradeAmount, isProcessing, currentMarket]);

	const onTouchStart = (e: React.TouchEvent) => {
		setTouchEnd(null);
		setTouchStart(e.targetTouches[0].clientX);
	};

	const onTouchMove = (e: React.TouchEvent) => {
		setTouchEnd(e.targetTouches[0].clientX);
	};

	const onTouchEnd = () => {
		if (!touchStart || !touchEnd || isProcessing) return;

		const distance = touchStart - touchEnd;
		const isLeftSwipe = distance > minSwipeDistance;
		const isRightSwipe = distance < -minSwipeDistance;

		if (isLeftSwipe) {
			handleNo();
		} else if (isRightSwipe) {
			handleYes();
		}
	};

	const handleYes = async () => {
		if (!currentMarket || isProcessing) return;
		await executeTrade(PositionType.yes);
	};

	const handleNo = async () => {
		if (!currentMarket || isProcessing) return;
		await executeTrade(PositionType.no);
	};

	const handleSkip = () => {
		if (isProcessing) return;
		advanceToNext();
	};

	const executeTrade = async (positionType: PositionType) => {
		if (!currentMarket) return;

		const amount = parseInt(tradeAmount);
		if (isNaN(amount) || amount <= 0) {
			toast.error('Please enter a valid trade amount');
			return;
		}

		setIsProcessing(true);

		try {
			await placeTradeMutation.mutateAsync({
				marketId: currentMarket.id,
				positionType,
				amount: BigInt(amount)
			});

			toast.success(
				`Trade placed: ${positionType === PositionType.yes ? 'YES' : 'NO'} for Ꝟ ${amount}`
			);
			advanceToNext();
		} catch (error: any) {
			const errorMessage = error?.message || 'Failed to place trade';
			toast.error(errorMessage);
		} finally {
			setIsProcessing(false);
		}
	};

	const advanceToNext = () => {
		if (currentIndex < markets.length - 1) {
			setCurrentIndex(currentIndex + 1);
		} else {
			// Reached the end
			toast.success('Rush complete! All markets reviewed.');
			onNavigate('markets');
		}
	};

	const formatDate = (timestamp: bigint) => {
		const date = new Date(Number(timestamp) / 1000000);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	};

	if (isLoading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="flex min-h-[60vh] items-center justify-center">
					<Loader2 className="text-primary h-8 w-8 animate-spin" />
				</div>
			</div>
		);
	}

	if (!markets || markets.length === 0) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6">
					<div className="space-y-2 text-center">
						<h2 className="text-foreground text-2xl font-bold">No Markets Available</h2>
						<p className="text-muted-foreground max-w-md">
							There are no eligible open markets at the moment. Check back later or browse all
							markets.
						</p>
					</div>
					<Button onClick={() => onNavigate('markets')} size="lg">
						Browse Markets
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Header with progress and exit */}
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center space-x-4">
					<h1 className="text-foreground text-2xl font-bold">Rush Mode</h1>
					<Badge variant="secondary" className="text-sm">
						{currentIndex + 1} / {markets.length}
					</Badge>
				</div>
				<Button variant="outline" onClick={() => onNavigate('markets')}>
					<X className="mr-2 h-4 w-4" />
					Exit
				</Button>
			</div>

			{/* Instructions */}
			<div className="bg-accent/50 mb-6 rounded-lg p-4">
				<p className="text-muted-foreground text-center text-sm">
					<span className="font-semibold">Swipe or use keyboard:</span> Right/→ = YES • Left/← = NO
					• Up/↑ = Skip
				</p>
			</div>

			{/* Market Card */}
			{currentMarket && (
				<div
					className="mx-auto max-w-2xl"
					onTouchStart={onTouchStart}
					onTouchMove={onTouchMove}
					onTouchEnd={onTouchEnd}
				>
					<Card className="mb-6">
						<CardHeader>
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1">
									<CardTitle className="mb-2 text-xl">{currentMarket.title}</CardTitle>
									<CardDescription className="text-sm">{currentMarket.description}</CardDescription>
								</div>
								{currentMarket.inviteOnly && (
									<Badge variant="outline" className="shrink-0">
										Invite Only
									</Badge>
								)}
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							{/* Categories */}
							{currentMarket.categories.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{currentMarket.categories.map((category, idx) => (
										<Badge key={idx} variant="secondary" className="text-xs">
											{category}
										</Badge>
									))}
								</div>
							)}

							{/* Odds Display */}
							<div className="grid grid-cols-2 gap-4">
								<div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
									<div className="text-muted-foreground mb-1 text-xs">YES Odds</div>
									<div className="text-2xl font-bold text-green-600 dark:text-green-400">
										{(currentMarket.oddsYes * 100).toFixed(0)}%
									</div>
								</div>
								<div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
									<div className="text-muted-foreground mb-1 text-xs">NO Odds</div>
									<div className="text-2xl font-bold text-red-600 dark:text-red-400">
										{(currentMarket.oddsNo * 100).toFixed(0)}%
									</div>
								</div>
							</div>

							{/* Expiration */}
							<div className="text-muted-foreground text-sm">
								Expires: {formatDate(currentMarket.expiration)}
							</div>

							{/* Trade Amount Input */}
							<div className="space-y-2">
								<Label htmlFor="trade-amount">Trade Amount (Ꝟ)</Label>
								<Input
									id="trade-amount"
									type="number"
									value={tradeAmount}
									onChange={(e) => setTradeAmount(e.target.value)}
									placeholder="100"
									min="1"
									disabled={isProcessing}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Action Buttons */}
					<div className="grid grid-cols-3 gap-4">
						<Button
							variant="destructive"
							size="lg"
							onClick={handleNo}
							disabled={isProcessing}
							className="flex h-20 flex-col items-center justify-center"
						>
							{isProcessing ? (
								<Loader2 className="h-6 w-6 animate-spin" />
							) : (
								<>
									<ArrowLeft className="mb-1 h-6 w-6" />
									<span className="text-sm">NO</span>
								</>
							)}
						</Button>

						<Button
							variant="outline"
							size="lg"
							onClick={handleSkip}
							disabled={isProcessing}
							className="flex h-20 flex-col items-center justify-center"
						>
							<ArrowUp className="mb-1 h-6 w-6" />
							<span className="text-sm">Skip</span>
						</Button>

						<Button
							variant="default"
							size="lg"
							onClick={handleYes}
							disabled={isProcessing}
							className="flex h-20 flex-col items-center justify-center bg-green-600 hover:bg-green-700"
						>
							{isProcessing ? (
								<Loader2 className="h-6 w-6 animate-spin" />
							) : (
								<>
									<ArrowRight className="mb-1 h-6 w-6" />
									<span className="text-sm">YES</span>
								</>
							)}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
