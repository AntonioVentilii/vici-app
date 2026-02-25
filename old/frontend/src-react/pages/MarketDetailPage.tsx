import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Principal } from '@icp-sdk/core/principal';
import {
	ArrowLeft,
	BarChart2,
	Clock,
	Info,
	Lock,
	LogIn,
	MessageSquare,
	TrendingDown,
	TrendingUp,
	UserPlus,
	Users
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MarketStatus, PositionType } from '../backend';
import MarketAnalyticsChart from '../components/MarketAnalyticsChart';
import MarketDepthPanel from '../components/MarketDepthPanel';
import MarketDiscussion from '../components/MarketDiscussion';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import {
	useGetCallerUserProfile,
	useGetFriendsList,
	useGetInvitedUsers,
	useGetMarket,
	useGetUserProfile,
	useInviteUsers,
	useIsCallerAdmin,
	usePlaceTrade
} from '../hooks/useQueries';

interface MarketDetailPageProps {
	marketId: bigint;
	onBack: () => void;
}

export default function MarketDetailPage({ marketId, onBack }: MarketDetailPageProps) {
	const { data: market, isLoading } = useGetMarket(marketId);
	const { data: userProfile } = useGetCallerUserProfile();
	const { data: invitedUsers = [] } = useGetInvitedUsers(marketId);
	const { data: friendsList = [] } = useGetFriendsList();
	const { identity, login } = useInternetIdentity();
	const { data: isAdmin = false } = useIsCallerAdmin();
	const placeTrade = usePlaceTrade();
	const inviteUsers = useInviteUsers();

	const [tradeAmount, setTradeAmount] = useState('');
	const [selectedPosition, setSelectedPosition] = useState<'yes' | 'no'>('yes');
	const [invitePrincipal, setInvitePrincipal] = useState('');
	const [selectedFriend, setSelectedFriend] = useState<string>('');

	const isAuthenticated = !!identity;
	const callerPrincipal = identity?.getPrincipal();
	const isInvited = market?.inviteOnly
		? invitedUsers.some((p) => p.toString() === callerPrincipal?.toString())
		: true;
	const isCreator = market?.createdBy.toString() === callerPrincipal?.toString();
	const canManageInvites = market?.inviteOnly && (isCreator || isAdmin);

	const handleLoginPrompt = async () => {
		try {
			await login();
		} catch (error: any) {
			console.error('Login error:', error);
			toast.error('Failed to login. Please try again.');
		}
	};

	const handleTrade = async () => {
		if (!market || !userProfile) return;

		const amount = parseInt(tradeAmount);
		if (isNaN(amount) || amount <= 0) {
			toast.error('Please enter a valid amount');
			return;
		}

		if (amount > Number(userProfile.balance)) {
			toast.error('Insufficient balance');
			return;
		}

		try {
			await placeTrade.mutateAsync({
				marketId: market.id,
				positionType: selectedPosition === 'yes' ? PositionType.yes : PositionType.no,
				amount: BigInt(amount)
			});
			toast.success(`Successfully placed Ꝟ ${amount} on ${selectedPosition.toUpperCase()}`);
			setTradeAmount('');
		} catch (error: any) {
			if (error.message?.includes('not invited')) {
				toast.error('You are not invited to this market');
			} else {
				toast.error(error.message || 'Failed to place trade');
			}
		}
	};

	const handleInviteByPrincipal = async () => {
		if (!invitePrincipal.trim()) {
			toast.error('Please enter a valid Principal ID');
			return;
		}

		try {
			const principal = Principal.fromText(invitePrincipal.trim());
			await inviteUsers.mutateAsync({ marketId, users: [principal] });
			toast.success('User invited successfully');
			setInvitePrincipal('');
		} catch (error: any) {
			if (error.message?.includes('Invalid principal')) {
				toast.error('Invalid Principal ID format');
			} else {
				toast.error(error.message || 'Failed to invite user');
			}
		}
	};

	const handleInviteFriend = async () => {
		if (!selectedFriend) {
			toast.error('Please select a friend');
			return;
		}

		try {
			const principal = Principal.fromText(selectedFriend);
			await inviteUsers.mutateAsync({ marketId, users: [principal] });
			toast.success('Friend invited successfully');
			setSelectedFriend('');
		} catch (error: any) {
			toast.error(error.message || 'Failed to invite friend');
		}
	};

	const formatDate = (timestamp: bigint) => {
		const date = new Date(Number(timestamp) / 1000000);
		return date.toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const getStatusBadge = (status: MarketStatus) => {
		switch (status) {
			case MarketStatus.open:
				return <Badge className="bg-chart-2">Open</Badge>;
			case MarketStatus.closed:
				return <Badge variant="secondary">Closed</Badge>;
			case MarketStatus.resolved:
				return <Badge variant="outline">Resolved</Badge>;
		}
	};

	if (isLoading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<Skeleton className="mb-8 h-12 w-48" />
				<Skeleton className="h-96" />
			</div>
		);
	}

	if (!market) {
		return (
			<div className="container mx-auto px-4 py-8">
				<Button variant="ghost" onClick={onBack} className="mb-4">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Markets
				</Button>
				<div className="py-16 text-center">
					<p className="text-muted-foreground">Market not found</p>
				</div>
			</div>
		);
	}

	const isClosed = market.status === MarketStatus.closed || market.status === MarketStatus.resolved;
	const canTrade = isAuthenticated && !isClosed && isInvited;

	return (
		<div className="container mx-auto px-4 py-8">
			<Button variant="ghost" onClick={onBack} className="mb-6">
				<ArrowLeft className="mr-2 h-4 w-4" />
				Back to Markets
			</Button>

			<div className="grid gap-8 lg:grid-cols-3">
				{/* Main Content */}
				<div className="space-y-6 lg:col-span-2">
					{/* Market Header */}
					<Card>
						<CardHeader>
							<div className="space-y-4">
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1">
										<h1 className="text-foreground mb-2 text-3xl font-bold">{market.title}</h1>
										<p className="text-muted-foreground">{market.description}</p>
									</div>
									<div className="flex flex-col gap-2">
										{getStatusBadge(market.status)}
										{market.inviteOnly && (
											<Badge variant="outline" className="gap-1">
												<Lock className="h-3 w-3" />
												Invite-only
											</Badge>
										)}
									</div>
								</div>

								<div className="flex flex-wrap gap-2">
									{market.categories.map((category) => (
										<Badge key={category} variant="secondary">
											{category}
										</Badge>
									))}
								</div>

								<div className="text-muted-foreground flex items-center gap-4 text-sm">
									<div className="flex items-center gap-1">
										<Clock className="h-4 w-4" />
										<span>Expires: {formatDate(market.expiration)}</span>
									</div>
								</div>

								{market.status === MarketStatus.resolved &&
									market.resolvedOutcome !== undefined && (
										<div className="bg-accent rounded-lg p-4">
											<p className="text-foreground text-sm font-medium">
												Resolved:{' '}
												<span className="text-lg font-bold">
													{market.resolvedOutcome ? 'YES' : 'NO'}
												</span>
											</p>
										</div>
									)}
							</div>
						</CardHeader>
					</Card>

					{/* Odds Display */}
					<Card>
						<CardHeader>
							<CardTitle>Current Odds</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-4">
								<div className="bg-chart-2/10 border-chart-2 rounded-lg border-2 p-6 text-center">
									<div className="mb-2 flex items-center justify-center gap-2">
										<TrendingUp className="text-chart-2 h-5 w-5" />
										<span className="text-muted-foreground text-sm font-medium">YES</span>
									</div>
									<p className="text-chart-2 text-3xl font-bold">
										{(market.oddsYes * 100).toFixed(1)}%
									</p>
								</div>
								<div className="bg-destructive/10 border-destructive rounded-lg border-2 p-6 text-center">
									<div className="mb-2 flex items-center justify-center gap-2">
										<TrendingDown className="text-destructive h-5 w-5" />
										<span className="text-muted-foreground text-sm font-medium">NO</span>
									</div>
									<p className="text-destructive text-3xl font-bold">
										{(market.oddsNo * 100).toFixed(1)}%
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Tabs for Analytics, Depth, Discussion */}
					<Card>
						<Tabs defaultValue="analytics">
							<CardHeader>
								<TabsList className="grid w-full grid-cols-3">
									<TabsTrigger value="analytics">
										<BarChart2 className="mr-2 h-4 w-4" />
										Analytics
									</TabsTrigger>
									<TabsTrigger value="depth">
										<Users className="mr-2 h-4 w-4" />
										Market Depth
									</TabsTrigger>
									<TabsTrigger value="discussion">
										<MessageSquare className="mr-2 h-4 w-4" />
										Discussion
									</TabsTrigger>
								</TabsList>
							</CardHeader>
							<CardContent>
								<TabsContent value="analytics" className="mt-0">
									<MarketAnalyticsChart marketId={marketId} />
								</TabsContent>
								<TabsContent value="depth" className="mt-0">
									<MarketDepthPanel marketId={marketId} />
								</TabsContent>
								<TabsContent value="discussion" className="mt-0">
									<MarketDiscussion marketId={marketId} />
								</TabsContent>
							</CardContent>
						</Tabs>
					</Card>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Trading Card */}
					<Card>
						<CardHeader>
							<CardTitle>Place Trade</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{!isAuthenticated ? (
								<div className="space-y-4 py-8 text-center">
									<LogIn className="text-muted-foreground mx-auto h-12 w-12" />
									<div>
										<p className="text-foreground mb-1 text-sm font-medium">Login to Trade</p>
										<p className="text-muted-foreground mb-4 text-xs">
											Sign in to place your bets on this market
										</p>
									</div>
									<Button onClick={handleLoginPrompt} className="w-full">
										<LogIn className="mr-2 h-4 w-4" />
										Login to Trade
									</Button>
								</div>
							) : !isInvited ? (
								<div className="py-8 text-center">
									<Lock className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
									<p className="text-foreground mb-1 text-sm font-medium">Invite-only Market</p>
									<p className="text-muted-foreground text-xs">
										You are not invited to this market
									</p>
								</div>
							) : isClosed ? (
								<div className="py-8 text-center">
									<Info className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
									<p className="text-muted-foreground text-sm">This market is closed for trading</p>
								</div>
							) : (
								<>
									<div className="space-y-2">
										<Label>Position</Label>
										<div className="grid grid-cols-2 gap-2">
											<Button
												variant={selectedPosition === 'yes' ? 'default' : 'outline'}
												onClick={() => setSelectedPosition('yes')}
												className={
													selectedPosition === 'yes' ? 'bg-chart-2 hover:bg-chart-2/90' : ''
												}
											>
												<TrendingUp className="mr-2 h-4 w-4" />
												YES
											</Button>
											<Button
												variant={selectedPosition === 'no' ? 'default' : 'outline'}
												onClick={() => setSelectedPosition('no')}
												className={
													selectedPosition === 'no' ? 'bg-destructive hover:bg-destructive/90' : ''
												}
											>
												<TrendingDown className="mr-2 h-4 w-4" />
												NO
											</Button>
										</div>
									</div>

									<div className="space-y-2">
										<Label htmlFor="amount">Amount (Ꝟ)</Label>
										<Input
											id="amount"
											type="number"
											value={tradeAmount}
											onChange={(e) => setTradeAmount(e.target.value)}
											placeholder="100"
											min="1"
										/>
										{userProfile && (
											<p className="text-muted-foreground text-xs">
												Available: Ꝟ {Number(userProfile.balance).toLocaleString()}
											</p>
										)}
									</div>

									<Button
										onClick={handleTrade}
										disabled={placeTrade.isPending || !tradeAmount}
										className="w-full"
									>
										{placeTrade.isPending ? 'Placing Trade...' : 'Place Trade'}
									</Button>
								</>
							)}
						</CardContent>
					</Card>

					{/* Participants Card (for invite-only markets) */}
					{market.inviteOnly && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Users className="h-5 w-5" />
									Participants
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<p className="text-muted-foreground text-sm">
										{invitedUsers.length} {invitedUsers.length === 1 ? 'user' : 'users'} invited
									</p>

									{invitedUsers.length > 0 && (
										<div className="max-h-32 space-y-2 overflow-y-auto">
											{invitedUsers.map((user) => {
												const UserProfileDisplay = () => {
													const { data: profile } = useGetUserProfile(user);
													return (
														<div className="bg-accent/20 flex items-center gap-2 rounded p-2">
															<Avatar className="h-6 w-6">
																<AvatarFallback className="text-xs">
																	{profile?.nickname?.slice(0, 2).toUpperCase() || 'U'}
																</AvatarFallback>
															</Avatar>
															<span className="flex-1 truncate text-xs">
																{profile?.nickname || user.toString().slice(0, 8) + '...'}
															</span>
														</div>
													);
												};
												return <UserProfileDisplay key={user.toString()} />;
											})}
										</div>
									)}
								</div>

								{canManageInvites && (
									<>
										<Separator />
										<div className="space-y-3">
											<p className="text-sm font-medium">Invite Users</p>

											{/* Invite from friends */}
											{friendsList.length > 0 && (
												<div className="space-y-2">
													<Label className="text-xs">Select from friends</Label>
													<div className="flex gap-2">
														<Select value={selectedFriend} onValueChange={setSelectedFriend}>
															<SelectTrigger className="flex-1">
																<SelectValue placeholder="Choose a friend" />
															</SelectTrigger>
															<SelectContent>
																{friendsList
																	.filter(
																		(friend) =>
																			!invitedUsers.some((u) => u.toString() === friend.toString())
																	)
																	.map((friend) => {
																		const FriendOption = () => {
																			const { data: profile } = useGetUserProfile(friend);
																			return (
																				<SelectItem
																					key={friend.toString()}
																					value={friend.toString()}
																				>
																					{profile?.nickname ||
																						friend.toString().slice(0, 12) + '...'}
																				</SelectItem>
																			);
																		};
																		return <FriendOption key={friend.toString()} />;
																	})}
															</SelectContent>
														</Select>
														<Button
															size="sm"
															onClick={handleInviteFriend}
															disabled={!selectedFriend || inviteUsers.isPending}
														>
															<UserPlus className="h-4 w-4" />
														</Button>
													</div>
												</div>
											)}

											{/* Invite by Principal */}
											<div className="space-y-2">
												<Label className="text-xs">Or enter Principal ID</Label>
												<div className="flex gap-2">
													<Input
														placeholder="Enter Principal ID"
														value={invitePrincipal}
														onChange={(e) => setInvitePrincipal(e.target.value)}
														className="flex-1 text-xs"
													/>
													<Button
														size="sm"
														onClick={handleInviteByPrincipal}
														disabled={!invitePrincipal.trim() || inviteUsers.isPending}
													>
														<UserPlus className="h-4 w-4" />
													</Button>
												</div>
											</div>
										</div>
									</>
								)}
							</CardContent>
						</Card>
					)}

					{/* Market Info Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Info className="h-5 w-5" />
								Market Info
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Status</span>
								<span className="font-medium">{market.status}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Type</span>
								<span className="font-medium">{market.inviteOnly ? 'Invite-only' : 'Public'}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Created</span>
								<span className="font-medium">{formatDate(market.createdAt)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Expires</span>
								<span className="font-medium">{formatDate(market.expiration)}</span>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
