<script lang="ts">
	import { goto } from '$app/navigation';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { AppPath } from '$lib/constants/routes.constants';

	const handleNav = (path: AppPath) => {
		goto(path);
	};
</script>

<BaseButton class="group flex items-center gap-2" onclick={() => handleNav(AppPath.Home)}>
	<div
		class="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg font-bold shadow-lg transition-transform group-hover:scale-110"
	>
		V
	</div>
	<span
		class="text-foreground hidden font-serif text-xl font-extrabold tracking-tight drop-shadow-sm sm:block"
	>
		Veni. Vidi. <span class="text-primary">VICI</span>.
	</span>
</BaseButton>
