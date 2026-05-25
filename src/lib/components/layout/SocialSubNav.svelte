<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Horizontal sub-nav strip for the `/social/*` family. Mounts at
	 * the top of every social sub-page so the user can move between
	 * Feed / Leagues / Bouts / Worlds / Leaderboard without bouncing
	 * back to the bottom-nav.
	 *
	 * Active tab matches by path-prefix so e.g.
	 * `/social/leagues/[id]` highlights the Leagues tab.
	 */

	interface Tab {
		key: MessageKey;
		hrefSuffix: '' | '/leagues' | '/bouts' | '/worlds' | '/leaderboard';
		matchPrefix: string;
	}

	const TABS: readonly Tab[] = [
		{ key: 'social.subnav.feed', hrefSuffix: '', matchPrefix: '' },
		{ key: 'social.subnav.leagues', hrefSuffix: '/leagues', matchPrefix: '/leagues' },
		{ key: 'social.subnav.bouts', hrefSuffix: '/bouts', matchPrefix: '/bouts' },
		{ key: 'social.subnav.worlds', hrefSuffix: '/worlds', matchPrefix: '/worlds' },
		{
			key: 'social.subnav.leaderboard',
			hrefSuffix: '/leaderboard',
			matchPrefix: '/leaderboard'
		}
	];

	const base = $derived(resolve(AppPath.Social));

	const currentSubPath = $derived(() => {
		const { pathname } = page.url;
		const idx = pathname.indexOf(base);

		if (idx === -1) {
			return '';
		}

		return pathname.slice(idx + base.length);
	});

	const isActive = (matchPrefix: string): boolean => {
		const sub = currentSubPath();

		if (matchPrefix === '') {
			return sub === '' || sub === '/';
		}

		return sub === matchPrefix || sub.startsWith(`${matchPrefix}/`);
	};
</script>

<nav class="social-subnav" aria-label="Social sub-navigation">
	<div class="social-subnav-strip">
		{#each TABS as tab (tab.hrefSuffix)}
			<a
				class="social-subnav-tab"
				class:is-active={isActive(tab.matchPrefix)}
				href={`${base}${tab.hrefSuffix}`}
			>
				{t({ locale: $localeStore, key: tab.key })}
			</a>
		{/each}
	</div>
</nav>

<style lang="postcss">
	.social-subnav {
		margin: 0 -1rem;
		padding: 0 1rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.social-subnav::-webkit-scrollbar {
		display: none;
	}

	.social-subnav-strip {
		display: inline-flex;
		gap: 0.4rem;
		padding: 0.2rem 0 0.4rem;
	}

	.social-subnav-tab {
		display: inline-flex;
		align-items: center;
		padding: 0.4rem 0.85rem;
		font-size: var(--t-12);
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--text-muted);
		text-decoration: none;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		white-space: nowrap;
		transition:
			color 140ms ease,
			border-color 140ms ease,
			background 140ms ease;
	}

	.social-subnav-tab:hover {
		color: var(--text-base);
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
	}

	.social-subnav-tab.is-active {
		color: var(--text-base);
		background: color-mix(in srgb, var(--laurel) 18%, var(--bg-surface));
		border-color: color-mix(in srgb, var(--laurel) 50%, var(--border-base));
	}
</style>
