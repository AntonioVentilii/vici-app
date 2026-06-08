<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import ArenaStandingHero from '$lib/components/arena/ArenaStandingHero.svelte';
	import FriendsTab from '$lib/components/arena/FriendsTab.svelte';
	import PageScaffold from '$lib/components/layout/PageScaffold.svelte';
	import BattlesInboxPage from '$lib/components/pages/BattlesInboxPage.svelte';
	import LeaguesPage from '$lib/components/pages/LeaguesPage.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Arena — the three-tab page (Friends / Leagues /
	 * Battles) that anchors every cohort surface. Each tab embeds the
	 * existing page component with `embedded={true}` so their own
	 * appbars stay quiet; the tabbed parent renders the single
	 * "Arena" appbar above the tab strip.
	 *
	 * Tab state persists in localStorage under `vici.arena-tab`,
	 * so a user returning to /arena lands on the tab they last
	 * looked at. Legacy values (`worlds`, `global`) fall through to
	 * the new `friends` default.
	 */

	const STORAGE_KEY = 'vici.arena-tab';

	type Tab = 'friends' | 'leagues' | 'battles';

	const TAB_LABEL_KEY: Record<Tab, MessageKey> = {
		friends: 'arena.tabs.friends',
		leagues: 'arena.tabs.leagues',
		battles: 'arena.tabs.battles'
	};

	let activeTab: Tab = $state('friends');

	onMount(() => {
		if (!browser) {
			return;
		}

		try {
			const stored = localStorage.getItem(STORAGE_KEY);

			if (stored === 'leagues' || stored === 'battles') {
				activeTab = stored;
			} else {
				activeTab = 'friends';
			}
		} catch {
			activeTab = 'friends';
		}
	});

	$effect(() => {
		if (!browser) {
			return;
		}

		try {
			localStorage.setItem(STORAGE_KEY, activeTab);
		} catch {
			// localStorage may be blocked (private mode); not fatal.
		}
	});

	const TABS: readonly Tab[] = ['friends', 'leagues', 'battles'] as const;
</script>

<div class="arena-page">
	<PageScaffold title={t({ locale: $localeStore, key: 'arena.title' })}>
		<ArenaStandingHero onSelectTab={(tab) => (activeTab = tab)} />

		<div class="arena-tabs" aria-label="Arena sections" role="tablist">
			{#each TABS as tab (tab)}
				<button
					class="arena-tab"
					class:is-active={activeTab === tab}
					aria-selected={activeTab === tab}
					onclick={() => (activeTab = tab)}
					role="tab"
					type="button"
				>
					{t({ locale: $localeStore, key: TAB_LABEL_KEY[tab] })}
				</button>
			{/each}
		</div>

		<div class="arena-panel" role="tabpanel">
			<!-- Defend against malformed / legacy profile data: a single friend
			     row with an out-of-shape value could throw while rendering the
			     active tab. Because the app is `ssr=false`, an unhandled throw
			     escalates to the SvelteKit client error page (full-screen 500).
			     The boundary keeps any residual data-shape failure inline so the
			     rest of the Arena shell (appbar + tab strip) stays usable. -->
			<svelte:boundary>
				{#if activeTab === 'friends'}
					<FriendsTab />
				{:else if activeTab === 'leagues'}
					<LeaguesPage embedded />
				{:else if activeTab === 'battles'}
					<BattlesInboxPage embedded />
				{/if}

				{#snippet failed(_error, reset)}
					<div class="arena-boundary" role="alert">
						<p class="arena-boundary-title">
							{t({ locale: $localeStore, key: 'arena.boundary.title' })}
						</p>
						<p class="arena-boundary-body">
							{t({ locale: $localeStore, key: 'arena.boundary.body' })}
						</p>
						<button class="arena-boundary-retry" onclick={reset} type="button">
							{t({ locale: $localeStore, key: 'arena.boundary.retry' })}
						</button>
					</div>
				{/snippet}
			</svelte:boundary>
		</div>
	</PageScaffold>
</div>

<style lang="postcss">
	.arena-page {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0 1.25rem 6rem;
	}

	/* Segmented-control tab strip: the container carries a tinted
	   surface + border + radius; each tab flexes to share the row;
	   the active one looks like a raised pill (bg-elevated + soft
	   inset highlight + shadow). */
	.arena-tabs {
		display: flex;
		gap: 4px;
		padding: 3px;
		background: color-mix(in srgb, var(--text-base) 5%, transparent);
		border: 1px solid var(--border-base);
		border-radius: 10px;
	}

	.arena-tab {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		/* ≥44px tap target on the segmented tab control. */
		min-height: 44px;
		padding: 0.55rem 0.75rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 500;
		color: var(--text-muted);
		background: transparent;
		border: 0;
		border-radius: 7px;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background-color var(--d-state) cubic-bezier(0.22, 1, 0.36, 1),
			color var(--d-state) cubic-bezier(0.22, 1, 0.36, 1);
	}

	.arena-tab:hover {
		color: var(--text-base);
	}

	.arena-tab.is-active {
		color: var(--text-base);
		background: var(--bg-popover);
		box-shadow:
			0 1px 0 color-mix(in srgb, var(--text-base) 4%, transparent) inset,
			0 1px 2px rgba(0, 0, 0, 0.16);
	}

	.arena-tab:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
		outline-offset: 2px;
	}

	.arena-panel {
		flex: 1;
	}

	/* Inline fallback for the tab boundary — a quiet card, not a
	   full-screen error, so the surrounding Arena shell stays usable. */
	.arena-boundary {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
		margin: 1.5rem 0;
		padding: 1rem 1.1rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-popover);
	}

	.arena-boundary-title {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 600;
	}

	.arena-boundary-body {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-snug);
	}

	.arena-boundary-retry {
		margin-top: 0.35rem;
		padding: 0.45rem 0.9rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--border-base));
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
		font-size: var(--t-12);
		font-weight: 700;
		cursor: pointer;
		transition: background var(--d-state) ease;
	}

	.arena-boundary-retry:hover {
		background: color-mix(in srgb, var(--color-primary) 18%, transparent);
	}
</style>
