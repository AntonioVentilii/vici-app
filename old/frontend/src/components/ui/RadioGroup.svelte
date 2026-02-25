<script lang="ts" context="module">
	import { writable } from 'svelte/store';
	export const radioGroupContext = Symbol('radioGroup');
</script>

<script lang="ts">
	import { setContext } from 'svelte';
	import { cn } from '../../lib/utils';

	export let value: string = '';
	export let className: string = '';
	export let onValueChange: (value: string) => void = () => {};

	const valueStore = writable(value);
	$: valueStore.set(value);

	setContext(radioGroupContext, {
		valueStore,
		setValue: (v: string) => {
			value = v;
			onValueChange(v);
		}
	});
</script>

<div class={cn('grid gap-2', className)} role="radiogroup">
	<slot />
</div>
