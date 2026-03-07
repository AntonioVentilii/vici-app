<script lang="ts">
	interface Props {
		checked: boolean;
		disabled?: boolean;
	}

	let { checked = $bindable(), disabled = false }: Props = $props();

	const toggle = () => {
		if (disabled) {
			return;
		}

		checked = !checked;
	};
</script>

<button
	class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 {checked
		? 'bg-indigo-600'
		: 'bg-slate-200'}"
	aria-checked={checked}
	aria-label="Toggle switch"
	{disabled}
	onclick={toggle}
	role="switch"
	type="button"
>
	<span
		class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out {checked
			? 'translate-x-4'
			: 'translate-x-0'}"
		aria-hidden="true"
	></span>
</button>
