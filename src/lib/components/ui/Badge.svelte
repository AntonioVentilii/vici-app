<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
		size?: 'sm' | 'md';
	}

	const { children, variant = 'default', size = 'md' }: Props = $props();

	const variants: Record<NonNullable<Props['variant']>, string> = {
		default: 'bg-muted text-muted-foreground',
		success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
		warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
		danger: 'bg-destructive/10 text-destructive border-destructive/20',
		info: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
	};

	const sizes: Record<NonNullable<Props['size']>, string> = {
		sm: 'px-2 py-0.5 text-[10px]',
		md: 'px-2.5 py-1 text-xs'
	};
</script>

<span
	class="inline-flex items-center rounded-full border text-center font-semibold transition-colors {variants[
		variant
	]} {sizes[size]}"
>
	{@render children()}
</span>
