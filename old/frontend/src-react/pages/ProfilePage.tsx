import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Principal } from '@icp-sdk/core/principal';
import { Save, User, UserMinus, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
	useAddFriend,
	useGetCallerUserProfile,
	useGetFriendsList,
	useGetUserProfile,
	useRemoveFriend,
	useSaveCallerUserProfile
} from '../hooks/useQueries';

export default function ProfilePage() {
	const { data: userProfile, isLoading } = useGetCallerUserProfile();
	const saveProfile = useSaveCallerUserProfile();
	const { data: friendsList = [] } = useGetFriendsList();
	const addFriend = useAddFriend();
	const removeFriend = useRemoveFriend();

	const [nickname, setNickname] = useState('');
	const [isEditing, setIsEditing] = useState(false);
	const [friendPrincipal, setFriendPrincipal] = useState('');

	const handleSave = async () => {
		if (!userProfile || !nickname.trim()) {
			toast.error('Please enter a valid nickname');
			return;
		}

		try {
			await saveProfile.mutateAsync({
				...userProfile,
				nickname: nickname.trim()
			});
			toast.success('Profile updated successfully');
			setIsEditing(false);
		} catch (error) {
			toast.error('Failed to update profile');
			console.error(error);
		}
	};

	const handleAddFriend = async () => {
		if (!friendPrincipal.trim()) {
			toast.error('Please enter a valid Principal ID');
			return;
		}

		try {
			const principal = Principal.fromText(friendPrincipal.trim());
			await addFriend.mutateAsync(principal);
			toast.success('Friend added successfully');
			setFriendPrincipal('');
		} catch (error: any) {
			if (error.message?.includes('Cannot add yourself')) {
				toast.error('Cannot add yourself as a friend');
			} else if (error.message?.includes('Already friends')) {
				toast.error('Already friends with this user');
			} else if (error.message?.includes('User does not exist')) {
				toast.error('User does not exist');
			} else if (error.message?.includes('Invalid principal')) {
				toast.error('Invalid Principal ID format');
			} else {
				toast.error('Failed to add friend');
			}
			console.error(error);
		}
	};

	const handleRemoveFriend = async (friend: Principal) => {
		try {
			await removeFriend.mutateAsync(friend);
			toast.success('Friend removed successfully');
		} catch (error: any) {
			toast.error('Failed to remove friend');
			console.error(error);
		}
	};

	const formatDate = (timestamp: bigint) => {
		const date = new Date(Number(timestamp) / 1000000);
		return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	};

	if (isLoading) {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<Skeleton className="mb-8 h-12 w-48" />
				<Skeleton className="h-96" />
			</div>
		);
	}

	if (!userProfile) {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<div className="py-16 text-center">
					<p className="text-muted-foreground">Profile not found</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-2xl px-4 py-8">
			<div className="space-y-8">
				{/* Header */}
				<div>
					<h1 className="text-foreground text-4xl font-bold">Profile Settings</h1>
					<p className="text-muted-foreground mt-2">Manage your account information</p>
				</div>

				{/* Profile Card */}
				<Card>
					<CardHeader>
						<CardTitle>Account Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Avatar */}
						<div className="flex items-center gap-6">
							<Avatar className="h-24 w-24">
								<AvatarImage src={userProfile.avatar} />
								<AvatarFallback className="text-2xl">
									{userProfile.nickname[0]?.toUpperCase() || 'U'}
								</AvatarFallback>
							</Avatar>
							<div className="space-y-1">
								<h3 className="text-foreground text-xl font-semibold">{userProfile.nickname}</h3>
								<p className="text-muted-foreground text-sm">
									Member since {formatDate(userProfile.createdAt)}
								</p>
							</div>
						</div>

						{/* Edit Form */}
						<div className="border-border space-y-4 border-t pt-4">
							<div className="space-y-2">
								<Label htmlFor="nickname">Nickname</Label>
								{isEditing ? (
									<Input
										id="nickname"
										value={nickname}
										onChange={(e) => setNickname(e.target.value)}
										placeholder={userProfile.nickname}
										maxLength={30}
									/>
								) : (
									<div className="bg-accent/50 flex items-center justify-between rounded-md p-3">
										<span className="text-foreground">{userProfile.nickname}</span>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setNickname(userProfile.nickname);
												setIsEditing(true);
											}}
										>
											<User className="mr-2 h-4 w-4" />
											Edit
										</Button>
									</div>
								)}
							</div>

							{isEditing && (
								<div className="flex gap-2">
									<Button onClick={handleSave} disabled={saveProfile.isPending}>
										<Save className="mr-2 h-4 w-4" />
										{saveProfile.isPending ? 'Saving...' : 'Save Changes'}
									</Button>
									<Button
										variant="outline"
										onClick={() => {
											setIsEditing(false);
											setNickname('');
										}}
									>
										Cancel
									</Button>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Stats Card */}
				<Card>
					<CardHeader>
						<CardTitle>Account Stats</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-6">
							<div className="space-y-1">
								<p className="text-muted-foreground text-sm">Current Balance</p>
								<p className="text-foreground text-2xl font-bold">
									Ꝟ {Number(userProfile.balance).toLocaleString()}
								</p>
								<p className="text-muted-foreground text-xs">Vici Coins</p>
							</div>
							<div className="space-y-1">
								<p className="text-muted-foreground text-sm">Last Login</p>
								<p className="text-foreground text-lg font-semibold">
									{formatDate(userProfile.lastLogin)}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Friends Card */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Friends
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Add Friend */}
						<div className="space-y-2">
							<Label htmlFor="friendPrincipal">Add Friend by Principal ID</Label>
							<div className="flex gap-2">
								<Input
									id="friendPrincipal"
									value={friendPrincipal}
									onChange={(e) => setFriendPrincipal(e.target.value)}
									placeholder="xxxxx-xxxxx-xxxxx-xxxxx-xxx"
									className="flex-1"
								/>
								<Button
									onClick={handleAddFriend}
									disabled={addFriend.isPending || !friendPrincipal.trim()}
								>
									<UserPlus className="mr-2 h-4 w-4" />
									{addFriend.isPending ? 'Adding...' : 'Add'}
								</Button>
							</div>
							<p className="text-muted-foreground text-xs">
								Enter the Principal ID of the user you want to add as a friend
							</p>
						</div>

						<Separator />

						{/* Friends List */}
						<div className="space-y-3">
							<h4 className="text-foreground text-sm font-medium">
								Your Friends ({friendsList.length})
							</h4>
							{friendsList.length > 0 ? (
								<div className="space-y-2">
									{friendsList.map((friend) => (
										<FriendListItem
											key={friend.toString()}
											friend={friend}
											onRemove={handleRemoveFriend}
											isRemoving={removeFriend.isPending}
										/>
									))}
								</div>
							) : (
								<div className="text-muted-foreground py-8 text-center">
									<Users className="mx-auto mb-2 h-12 w-12 opacity-50" />
									<p className="text-sm">No friends yet</p>
									<p className="mt-1 text-xs">Add friends to invite them to private markets</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function FriendListItem({
	friend,
	onRemove,
	isRemoving
}: {
	friend: Principal;
	onRemove: (friend: Principal) => void;
	isRemoving: boolean;
}) {
	const { data: profile } = useGetUserProfile(friend);

	return (
		<div className="bg-accent/30 flex items-center justify-between rounded-md p-3">
			<div className="flex items-center gap-3">
				<Avatar className="h-10 w-10">
					<AvatarImage src={profile?.avatar} />
					<AvatarFallback>{profile?.nickname?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
				</Avatar>
				<div>
					<p className="text-foreground text-sm font-medium">
						{profile?.nickname || 'Unknown user'}
					</p>
					<p className="text-muted-foreground max-w-[200px] truncate font-mono text-xs">
						{friend.toString()}
					</p>
				</div>
			</div>
			<Button variant="ghost" size="sm" onClick={() => onRemove(friend)} disabled={isRemoving}>
				<UserMinus className="h-4 w-4" />
			</Button>
		</div>
	);
}
