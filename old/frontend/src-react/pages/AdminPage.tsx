import { Alert, AlertDescription } from '@/components/ui/alert';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Principal } from '@icp-sdk/core/principal';
import {
	AlertTriangle,
	CheckCircle,
	Clock,
	Coins,
	Crown,
	Info,
	Lock,
	Plus,
	Shield,
	UserMinus
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MarketSnapshot, MarketStatus } from '../backend';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import {
	useAddAdmin,
	useAdminList,
	useCreateMarket,
	useGetAllMarkets,
	useGrantViciCoins,
	useRemoveAdmin,
	useResolveMarket
} from '../hooks/useQueries';

export default function AdminPage() {
	const createMarket = useCreateMarket();
	const resolveMarket = useResolveMarket();
	const grantCoins = useGrantViciCoins();
	const { data: markets = [] } = useGetAllMarkets();
	const { data: adminList = [], isLoading: adminListLoading } = useAdminList();
	const addAdmin = useAddAdmin();
	const removeAdmin = useRemoveAdmin();
	const { identity } = useInternetIdentity();

	// Create Market Form
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [categories, setCategories] = useState('');
	const [expirationDate, setExpirationDate] = useState('');
	const [inviteOnly, setInviteOnly] = useState(false);
	const [initialInvites, setInitialInvites] = useState('');

	// Grant Coins Form
	const [userPrincipal, setUserPrincipal] = useState('');
	const [coinAmount, setCoinAmount] = useState('');

	// Admin Management Form
	const [newAdminPrincipal, setNewAdminPrincipal] = useState('');

	// Market Resolution State
	const [selectedOutcomes, setSelectedOutcomes] = useState<
		Record<string, 'yes' | 'no' | 'canceled'>
	>({});

	// Determine if current user is the owner (first admin in the list)
	const currentUserPrincipal = identity?.getPrincipal().toString();
	const ownerPrincipal = adminList.length > 0 ? adminList[0].toString() : null;
	const isOwner = currentUserPrincipal === ownerPrincipal;

	const handleCreateMarket = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!title || !description || !expirationDate) {
			toast.error('Please fill in all required fields');
			return;
		}

		try {
			const expiration = BigInt(new Date(expirationDate).getTime() * 1000000);
			const categoryArray = categories
				.split(',')
				.map((c) => c.trim())
				.filter(Boolean);

			let invitedUsersList: Principal[] = [];
			if (inviteOnly && initialInvites.trim()) {
				const invitePrincipals = initialInvites
					.split(',')
					.map((p) => p.trim())
					.filter(Boolean);

				try {
					invitedUsersList = invitePrincipals.map((p) => Principal.fromText(p));
				} catch (error) {
					toast.error('Invalid Principal ID in invites list');
					return;
				}
			}

			await createMarket.mutateAsync({
				title,
				description,
				categories: categoryArray,
				expiration,
				inviteOnly,
				invitedUsers: invitedUsersList
			});

			toast.success('Market created successfully');
			setTitle('');
			setDescription('');
			setCategories('');
			setExpirationDate('');
			setInviteOnly(false);
			setInitialInvites('');
		} catch (error: any) {
			toast.error(error.message || 'Failed to create market');
		}
	};

	const handleResolveMarket = async (marketId: bigint, outcome: 'yes' | 'no' | 'canceled') => {
		try {
			// Backend only supports YES (true) or NO (false)
			// CANCELED is not yet supported in the backend
			if (outcome === 'canceled') {
				toast.error('CANCELED outcome is not yet supported');
				return;
			}

			const booleanOutcome = outcome === 'yes';
			await resolveMarket.mutateAsync({ marketId, outcome: booleanOutcome });
			toast.success(`Market resolved as ${outcome.toUpperCase()}`);

			// Clear the selected outcome for this market
			setSelectedOutcomes((prev) => {
				const updated = { ...prev };
				delete updated[marketId.toString()];
				return updated;
			});
		} catch (error: any) {
			toast.error(error.message || 'Failed to resolve market');
		}
	};

	const handleGrantCoins = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!userPrincipal || !coinAmount) {
			toast.error('Please fill in all fields');
			return;
		}

		try {
			const principal = Principal.fromText(userPrincipal);
			const amount = BigInt(parseInt(coinAmount));

			await grantCoins.mutateAsync({ user: principal, amount });
			toast.success(`Granted Ꝟ ${coinAmount} successfully`);
			setUserPrincipal('');
			setCoinAmount('');
		} catch (error: any) {
			toast.error(error.message || 'Failed to grant coins');
		}
	};

	const handleAddAdmin = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!newAdminPrincipal.trim()) {
			toast.error('Please enter a Principal ID');
			return;
		}

		try {
			const principal = Principal.fromText(newAdminPrincipal.trim());

			// Check if already an admin
			if (adminList.some((admin) => admin.toString() === principal.toString())) {
				toast.error('This user is already an admin');
				return;
			}

			await addAdmin.mutateAsync(principal);
			setNewAdminPrincipal('');
		} catch (error: any) {
			if (error.message.includes('Invalid principal')) {
				toast.error('Invalid Principal ID format');
			} else {
				toast.error(error.message || 'Failed to add admin');
			}
		}
	};

	const handleRemoveAdmin = async (principal: Principal) => {
		try {
			await removeAdmin.mutateAsync(principal);
		} catch (error: any) {
			toast.error(error.message || 'Failed to remove admin');
		}
	};

	// Sort markets: expired unresolved first, then by expiry date
	const sortedMarkets = [...markets].sort((a, b) => {
		const now = Date.now() * 1000000; // Convert to nanoseconds
		const aExpired = Number(a.expiration) < now;
		const bExpired = Number(b.expiration) < now;
		const aResolved = a.status === MarketStatus.resolved;
		const bResolved = b.status === MarketStatus.resolved;

		// Expired unresolved markets first
		if (aExpired && !aResolved && (!bExpired || bResolved)) return -1;
		if (bExpired && !bResolved && (!aExpired || aResolved)) return 1;

		// Then sort by expiration date (closest first)
		return Number(a.expiration) - Number(b.expiration);
	});

	const isMarketExpired = (expiration: bigint): boolean => {
		const now = Date.now() * 1000000; // Convert to nanoseconds
		return Number(expiration) < now;
	};

	const formatExpirationDate = (expiration: bigint): string => {
		const date = new Date(Number(expiration) / 1000000);
		return date.toLocaleString();
	};

	const getOutcomeDisplay = (market: MarketSnapshot): string => {
		if (market.resolvedOutcome === undefined) return 'Not resolved';
		return market.resolvedOutcome ? 'YES' : 'NO';
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="space-y-8">
				{/* Header */}
				<div>
					<h1 className="text-foreground text-4xl font-bold">Admin Panel</h1>
					<p className="text-muted-foreground mt-2">Manage markets, users, and admins</p>
				</div>

				<Tabs defaultValue="resolve">
					<TabsList>
						<TabsTrigger value="resolve">Market Resolution</TabsTrigger>
						<TabsTrigger value="create">Create Market</TabsTrigger>
						<TabsTrigger value="grant">Grant Coins</TabsTrigger>
						<TabsTrigger value="admins">Admin Management</TabsTrigger>
					</TabsList>

					{/* Market Resolution Dashboard */}
					<TabsContent value="resolve" className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CheckCircle className="h-5 w-5" />
									Market Resolution Dashboard
								</CardTitle>
								<p className="text-muted-foreground text-sm">
									Resolve market outcomes. Expired markets requiring urgent attention are
									highlighted.
								</p>
							</CardHeader>
							<CardContent>
								{sortedMarkets.length > 0 ? (
									<div className="space-y-3">
										{sortedMarkets.map((market) => {
											const expired = isMarketExpired(market.expiration);
											const resolved = market.status === MarketStatus.resolved;
											const urgent = expired && !resolved;
											const marketIdStr = market.id.toString();
											const selectedOutcome = selectedOutcomes[marketIdStr];

											return (
												<div
													key={marketIdStr}
													className={`rounded-lg border-2 p-4 transition-all ${
														urgent
															? 'border-destructive bg-destructive/5 shadow-md'
															: 'border-border bg-card'
													}`}
												>
													{/* Urgency Badge */}
													{urgent && (
														<div className="text-destructive mb-3 flex items-center gap-2">
															<AlertTriangle className="h-5 w-5" />
															<span className="text-sm font-semibold tracking-wide uppercase">
																Urgent: Expired & Unresolved
															</span>
														</div>
													)}

													<div className="space-y-3">
														{/* Market Info */}
														<div className="flex items-start justify-between gap-4">
															<div className="min-w-0 flex-1">
																<h3 className="text-foreground text-lg font-semibold">
																	{market.title}
																</h3>
																<p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
																	{market.description}
																</p>
															</div>
														</div>

														{/* Status and Metadata */}
														<div className="flex flex-wrap items-center gap-2">
															{/* Status Badge */}
															{market.status === MarketStatus.open && (
																<Badge className="bg-chart-2">Open</Badge>
															)}
															{market.status === MarketStatus.closed && (
																<Badge variant="secondary">Closed</Badge>
															)}
															{market.status === MarketStatus.resolved && (
																<Badge className="bg-chart-1">Resolved</Badge>
															)}

															{/* Invite-only Badge */}
															{market.inviteOnly && (
																<Badge variant="outline" className="gap-1">
																	<Lock className="h-3 w-3" />
																	Invite-only
																</Badge>
															)}

															{/* Expiration Badge */}
															<Badge
																variant={expired ? 'destructive' : 'outline'}
																className="gap-1"
															>
																<Clock className="h-3 w-3" />
																{expired ? 'Expired' : 'Active'}
															</Badge>

															{/* Expiration Date */}
															<span className="text-muted-foreground text-xs">
																Expires: {formatExpirationDate(market.expiration)}
															</span>
														</div>

														{/* Resolution Section */}
														{resolved ? (
															<div className="border-border border-t pt-3">
																<div className="flex items-center gap-2">
																	<span className="text-muted-foreground text-sm font-medium">
																		Resolved Outcome:
																	</span>
																	<Badge
																		className={
																			market.resolvedOutcome ? 'bg-chart-2' : 'bg-destructive'
																		}
																	>
																		{getOutcomeDisplay(market)}
																	</Badge>
																</div>
															</div>
														) : (
															<div className="border-border space-y-3 border-t pt-3">
																<Label className="text-sm font-medium">Select Outcome:</Label>
																<RadioGroup
																	value={selectedOutcome || ''}
																	onValueChange={(value) => {
																		setSelectedOutcomes((prev) => ({
																			...prev,
																			[marketIdStr]: value as 'yes' | 'no' | 'canceled'
																		}));
																	}}
																	className="flex gap-4"
																>
																	<div className="flex items-center space-x-2">
																		<RadioGroupItem value="yes" id={`yes-${marketIdStr}`} />
																		<Label
																			htmlFor={`yes-${marketIdStr}`}
																			className="cursor-pointer font-normal"
																		>
																			YES
																		</Label>
																	</div>
																	<div className="flex items-center space-x-2">
																		<RadioGroupItem value="no" id={`no-${marketIdStr}`} />
																		<Label
																			htmlFor={`no-${marketIdStr}`}
																			className="cursor-pointer font-normal"
																		>
																			NO
																		</Label>
																	</div>
																	<div className="flex items-center space-x-2">
																		<RadioGroupItem
																			value="canceled"
																			id={`canceled-${marketIdStr}`}
																		/>
																		<Label
																			htmlFor={`canceled-${marketIdStr}`}
																			className="text-muted-foreground cursor-pointer font-normal"
																		>
																			CANCELED
																		</Label>
																	</div>
																</RadioGroup>

																<Button
																	size="sm"
																	onClick={() => handleResolveMarket(market.id, selectedOutcome)}
																	disabled={!selectedOutcome || resolveMarket.isPending}
																	className={urgent ? 'bg-destructive hover:bg-destructive/90' : ''}
																>
																	{resolveMarket.isPending ? (
																		'Resolving...'
																	) : (
																		<>
																			<CheckCircle className="mr-2 h-4 w-4" />
																			Resolve Market
																		</>
																	)}
																</Button>
															</div>
														)}
													</div>
												</div>
											);
										})}
									</div>
								) : (
									<div className="text-muted-foreground py-12 text-center">
										<p>No markets available</p>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					{/* Create Market */}
					<TabsContent value="create" className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Plus className="h-5 w-5" />
									Create New Market
								</CardTitle>
							</CardHeader>
							<CardContent>
								<form onSubmit={handleCreateMarket} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="title">Title *</Label>
										<Input
											id="title"
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											placeholder="Will Bitcoin reach $100k by end of 2025?"
											required
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="description">Description *</Label>
										<Textarea
											id="description"
											value={description}
											onChange={(e) => setDescription(e.target.value)}
											placeholder="Detailed description of the market and resolution criteria..."
											rows={4}
											required
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="categories">Categories (comma-separated)</Label>
										<Input
											id="categories"
											value={categories}
											onChange={(e) => setCategories(e.target.value)}
											placeholder="Crypto, Finance, Technology"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="expiration">Expiration Date *</Label>
										<Input
											id="expiration"
											type="datetime-local"
											value={expirationDate}
											onChange={(e) => setExpirationDate(e.target.value)}
											required
										/>
									</div>

									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<Switch
												id="inviteOnly"
												checked={inviteOnly}
												onCheckedChange={setInviteOnly}
											/>
											<Label htmlFor="inviteOnly" className="cursor-pointer">
												Invite-only Market
											</Label>
										</div>
										<p className="text-muted-foreground text-xs">
											Only invited users can participate in this market
										</p>
									</div>

									{inviteOnly && (
										<div className="space-y-2">
											<Label htmlFor="initialInvites">
												Initial Invites (comma-separated Principal IDs)
											</Label>
											<Textarea
												id="initialInvites"
												value={initialInvites}
												onChange={(e) => setInitialInvites(e.target.value)}
												placeholder="principal1, principal2, principal3..."
												rows={3}
											/>
										</div>
									)}

									<Button type="submit" disabled={createMarket.isPending} className="w-full">
										{createMarket.isPending ? (
											'Creating...'
										) : (
											<>
												<Plus className="mr-2 h-4 w-4" />
												Create Market
											</>
										)}
									</Button>
								</form>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Grant Coins */}
					<TabsContent value="grant" className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Coins className="h-5 w-5" />
									Grant Vici Coins
								</CardTitle>
							</CardHeader>
							<CardContent>
								<Alert className="mb-4">
									<Info className="h-4 w-4" />
									<AlertDescription>
										This feature is not yet implemented in the backend. It will be available in a
										future update.
									</AlertDescription>
								</Alert>
								<form onSubmit={handleGrantCoins} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="userPrincipal">User Principal ID *</Label>
										<Input
											id="userPrincipal"
											value={userPrincipal}
											onChange={(e) => setUserPrincipal(e.target.value)}
											placeholder="Enter user's Principal ID"
											required
											disabled
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="coinAmount">Amount (Ꝟ) *</Label>
										<Input
											id="coinAmount"
											type="number"
											min="1"
											value={coinAmount}
											onChange={(e) => setCoinAmount(e.target.value)}
											placeholder="1000"
											required
											disabled
										/>
									</div>

									<Button type="submit" disabled className="w-full">
										<Coins className="mr-2 h-4 w-4" />
										Grant Coins (Coming Soon)
									</Button>
								</form>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Admin Management */}
					<TabsContent value="admins" className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Shield className="h-5 w-5" />
									Admin Management
								</CardTitle>
								<p className="text-muted-foreground text-sm">
									View and manage platform administrators
								</p>
							</CardHeader>
							<CardContent className="space-y-6">
								<Alert>
									<Info className="h-4 w-4" />
									<AlertDescription>
										Admin management features are not yet fully implemented in the backend. This
										interface will be functional in a future update.
									</AlertDescription>
								</Alert>

								{/* Admin List */}
								<div className="space-y-3">
									<h3 className="text-foreground text-sm font-semibold">Current Admins</h3>
									{adminListLoading ? (
										<div className="text-muted-foreground py-8 text-center">
											<p>Loading admin list...</p>
										</div>
									) : adminList.length > 0 ? (
										<div className="space-y-2">
											{adminList.map((admin, index) => {
												const adminStr = admin.toString();
												const isAdminOwner = index === 0;
												const isCurrentUser = adminStr === currentUserPrincipal;

												return (
													<div
														key={adminStr}
														className="bg-card flex items-center justify-between rounded-lg border p-3"
													>
														<div className="flex min-w-0 flex-1 items-center gap-3">
															{isAdminOwner && (
																<Crown className="h-5 w-5 flex-shrink-0 text-yellow-500" />
															)}
															<div className="min-w-0 flex-1">
																<div className="flex flex-wrap items-center gap-2">
																	<code className="bg-muted rounded px-2 py-1 font-mono text-xs break-all">
																		{adminStr}
																	</code>
																	{isAdminOwner && (
																		<Badge
																			variant="outline"
																			className="border-yellow-600 text-yellow-600"
																		>
																			Owner
																		</Badge>
																	)}
																	{isCurrentUser && <Badge variant="secondary">You</Badge>}
																</div>
															</div>
														</div>
														{isOwner && !isAdminOwner && (
															<AlertDialog>
																<AlertDialogTrigger asChild>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="text-destructive hover:text-destructive hover:bg-destructive/10"
																		disabled
																	>
																		<UserMinus className="h-4 w-4" />
																	</Button>
																</AlertDialogTrigger>
																<AlertDialogContent>
																	<AlertDialogHeader>
																		<AlertDialogTitle>Remove Admin</AlertDialogTitle>
																		<AlertDialogDescription>
																			Are you sure you want to remove this admin? They will lose all
																			admin privileges.
																		</AlertDialogDescription>
																	</AlertDialogHeader>
																	<AlertDialogFooter>
																		<AlertDialogCancel>Cancel</AlertDialogCancel>
																		<AlertDialogAction
																			onClick={() => handleRemoveAdmin(admin)}
																			className="bg-destructive hover:bg-destructive/90"
																		>
																			Remove
																		</AlertDialogAction>
																	</AlertDialogFooter>
																</AlertDialogContent>
															</AlertDialog>
														)}
													</div>
												);
											})}
										</div>
									) : (
										<div className="text-muted-foreground py-8 text-center">
											<p>No admins found (feature not yet implemented)</p>
										</div>
									)}
								</div>

								{/* Add Admin Form - Only visible to owner */}
								{isOwner && (
									<div className="border-border border-t pt-6">
										<h3 className="text-foreground mb-3 text-sm font-semibold">Add New Admin</h3>
										<form onSubmit={handleAddAdmin} className="space-y-4">
											<div className="space-y-2">
												<Label htmlFor="newAdminPrincipal">Principal ID *</Label>
												<Input
													id="newAdminPrincipal"
													value={newAdminPrincipal}
													onChange={(e) => setNewAdminPrincipal(e.target.value)}
													placeholder="Enter Principal ID to grant admin access"
													required
													disabled
												/>
												<p className="text-muted-foreground text-xs">
													The user will be able to resolve markets, create markets, and grant coins
												</p>
											</div>

											<Button type="submit" disabled className="w-full">
												<Shield className="mr-2 h-4 w-4" />
												Add Admin (Coming Soon)
											</Button>
										</form>
									</div>
								)}

								{!isOwner && adminList.length > 0 && (
									<div className="border-border border-t pt-6">
										<div className="text-muted-foreground py-4 text-center text-sm">
											<p>Only the owner can add or remove admins</p>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
