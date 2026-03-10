<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import type { ButtonStatus } from '$lib/types/components';

	interface Props extends Omit<HTMLButtonAttributes, 'disabled' | 'aria-busy'> {
		status?: ButtonStatus;
		busyLabel?: Snippet;
		children: Snippet;
	}

	const {
		status = 'enabled',
		busyLabel,
		class: className = '',
		children,
		onclick,
		type = 'button',
		title,
		...rest
	}: Props = $props();

	const isEnabled = $derived(status === 'enabled');
	const isDisabled = $derived(status === 'disabled');
	const isLoading = $derived(status === 'loading');
	const isPending = $derived(status === 'pending');

	const isBusy = $derived(isLoading || isPending);

	const isBlocked = $derived(!isEnabled);
</script>

<button
	class="inline-flex items-center justify-center gap-2 transition-all {className}"
	class:cursor-not-allowed={isDisabled}
	class:cursor-pointer={isEnabled}
	class:cursor-progress={isPending}
	class:cursor-wait={isLoading}
	class:opacity-50={isBlocked}
	aria-busy={isBusy}
	disabled={isBlocked}
	{onclick}
	{title}
	{type}
	{...rest}
>
	{#if isBusy}
		<span class="flex h-4 w-4 items-center justify-center">
			<LoadingSpinner />
		</span>

		{#if nonNullish(busyLabel)}
			{@render busyLabel()}
		{/if}
	{:else}
		{@render children()}
	{/if}
</button>
