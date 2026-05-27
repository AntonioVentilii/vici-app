<script lang="ts">
	import { Settings, User } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { navItems } from '$lib/constants/nav.constants';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { userIsAdmin, userSignedIn } from '$lib/derived/user.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Desktop chrome for the (app) shell — mirrors the LANDING page's
	 * top-nav pattern (brand wordmark on the left, primary nav in the
	 * middle, user controls on the right) so the desktop authenticated
	 * experience is a natural continuation of the marketing surface
	 * rather than a fake-mobile phone-frame wrapper.
	 *
	 * Hidden at <56rem (`hidden lg:flex`); the mobile floating pillnav
	 * owns the chrome below that breakpoint.
	 *
	 * Tab activation reuses the `navItems` taxonomy + the same active-
	 * state aliasing as `MobileNav` so deep links (e.g.
	 * `/markets/[id]` → Markets tab; `/settings` → Profile tab) light
	 * up the right item.
	 */

	const visibleNavItems = $derived(navItems.filter(({ adminOnly }) => !adminOnly || $userIsAdmin));

	const isActive = (path: AppPath) => {
		const current = page.url.pathname;

		if (current === path) {
			return true;
		}

		if (path === AppPath.Home && (current === '/app' || current.startsWith('/markets/'))) {
			return true;
		}

		if (path === AppPath.Dash && current === AppPath.Portfolio) {
			return true;
		}

		if (
			path === AppPath.Profile &&
			(current === AppPath.Wallet ||
				current === AppPath.Settings ||
				current === AppPath.Notifications ||
				current.startsWith('/profile/'))
		) {
			return true;
		}

		return false;
	};

	const userNickname = $derived($userStore.profile?.nickname);
</script>

<header class="app-desktop-nav">
	<div class="app-desktop-nav-inner">
		<a
			class="app-desktop-nav-brand"
			href={AppPath.Home}
			aria-label={t({ locale: $localeStore, key: 'a11y.landing' })}
		>
			VICI
		</a>

		<nav class="app-desktop-nav-links" aria-label="Primary">
			{#each visibleNavItems as item (item.path)}
				<a
					class="app-desktop-nav-link"
					class:is-active={isActive(item.path)}
					href={item.path}
				>
					{t({ locale: $localeStore, key: item.labelKey })}
				</a>
			{/each}
		</nav>

		<div class="app-desktop-nav-trailing">
			{#if $userSignedIn}
				<a
					class="app-desktop-nav-icon-btn"
					href={AppPath.Settings}
					aria-label={t({ locale: $localeStore, key: 'settings.title' })}
				>
					<Settings aria-hidden="true" size={18} strokeWidth={1.8} />
				</a>
				<a class="app-desktop-nav-handle" href={AppPath.Profile}>
					<User aria-hidden="true" size={14} strokeWidth={2} />
					<span>{userNickname ?? '@you'}</span>
				</a>
			{:else}
				<button
					class="app-desktop-nav-signin"
					onclick={() => void goto(PublicPath.SignIn)}
					type="button"
				>
					{t({ locale: $localeStore, key: 'cta.primary' })}
				</button>
			{/if}
		</div>
	</div>
</header>

<style lang="postcss">
	.app-desktop-nav {
		display: none;
	}

	@media (min-width: 56rem) {
		.app-desktop-nav {
			display: flex;
			justify-content: center;
			padding: 1rem 1.5rem 0.5rem;
			border-bottom: 1px solid var(--border-base);
			background: color-mix(in srgb, var(--bg-base) 92%, transparent);
			-webkit-backdrop-filter: blur(12px);
			backdrop-filter: blur(12px);
			position: sticky;
			top: 0;
			z-index: 40;
		}
	}

	.app-desktop-nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
		width: 100%;
		max-width: var(--content-max, 80rem);
	}

	.app-desktop-nav-brand {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.25rem;
		letter-spacing: 0.18em;
		color: var(--text-base);
		text-decoration: none;
	}

	.app-desktop-nav-links {
		display: flex;
		gap: 2rem;
		align-items: center;
	}

	.app-desktop-nav-link {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-muted);
		text-decoration: none;
		padding: 0.5rem 0;
		border-bottom: 2px solid transparent;
		transition:
			color var(--d-hover, 120ms) ease,
			border-color var(--d-hover, 120ms) ease;
	}

	.app-desktop-nav-link:hover {
		color: var(--text-base);
	}

	.app-desktop-nav-link.is-active {
		color: var(--text-base);
		border-bottom-color: var(--color-primary, var(--laurel));
	}

	.app-desktop-nav-trailing {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.app-desktop-nav-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--r-pill);
		color: var(--text-muted);
		text-decoration: none;
		transition:
			background-color var(--d-hover, 120ms) ease,
			color var(--d-hover, 120ms) ease;
	}

	.app-desktop-nav-icon-btn:hover {
		background: color-mix(in srgb, var(--text-base) 8%, transparent);
		color: var(--text-base);
	}

	.app-desktop-nav-handle {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.85rem;
		border-radius: var(--r-pill);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
		border: 1px solid var(--border-base);
		text-decoration: none;
	}

	.app-desktop-nav-handle:hover {
		border-color: var(--border-strong);
	}

	.app-desktop-nav-signin {
		appearance: none;
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1rem;
		border-radius: var(--r-pill);
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-primary-foreground, var(--ink));
		background: var(--color-primary, var(--laurel));
		border: 0;
		cursor: pointer;
		transition: background-color var(--d-hover, 120ms) ease;
	}

	.app-desktop-nav-signin:hover {
		background: color-mix(in srgb, var(--color-primary, var(--laurel)) 88%, var(--text-base));
	}
</style>