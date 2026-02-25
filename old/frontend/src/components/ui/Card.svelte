<script lang="ts">
	import { cn } from '@/lib/utils';
	export let className: string = '';
</script>

<div class={cn('bg-card text-card-foreground rounded-xl border shadow-sm', className)} on:click>
	<slot />
</div>
