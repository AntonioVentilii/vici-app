<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
		size?: 'xs' | 'sm' | 'md';
	}

	const { children, variant = 'default', size = 'md' }: Props = $props();

	const variants: Record<NonNullable<Props['variant']>, string> = {
		default: 'border-border bg-foreground/6 text-muted-foreground',
		success: 'bg-yes-wash text-yes border-yes/25',
		warning: 'bg-laurel-glow text-primary border-primary/25',
		danger: 'bg-danger-wash text-danger border-danger/25',
		info: 'bg-hold-wash text-hold border-hold/25'
	};

	const sizes: Record<NonNullable<Props['size']>, string> = {
		xs: 'px-1.5 py-0.5 text-[9px]',
		sm: 'px-2 py-0.5 text-[10px]',
		md: 'px-2.5 py-1 text-xs'
	};
</script>

<span
	style="letter-spacing: 0.08em;"
	class="shadow-inset-hi inline-flex items-center gap-1 rounded-full border text-center font-bold uppercase transition-colors {variants[
		variant
	]} {sizes[size]}"
>
	{@render children()}
</span>
