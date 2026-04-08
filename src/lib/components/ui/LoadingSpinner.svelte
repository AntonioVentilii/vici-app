<script lang="ts">
	interface Props {
		class?: string;
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'current';
		border?: 1 | 2 | 4;
		color?: string;
		center?: boolean;
	}

	const {
		class: className = '',
		size = 'md',
		border = 4,
		color = 'border-primary',
		center = true
	}: Props = $props();

	const sizeClasses = {
		xs: 'h-4 w-4',
		sm: 'h-6 w-6',
		md: 'h-10 w-10',
		lg: 'h-16 w-16',
		current: 'h-full w-full'
	};

	const borderClasses = {
		1: 'border',
		2: 'border-2',
		4: 'border-4'
	};
</script>

<div class={center ? `flex justify-center py-24 ${className}` : className}>
	<div
		class="animate-spin rounded-full border-t-transparent {sizeClasses[size]} {borderClasses[border]} {color}"
	></div>
</div>
