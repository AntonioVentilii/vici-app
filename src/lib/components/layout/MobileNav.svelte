<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { navItems } from '$lib/constants/nav.constants';
	import type { AppPath } from '$lib/constants/routes.constants';
	import { userIsAdmin } from '$lib/derived/user.derived';

	const isActive = (path: AppPath) => page.url.pathname === path;

	const handleNav = (path: AppPath) => {
		goto(path);
	};

	const visibleNavItems = $derived(navItems.filter(({ adminOnly }) => !adminOnly || $userIsAdmin));
</script>

<nav
	class="border-border bg-background/85 fixed bottom-0 left-0 z-50 flex w-full items-center border-t px-2 py-3 backdrop-blur-lg transition-all md:hidden"
>
	{#each visibleNavItems as { label, path, mobileIcon: Icon } (path)}
		<button
			class="relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 px-2 py-1 transition-colors {isActive(
				path
			)
				? 'text-foreground'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => handleNav(path)}
		>
			{#if isActive(path)}
				<span class="bg-primary absolute top-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full"
				></span>
			{/if}
			<Icon size="20" strokeWidth={isActive(path) ? 2.5 : 2} />
			<span class="max-w-full text-center text-xs font-medium wrap-break-word whitespace-normal">
				{label}
			</span>
		</button>
	{/each}
</nav>

<!-- Padding for fixed nav -->
<div class="h-20 md:hidden"></div>
