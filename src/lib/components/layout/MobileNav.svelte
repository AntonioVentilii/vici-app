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
	class="fixed bottom-0 left-0 z-50 grid w-full grid-cols-5 border-t border-[var(--ink-line)] bg-[rgba(14,13,11,0.85)] px-2 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] backdrop-blur-[24px] md:hidden"
>
	{#each visibleNavItems as { label, path, mobileIcon: Icon } (path)}
		{@const isFlow = label === 'Flow'}
		<button
			class="relative flex cursor-pointer flex-col items-center justify-center gap-1 transition-colors duration-[var(--d-state)] ease-[var(--ease-vici)]
				{isFlow
				? 'bg-primary mx-1 -mt-2.5 rounded-2xl py-3 text-[var(--ink)] shadow-[0_8px_24px_-8px_var(--laurel-glow),inset_0_1px_0_rgba(255,255,255,0.3)]'
				: isActive(path)
					? 'text-foreground py-2'
					: 'text-muted-foreground hover:text-foreground py-2'}"
			onclick={() => handleNav(path)}
		>
			{#if !isFlow && isActive(path)}
				<span class="bg-primary absolute -top-px left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full"
				></span>
			{/if}
			<Icon size={isFlow ? 22 : 20} strokeWidth={isActive(path) ? 2.5 : 1.6} />
			<span style="letter-spacing: 0.06em;" class="text-center text-[10px] font-semibold uppercase">
				{label}
			</span>
		</button>
	{/each}
</nav>

<!-- Padding for fixed nav -->
<div class="h-20 md:hidden"></div>
