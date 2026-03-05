<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { activityService } from '$lib/services/activity.services';
	import { discussionService, type Comment } from '$lib/services/discussion.services';
	import { getProfile } from '$lib/services/profile.services';
	import type { UserProfile } from '$lib/types/profile';
	import { ActivityType } from '$lib/types/social';

	interface Props {
		marketId: string;
		userPrincipal: string;
	}

	const { marketId, userPrincipal }: Props = $props();

	let comments: (Comment & { key: string })[] = $state([]);

	const profiles: Map<string, UserProfile> = $state(new Map());

	let newComment = $state('');

	let loading = $state(true);

	let posting = $state(false);

	onMount(async () => {
		await loadComments();
	});

	const loadComments = async () => {
		loading = true;
		try {
			comments = await discussionService.getMarketComments(marketId);

			for (const comment of comments) {
				if (!profiles.has(comment.user)) {
					const profile = await getProfile(comment.user);

					if (profile) {
						profiles.set(comment.user, profile);
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
			await discussionService.addComment({
				marketId,
				user: userPrincipal,
				content: newComment.trim()
			});

			await activityService.logActivity({
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
			<Button disabled={!newComment.trim() || posting} onclick={handlePostComment}>
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
				<div
					class="bg-card/20 border-border/50 animate-in fade-in slide-in-from-bottom-2 flex gap-4 rounded-2xl border p-4 duration-300"
				>
					<div class="bg-muted h-10 w-10 shrink-0 rounded-full">
						{#if profile?.avatar}
							<img class="h-full w-full rounded-full object-cover" alt="" src={profile.avatar} />
						{:else}
							<div class="flex h-full w-full items-center justify-center text-xs font-bold">
								{profile?.nickname?.[0] ?? '?'}
							</div>
						{/if}
					</div>
					<div class="flex-1 overflow-hidden">
						<div class="mb-1 flex items-center gap-2">
							<span class="text-sm font-bold">{profile?.nickname ?? 'Anonymous'}</span>
							<span class="text-muted-foreground text-[10px] opacity-50">
								{new Date(comment.timestamp).toLocaleString()}
							</span>
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
