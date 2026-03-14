<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { notificationsStore } from '$lib/stores/notification.store';

	const remove = (id: string) => notificationsStore.remove(id);
</script>

<div
	class="pointer-events-none fixed bottom-8 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
>
	{#each $notificationsStore as notification (notification.id)}
		<button
			class="pointer-events-auto flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-2xl ring-1 ring-slate-200"
			onclick={() => remove(notification.id)}
			in:fly={{ y: 20, duration: 300 }}
			out:fade={{ duration: 200 }}
		>
			{#if notification.type === 'error'}
				<div
					class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600"
				>
					<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M6 18L18 6M6 6l12 12"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
						/>
					</svg>
				</div>
			{:else}
				<div
					class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
				>
					<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M5 13l4 4L19 7"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
						/>
					</svg>
				</div>
			{/if}
			<div class="flex flex-col">
				<span class="text-sm font-black text-slate-900">{notification.title}</span>
				<p class="text-xs text-slate-500">{notification.message}</p>
			</div>
		</button>
	{/each}
</div>
