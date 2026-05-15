<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
		size?: 'sm' | 'md';
	}

	const { children, variant = 'default', size = 'md' }: Props = $props();

	const variants: Record<NonNullable<Props['variant']>, string> = {
		default: 'bg-foreground/8 text-foreground border-foreground/15',
		success: 'bg-[var(--yes-wash)] text-[var(--yes)] border-[var(--yes)]/25',
		warning: 'bg-[var(--laurel-glow)] text-primary border-primary/25',
		danger: 'bg-[var(--no-wash)] text-destructive border-destructive/25',
		info: 'bg-[var(--hold-wash)] text-[var(--hold)] border-[var(--hold)]/25'
	};

	const sizes: Record<NonNullable<Props['size']>, string> = {
		sm: 'px-2 py-0.5 text-[10px]',
		md: 'px-2.5 py-1 text-xs'
	};
</script>

<span
	class="inline-flex items-center gap-1 rounded-[4px] border text-center font-bold uppercase transition-colors {variants[
		variant
	]} {sizes[size]}"
	style="letter-spacing: 0.08em;"
>
	{@render children()}
</span>
