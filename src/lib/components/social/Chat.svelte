<script lang="ts">
	import { onMount, tick } from 'svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { sendMessage, getMarketMessages } from '$lib/services/chat.services';
	import { getProfile } from '$lib/services/profile.services';
	import type { ChatMessage } from '$lib/types/chat';
	import type { UserProfile } from '$lib/types/profile';

	interface Props {
		marketId: string;
		userPrincipal: string;
	}

	const { marketId, userPrincipal }: Props = $props();

	let messages: ChatMessage[] = $state([]);
	const profiles: Map<string, UserProfile> = $state(new Map());
	let newMessage = $state('');
	let loading = $state(true);
	let sending = $state(false);
	let chatContainer: HTMLElement | undefined = $state();

	onMount(() => {
		loadMessages();
		// Polling for new messages (simple implementation)
		const interval = setInterval(loadMessages, 5000);
		return () => clearInterval(interval);
	});

	const loadMessages = async () => {
		const newMessages = await getMarketMessages(marketId);
		const hasNew = newMessages.length > messages.length;
		messages = newMessages;

		for (const msg of messages) {
			if (!profiles.has(msg.sender)) {
				const profile = await getProfile(msg.sender);
				if (profile) {
					profiles.set(msg.sender, profile);
				}
			}
		}

		loading = false;
		if (hasNew) {
			await scrollToBottom();
		}
	};

	const handleSendMessage = async () => {
		if (!newMessage.trim() || sending) {
			return;
		}
		sending = true;
		try {
			await sendMessage({ marketId, sender: userPrincipal, content: newMessage.trim() });
			newMessage = '';
			await loadMessages();
		} finally {
			sending = false;
		}
	};

	const scrollToBottom = async () => {
		await tick();
		if (chatContainer) {
			chatContainer.scrollTo({
				top: chatContainer.scrollHeight,
				behavior: 'smooth'
			});
		}
	};
</script>

<div
	class="border-border bg-card/30 flex h-125 flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl"
>
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
		<div class="flex items-center gap-3">
			<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
			<h4 class="font-bold tracking-tight">Market Chat</h4>
		</div>
		<span class="text-muted-foreground text-xs">{messages.length} messages</span>
	</div>

	<!-- Messages -->
	<div
		bind:this={chatContainer}
		class="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto p-4"
	>
		{#if loading}
			<div class="flex flex-1 items-center justify-center">
				<LoadingSpinner />
			</div>
		{:else if messages.length === 0}
			<div class="flex flex-1 flex-col items-center justify-center text-center opacity-40">
				<div class="mb-2 text-3xl">💬</div>
				<p class="text-sm italic">No messages yet. Be the first to speak!</p>
			</div>
		{:else}
			{#each messages as msg (msg.timestamp)}
				{@const isMe = msg.sender === userPrincipal}
				{@const profile = profiles.get(msg.sender)}
				<div
					class="flex flex-col gap-1 {isMe
						? 'items-end'
						: 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300"
				>
					<div class="flex items-end gap-2 {isMe ? 'flex-row-reverse' : 'flex-row'}">
						<div class="bg-muted h-6 w-6 shrink-0 rounded-full">
							{#if profile?.avatar}
								<img class="h-full w-full rounded-full" alt="" src={profile.avatar} />
							{:else}
								<div class="flex h-full w-full items-center justify-center text-[10px] uppercase">
									{profile?.nickname?.[0] ?? '?'}
								</div>
							{/if}
						</div>
						<div
							class="rounded-2xl px-4 py-2 text-sm shadow-sm transition-all {isMe
								? 'bg-primary text-primary-foreground rounded-br-none'
								: 'bg-accent/40 hover:bg-accent/60 rounded-bl-none backdrop-blur-sm'}"
						>
							{msg.content}
						</div>
					</div>
					<span class="text-muted-foreground px-8 text-[10px] opacity-50">
						{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
					</span>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Input -->
	<div class="border-t border-white/5 bg-white/5 p-4">
		<form
			class="flex gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				handleSendMessage();
			}}
		>
			<input
				class="focus:border-primary/50 focus:ring-primary/10 flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm transition-all focus:ring-4 focus:outline-none"
				placeholder="Write a message..."
				type="text"
				bind:value={newMessage}
			/>
			<button
				class="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50"
				aria-label="Send message"
				disabled={!newMessage.trim() || sending}
				type="submit"
			>
				<svg
					fill="none"
					height="18"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					width="18"
					xmlns="http://www.w3.org/2000/svg"
					><line x1="22" x2="11" y1="2" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"
					></polygon></svg
				>
			</button>
		</form>
	</div>
</div>

<style lang="postcss">
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(var(--primary-rgb), 0.1);
		border-radius: 10px;
	}
</style>
