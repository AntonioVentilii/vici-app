<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import BoutsInboxPage from '$lib/components/pages/BoutsInboxPage.svelte';
	import FriendsPage from '$lib/components/pages/FriendsPage.svelte';
	import LeaguesPage from '$lib/components/pages/LeaguesPage.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Social — the three-tab page (Friends / Leagues /
	 * Bouts) that anchors every cohort surface. Each tab embeds the
	 * existing page component with `embedded={true}` so their own
	 * appbars stay quiet; the tabbed parent renders the single
	 * "Social" appbar above the tab strip.
	 *
	 * Tab state persists in localStorage under `vici.social-tab` —
	 * same key the prototype uses, so a user returning to /social
	 * lands on the tab they last looked at. Legacy values (`worlds`,
	 * `global`) fall through to the new `friends` default.
	 */

	const STORAGE_KEY = 'vici.social-tab';

	type Tab = 'friends' | 'leagues' | 'bouts';

	const TAB_LABEL_KEY: Record<Tab, MessageKey> = {
		friends: 'social.tabs.friends',
		leagues: 'social.tabs.leagues',
		bouts: 'social.tabs.bouts'
	};

	let activeTab: Tab = $state('friends');

	onMount(() => {
		if (!browser) {
			return;
		}

		try {
			const stored = localStorage.getItem(STORAGE_KEY);

			if (stored === 'leagues' || stored === 'bouts') {
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

	const TABS: readonly Tab[] = ['friends', 'leagues', 'bouts'] as const;
</script>

<div class="social-page">
	<MobileAppBar align="left" title={t({ locale: $localeStore, key: 'social.title' })} />

	<div class="social-tabs" aria-label="Social sections" role="tablist">
		{#each TABS as tab (tab)}
			<button
				class="social-tab"
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

	<div class="social-panel" role="tabpanel">
		{#if activeTab === 'friends'}
			<FriendsPage embedded />
		{:else if activeTab === 'leagues'}
			<LeaguesPage embedded />
		{:else if activeTab === 'bouts'}
			<BoutsInboxPage embedded />
		{/if}
	</div>
</div>

<style lang="postcss">
	.social-page {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding-bottom: 6rem;
	}

	.social-tabs {
		display: inline-flex;
		gap: 0.4rem;
		padding: 0.1rem 1rem 0.4rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.social-tabs::-webkit-scrollbar {
		display: none;
	}

	.social-tab {
		appearance: none;
		padding: 0.45rem 0.95rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
		white-space: nowrap;
		transition:
			color 140ms ease,
			border-color 140ms ease,
			background 140ms ease;
	}

	.social-tab:hover {
		color: var(--text-base);
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
	}

	.social-tab.is-active {
		color: var(--text-base);
		background: color-mix(in srgb, var(--laurel) 18%, var(--bg-surface));
		border-color: color-mix(in srgb, var(--laurel) 50%, var(--border-base));
	}

	.social-panel {
		flex: 1;
	}
</style>
