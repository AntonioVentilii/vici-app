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
	class="border-border bg-background/80 fixed bottom-0 left-0 z-50 flex w-full items-center border-t px-2 py-3 backdrop-blur-lg transition-all md:hidden"
>
	{#each visibleNavItems as { label, path, mobileIcon: Icon } (path)}
		<button
			class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-1 transition-colors {isActive(
				path
			)
				? 'text-primary'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => handleNav(path)}
		>
			<Icon size="20" strokeWidth={isActive(path) ? 2.5 : 2} />
			<span class="max-w-full text-center text-xs font-medium wrap-break-word whitespace-normal"
				>{label}</span
			>
		</button>
	{/each}
</nav>

<!-- Padding for fixed nav -->
<div class="h-20 md:hidden"></div>
