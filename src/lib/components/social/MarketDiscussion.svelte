<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { logActivity } from '$lib/services/activity.services';
	import {
		addComment,
		getMarketComments,
		upvoteComment,
		downvoteComment
	} from '$lib/services/discussion.services';
	import { getProfile } from '$lib/services/profile.services';
	import type { Comment } from '$lib/types/comment';
	import type { UserProfile } from '$lib/types/profile';
	import { ActivityType } from '$lib/types/social';

	interface Props {
		marketId: string;
		userPrincipal: string;
	}

	const { marketId, userPrincipal }: Props = $props();

	let comments = $state<Comment[]>([]);

	const profiles = $state<Map<string, UserProfile>>(new Map());

	let newComment = $state('');

	let loading = $state(true);

	let posting = $state(false);

	let voting = $state<Record<string, boolean>>({});

	onMount(async () => {
		await loadComments();
	});

	const loadComments = async () => {
		loading = true;
		try {
			comments = await getMarketComments(marketId);

			for (const comment of comments) {
				if (!profiles.has(comment.user)) {
					const profileDoc = await getProfile(comment.user);

					if (profileDoc) {
						profiles.set(comment.user, profileDoc.data);
					}
				}
			}
		} finally {
			loading = false;
		}
	};

	const handlePostComment = async () => {
		if (!newComment.trim() || posting) {
			return;
		}
		posting = true;
		try {
			await addComment({
				marketId,
				user: userPrincipal,
				content: newComment.trim()
			});

			await logActivity({
				type: ActivityType.COMMENT,
				user: userPrincipal,
				marketId,
				title: `New comment on market`,
				details: newComment.trim().slice(0, 50) + (newComment.length > 50 ? '...' : '')
			});

			newComment = '';
			await loadComments();
		} finally {
			posting = false;
		}
	};

	const handleVote = async ({ comment, type }: { comment: Comment; type: 'up' | 'down' }) => {
		if (voting[comment.key]) {
			return;
		}

		voting[comment.key] = true;
		try {
			if (type === 'up') {
				const isRemoval = comment.upvotes?.includes(userPrincipal);
				await upvoteComment({ commentKey: comment.key, userPrincipal });
				if (!isRemoval) {
					await logActivity({
						type: ActivityType.UPVOTE,
						user: userPrincipal,
						marketId,
						title: `Upvoted a comment`,
						details: comment.content.slice(0, 30) + (comment.content.length > 30 ? '...' : '')
					});
				}
			} else {
				const isRemoval = comment.downvotes?.includes(userPrincipal);
				await downvoteComment({ commentKey: comment.key, userPrincipal });
				if (!isRemoval) {
					await logActivity({
						type: ActivityType.DOWNVOTE,
						user: userPrincipal,
						marketId,
						title: `Downvoted a comment`,
						details: comment.content.slice(0, 30) + (comment.content.length > 30 ? '...' : '')
					});
				}
			}
			await loadComments();
		} finally {
			voting[comment.key] = false;
		}
	};
</script>

<div class="flex flex-col gap-6">
	<!-- Input -->
	<div class="glassmorphism rounded-2xl p-4">
		<textarea
			class="border-border bg-background/50 focus:ring-primary/50 w-full resize-none rounded-xl border p-4 text-sm focus:ring-2 focus:outline-none"
			placeholder="Share your thoughts..."
			rows="3"
			bind:value={newComment}
		></textarea>
		<div class="mt-3 flex justify-end">
			<Button
				onclick={handlePostComment}
				status={!newComment.trim() || posting ? 'disabled' : 'enabled'}
			>
				{posting ? 'Posting...' : 'Post Comment'}
			</Button>
		</div>
	</div>

	<!-- List -->
	<div class="flex flex-col gap-4">
		{#if loading}
			<div class="flex justify-center py-8">
				<LoadingSpinner />
			</div>
		{:else if comments.length === 0}
			<div class="py-12 text-center opacity-40">
				<p class="text-sm italic">No comments yet. Be the first to start the discussion!</p>
			</div>
		{:else}
			{#each comments as comment (comment.key)}
				{@const profile = profiles.get(comment.user)}
				{@const upvoted = comment.upvotes?.includes(userPrincipal)}
				{@const downvoted = comment.downvotes?.includes(userPrincipal)}
				{@const score = (comment.upvotes?.length ?? 0) - (comment.downvotes?.length ?? 0)}

				<div
					class="bg-card/20 border-border/50 animate-in fade-in slide-in-from-bottom-2 flex gap-4 rounded-2xl border p-4 duration-300"
				>
					<div class="flex flex-col items-center gap-1">
						<button
							class="hover:bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg transition-colors {upvoted
								? 'text-primary'
								: 'opacity-40 hover:opacity-100'}"
							aria-label="Upvote comment"
							disabled={voting[comment.key]}
							onclick={() => handleVote({ comment, type: 'up' })}
						>
							<svg
								fill="none"
								height="20"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2.5"
								viewBox="0 0 24 24"
								width="20"
								xmlns="http://www.w3.org/2000/svg"><path d="m18 15-6-6-6 6" /></svg
							>
						</button>

						<span
							class="text-xs font-bold {score > 0
								? 'text-primary'
								: score < 0
									? 'text-red-500'
									: 'opacity-40'}"
						>
							{score > 0 ? `+${score}` : score}
						</span>

						<button
							class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-red-500/10 {downvoted
								? 'text-red-500'
								: 'opacity-40 hover:opacity-100'}"
							aria-label="Downvote comment"
							disabled={voting[comment.key]}
							onclick={() => handleVote({ comment, type: 'down' })}
						>
							<svg
								fill="none"
								height="20"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2.5"
								viewBox="0 0 24 24"
								width="20"
								xmlns="http://www.w3.org/2000/svg"><path d="m6 9 6 6 6-6" /></svg
							>
						</button>
					</div>

					<div class="flex-1 overflow-hidden">
						<div class="mb-1 flex items-start justify-between">
							<div class="flex items-center gap-2">
								<div class="bg-muted h-6 w-6 shrink-0 rounded-full">
									{#if profile?.avatar}
										<img
											class="h-full w-full rounded-full object-cover"
											alt=""
											src={profile.avatar}
										/>
									{:else}
										<div
											class="flex h-full w-full items-center justify-center text-[10px] font-bold"
										>
											{profile?.nickname?.[0] ?? '?'}
										</div>
									{/if}
								</div>
								<span class="text-sm font-bold">{profile?.nickname ?? 'Anonymous'}</span>
								<span class="text-muted-foreground text-[10px] opacity-50">
									{new Date(comment.timestamp).toLocaleString()}
								</span>
							</div>
						</div>
						<p class="text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style lang="postcss">
	.glassmorphism {
		background: rgba(255, 255, 255, 0.03);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
