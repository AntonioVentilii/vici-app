import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, Medal, Trophy } from 'lucide-react';
import { useGetLeaderboard } from '../hooks/useQueries';

export default function LeaderboardPage() {
	const { data: leaderboard = [], isLoading } = useGetLeaderboard(50);

	const getRankIcon = (rank: number) => {
		switch (rank) {
			case 1:
				return <Trophy className="h-6 w-6 text-yellow-500" />;
			case 2:
				return <Medal className="h-6 w-6 text-gray-400" />;
			case 3:
				return <Award className="h-6 w-6 text-amber-600" />;
			default:
				return <span className="text-muted-foreground text-lg font-bold">#{rank}</span>;
		}
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="space-y-8">
				{/* Header */}
				<div className="space-y-2 text-center">
					<h1 className="text-foreground text-4xl font-bold">Leaderboard</h1>
					<p className="text-muted-foreground">Top traders by Vici Coin balance</p>
				</div>

				{/* Top 3 Podium */}
				{!isLoading && leaderboard.length >= 3 && (
					<div className="mx-auto mb-8 grid max-w-3xl grid-cols-3 gap-4">
						{/* 2nd Place */}
						<div className="flex flex-col items-center pt-12">
							<div className="relative">
								<Avatar className="h-16 w-16 border-4 border-gray-400">
									<AvatarFallback className="bg-gray-100 text-xl font-bold text-gray-600">
										2
									</AvatarFallback>
								</Avatar>
								<div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
									<Medal className="h-8 w-8 text-gray-400" />
								</div>
							</div>
							<div className="mt-4 text-center">
								<p className="text-foreground max-w-[100px] truncate text-sm font-medium">
									{leaderboard[1][0].toString().slice(0, 8)}...
								</p>
								<p className="text-foreground text-lg font-bold">
									Ꝟ {Number(leaderboard[1][1]).toLocaleString()}
								</p>
							</div>
						</div>

						{/* 1st Place */}
						<div className="flex flex-col items-center">
							<div className="relative">
								<Avatar className="h-20 w-20 border-4 border-yellow-500">
									<AvatarFallback className="bg-yellow-100 text-2xl font-bold text-yellow-600">
										1
									</AvatarFallback>
								</Avatar>
								<div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
									<Trophy className="h-10 w-10 text-yellow-500" />
								</div>
							</div>
							<div className="mt-4 text-center">
								<p className="text-foreground max-w-[100px] truncate text-sm font-medium">
									{leaderboard[0][0].toString().slice(0, 8)}...
								</p>
								<p className="text-foreground text-xl font-bold">
									Ꝟ {Number(leaderboard[0][1]).toLocaleString()}
								</p>
							</div>
						</div>

						{/* 3rd Place */}
						<div className="flex flex-col items-center pt-16">
							<div className="relative">
								<Avatar className="h-14 w-14 border-4 border-amber-600">
									<AvatarFallback className="bg-amber-100 text-lg font-bold text-amber-600">
										3
									</AvatarFallback>
								</Avatar>
								<div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
									<Award className="h-7 w-7 text-amber-600" />
								</div>
							</div>
							<div className="mt-4 text-center">
								<p className="text-foreground max-w-[100px] truncate text-sm font-medium">
									{leaderboard[2][0].toString().slice(0, 8)}...
								</p>
								<p className="text-foreground text-lg font-bold">
									Ꝟ {Number(leaderboard[2][1]).toLocaleString()}
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Full Leaderboard */}
				<Card className="mx-auto max-w-4xl">
					<CardHeader>
						<CardTitle>All Rankings</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="space-y-3">
								{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
									<Skeleton key={i} className="h-16" />
								))}
							</div>
						) : leaderboard.length > 0 ? (
							<div className="space-y-2">
								{leaderboard.map(([principal, balance], index) => (
									<div
										key={principal.toString()}
										className="hover:bg-accent/50 flex items-center justify-between rounded-lg p-4 transition-colors"
									>
										<div className="flex items-center gap-4">
											<div className="flex w-12 justify-center">{getRankIcon(index + 1)}</div>
											<Avatar className="h-10 w-10">
												<AvatarFallback>{(index + 1).toString()}</AvatarFallback>
											</Avatar>
											<div>
												<p className="text-foreground font-medium">
													{principal.toString().slice(0, 12)}...
												</p>
												<p className="text-muted-foreground text-sm">Rank #{index + 1}</p>
											</div>
										</div>
										<div className="text-right">
											<p className="text-foreground text-xl font-bold">
												Ꝟ {Number(balance).toLocaleString()}
											</p>
											<p className="text-muted-foreground text-sm">Vici Coins</p>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="text-muted-foreground py-12 text-center">
								<p>No users on the leaderboard yet.</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
