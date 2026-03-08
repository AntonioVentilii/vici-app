<script lang="ts">
	import type { Snippet } from 'svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';

	interface Props {
		disabled?: boolean;
		loading?: boolean;
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		children: Snippet;
		onclick?: () => void;
	}

	const {
		disabled = false,
		loading = false,
		variant = 'primary',
		size = 'md',
		children,
		onclick = undefined
	}: Props = $props();

	const variants: Record<NonNullable<Props['variant']>, string> = {
		primary: 'bg-primary text-primary-foreground shadow-lg hover:opacity-90',
		secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:opacity-90',
		outline: 'border-2 border-primary text-primary bg-transparent hover:bg-primary/5',
		ghost: 'bg-transparent text-foreground hover:bg-primary/10',
		danger: 'bg-destructive text-destructive-foreground shadow-md hover:opacity-90'
	};

	const sizes: Record<NonNullable<Props['size']>, string> = {
		sm: 'px-4 py-1.5 text-xs',
		md: 'px-8 py-2.5 text-sm',
		lg: 'px-10 py-3.5 text-base'
	};
</script>

<button
	class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-bold transition-all active:scale-95 disabled:opacity-50 {variants[
		variant
	]} {sizes[size]}"
	class:disabled:cursor-not-allowed={disabled}
	class:disabled:cursor-progress={loading}
	disabled={disabled || loading}
	{onclick}
>
	{#if loading}
		<LoadingSpinner />
	{/if}
	{@render children()}
</button>
