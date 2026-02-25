import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { EyeOff, LogIn, MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import {
	useCreateComment,
	useGetCallerUserProfile,
	useGetMarketComments,
	useIsCallerAdmin,
	useModerateComment
} from '../hooks/useQueries';

interface MarketDiscussionProps {
	marketId: bigint;
}

export default function MarketDiscussion({ marketId }: MarketDiscussionProps) {
	const { data: comments = [], isLoading } = useGetMarketComments(marketId);
	const { data: isAdmin = false } = useIsCallerAdmin();
	const { data: userProfile } = useGetCallerUserProfile();
	const { identity, login } = useInternetIdentity();
	const createComment = useCreateComment();
	const moderateComment = useModerateComment();
	const [commentText, setCommentText] = useState('');

	const isAuthenticated = !!identity;

	const handleLoginPrompt = async () => {
		try {
			await login();
		} catch (error: any) {
			console.error('Login error:', error);
			toast.error('Failed to login. Please try again.');
		}
	};

	const handlePostComment = async () => {
		if (!commentText.trim()) {
			toast.error('Please enter a comment');
			return;
		}

		try {
			await createComment.mutateAsync({
				marketId,
				content: commentText.trim()
			});
			toast.success('Comment posted successfully');
			setCommentText('');
		} catch (error: any) {
			toast.error(error.message || 'Failed to post comment');
		}
	};

	const handleModerate = async (commentId: bigint) => {
		try {
			await moderateComment.mutateAsync({
				marketId,
				commentId
			});
			toast.success('Comment hidden');
		} catch (error: any) {
			toast.error(error.message || 'Failed to moderate comment');
		}
	};

	const formatDate = (timestamp: bigint) => {
		const date = new Date(Number(timestamp) / 1000000);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	};

	const getInitials = (nickname: string) => {
		return nickname
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-20 w-full" />
				<Skeleton className="h-20 w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Comment Input */}
			{isAuthenticated ? (
				<div className="space-y-3">
					<Textarea
						placeholder="Share your thoughts on this market..."
						value={commentText}
						onChange={(e) => setCommentText(e.target.value)}
						rows={3}
						className="resize-none"
					/>
					<div className="flex justify-end">
						<Button
							onClick={handlePostComment}
							disabled={createComment.isPending || !commentText.trim()}
							size="sm"
						>
							{createComment.isPending ? (
								'Posting...'
							) : (
								<>
									<Send className="mr-2 h-4 w-4" />
									Post Comment
								</>
							)}
						</Button>
					</div>
				</div>
			) : (
				<div className="bg-accent/20 border-border space-y-3 rounded-lg border p-6 text-center">
					<LogIn className="text-muted-foreground mx-auto h-10 w-10" />
					<div>
						<p className="text-foreground mb-1 text-sm font-medium">Login to Join the Discussion</p>
						<p className="text-muted-foreground mb-4 text-xs">
							Sign in to share your thoughts and insights
						</p>
					</div>
					<Button onClick={handleLoginPrompt} size="sm">
						<LogIn className="mr-2 h-4 w-4" />
						Login to Comment
					</Button>
				</div>
			)}

			<Separator />

			{/* Comments List */}
			{comments.length === 0 ? (
				<div className="text-muted-foreground py-8 text-center">
					<MessageSquare className="mx-auto mb-3 h-12 w-12 opacity-50" />
					<p>No comments yet. Start the conversation!</p>
				</div>
			) : (
				<ScrollArea className="h-[400px] pr-4">
					<div className="space-y-4">
						{comments.map((comment) => {
							const isCurrentUser = identity?.getPrincipal().toString() === comment.user.toString();

							return (
								<div
									key={comment.id.toString()}
									className={`rounded-lg border p-4 ${
										comment.isHidden ? 'bg-muted/50 border-muted' : 'bg-card border-border'
									}`}
								>
									<div className="flex gap-3">
										<Avatar className="h-10 w-10">
											<AvatarFallback className="bg-primary/10 text-primary text-sm">
												{getInitials(comment.user.toString().slice(0, 5))}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1 space-y-2">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<span className="text-sm font-medium">
														{isCurrentUser ? userProfile?.nickname || 'You' : 'Anonymous'}
													</span>
													<span className="text-muted-foreground text-xs">
														{formatDate(comment.createdAt)}
													</span>
												</div>
												{isAdmin && !comment.isHidden && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleModerate(comment.id)}
														disabled={moderateComment.isPending}
													>
														<EyeOff className="mr-1 h-4 w-4" />
														Hide
													</Button>
												)}
											</div>
											<p
												className={`text-sm ${comment.isHidden ? 'text-muted-foreground italic' : ''}`}
											>
												{comment.isHidden && !isAdmin
													? '[Comment hidden by moderator]'
													: comment.content}
											</p>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</ScrollArea>
			)}
		</div>
	);
}
