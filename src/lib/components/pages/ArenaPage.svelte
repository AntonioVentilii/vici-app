<script lang="ts">
	import { Plus } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import FriendsTab from '$lib/components/arena/FriendsTab.svelte';
	import PageScaffold from '$lib/components/layout/PageScaffold.svelte';
	import BattlesInboxPage from '$lib/components/pages/BattlesInboxPage.svelte';
	import LeaguesPage from '$lib/components/pages/LeaguesPage.svelte';
	import { leaguesCreateIntent } from '$lib/stores/leagues-ui.store';
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

{#snippet arenaAppbarRight()}
	{#if activeTab === 'leagues'}
		<button
			class="appbar-icon-btn"
			aria-label={t({ locale: $localeStore, key: 'leagues.create.cta' })}
			onclick={() => leaguesCreateIntent.set(true)}
			type="button"
		>
			<Plus aria-hidden="true" size={18} strokeWidth={1.8} />
		</button>
	{/if}
{/snippet}

<div class="arena-page">
	<PageScaffold right={arenaAppbarRight} title={t({ locale: $localeStore, key: 'arena.title' })}>
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
			{#if activeTab === 'friends'}
				<FriendsTab />
			{:else if activeTab === 'leagues'}
				<LeaguesPage embedded />
			{:else if activeTab === 'battles'}
				<BattlesInboxPage embedded />
			{/if}
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

	/* The MobileAppBar already carries its own 1.25rem horizontal
	   padding so the title would otherwise sit at 2.5rem from the
	   screen edge while the tabs/content below align at 1.25rem.
	   Pull the appbar back to the edge so its title lines up with
	   the rest of the page. */
	.arena-page :global(.mobile-appbar) {
		margin-left: -1.25rem;
		margin-right: -1.25rem;
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
		flex: 1;
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
</style>
