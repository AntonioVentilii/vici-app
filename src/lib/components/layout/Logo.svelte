<script lang="ts">
	import { goto } from '$app/navigation';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { AppPath } from '$lib/constants/routes.constants';

	const handleNav = (path: AppPath) => {
		goto(path);
	};
</script>

<BaseButton class="group flex items-center" onclick={() => handleNav(AppPath.Home)}>
	<span
		style="letter-spacing: 0.18em;"
		class="text-primary font-display text-xl font-bold uppercase transition-all duration-200 group-hover:[text-shadow:0_0_12px_var(--laurel-glow)]"
	>
		VICI
	</span>
</BaseButton>
