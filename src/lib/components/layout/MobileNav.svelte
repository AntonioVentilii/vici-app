<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { navItems } from '$lib/constants/nav.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { userIsAdmin } from '$lib/derived/user.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	// Routes that don't have their own nav slot but should still light
	// up a parent tab (per `docs/ai/frontend/design.md` §8.4 active-
	// state cascade). Markets owns the detail-by-id sub-route; Profile
	// owns the personal-area routes that branch off from it.
	const isActive = (path: AppPath) => {
		const current = page.url.pathname;

		if (current === path) {
			return true;
		}

		// The Markets nav button is configured as `AppPath.Home` (the
		// markets feed lives at `/`), so detail pages like
		// `/markets/[id]` should still light it up.
		if (path === AppPath.Home && current.startsWith('/markets/')) {
			return true;
		}

		if (
			path === AppPath.Profile &&
			(current === AppPath.Wallet ||
				current === AppPath.Settings ||
				current === AppPath.Notifications)
		) {
			return true;
		}

		return false;
	};

	const handleNav = (path: AppPath) => {
		goto(path);
	};

	const visibleNavItems = $derived(navItems.filter(({ adminOnly }) => !adminOnly || $userIsAdmin));
</script>

<nav
	class="border-ink-line fixed bottom-0 left-0 z-50 grid w-full grid-cols-5 border-t bg-[rgba(14,13,11,0.85)] px-2 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] backdrop-blur-[24px] md:hidden"
>
	{#each visibleNavItems as { labelKey, path, mobileIcon: Icon } (path)}
		{@const isFlow = labelKey === 'nav.flow'}
		<button
			class="ease-vici duration-state relative flex flex-col items-center justify-center gap-1 transition-colors
				{isFlow
				? 'bg-primary text-ink shadow-mobilenav-active mx-1 -mt-2.5 rounded-2xl py-3'
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
				{t({ locale: $localeStore, key: labelKey })}
			</span>
		</button>
	{/each}
</nav>

<div class="h-20 md:hidden"></div>
