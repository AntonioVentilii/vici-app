<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
		size?: 'sm' | 'md';
	}

	const { children, variant = 'default', size = 'md' }: Props = $props();

	const variants: Record<NonNullable<Props['variant']>, string> = {
		default: 'bg-foreground/8 text-foreground border-foreground/25',
		success: 'bg-success/10 text-success border-success/35',
		warning: 'bg-warning/10 text-warning border-warning/35',
		danger: 'bg-destructive/10 text-destructive border-destructive/35',
		info: 'bg-primary/10 text-primary border-primary/35'
	};

	const sizes: Record<NonNullable<Props['size']>, string> = {
		sm: 'px-2 py-0.5 text-[10px]',
		md: 'px-2.5 py-1 text-xs'
	};
</script>

<span
	class="inline-flex items-center rounded-full border text-center font-bold tracking-wider uppercase transition-colors {variants[
		variant
	]} {sizes[size]}"
>
	{@render children()}
</span>
