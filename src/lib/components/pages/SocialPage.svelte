<script lang="ts">
	import { Plus } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import BoutsInboxPage from '$lib/components/pages/BoutsInboxPage.svelte';
	import FriendsPage from '$lib/components/pages/FriendsPage.svelte';
	import LeaguesPage from '$lib/components/pages/LeaguesPage.svelte';
	import { leaguesCreateIntent } from '$lib/stores/leagues-ui.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Social — the three-tab page (Friends / Leagues /
	 * Bouts) that anchors every cohort surface. Each tab embeds the
	 * existing page component with `embedded={true}` so their own
	 * appbars stay quiet; the tabbed parent renders the single
	 * "Social" appbar above the tab strip.
	 *
	 * Tab state persists in localStorage under `vici.social-tab`,
	 * so a user returning to /social lands on the tab they last
	 * looked at. Legacy values (`worlds`, `global`) fall through to
	 * the new `friends` default.
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

{#snippet socialAppbarRight()}
	{#if activeTab === 'leagues'}
		<button
			class="social-appbar-cta"
			aria-label={t({ locale: $localeStore, key: 'leagues.create.cta' })}
			onclick={() => leaguesCreateIntent.set(true)}
			type="button"
		>
			<Plus aria-hidden="true" size={18} strokeWidth={1.8} />
		</button>
	{/if}
{/snippet}

<div class="social-page">
	<MobileAppBar
		align="left"
		right={socialAppbarRight}
		title={t({ locale: $localeStore, key: 'social.title' })}
	/>

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

	.social-appbar-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		color: var(--text-base);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.social-appbar-cta:hover {
		background: var(--bg-popover);
		border-color: var(--border-strong);
	}

	/* Underline-active tab strip — matches the design source's
	   `.social-tabs` (`screens.jsx:2523-2533`). Tabs are
	   border-less labels; the active one carries a 2px accent
	   underline below the text. No pill background, no border ring. */
	.social-tabs {
		display: inline-flex;
		gap: 1.25rem;
		padding: 0 1rem 0;
		border-bottom: 1px solid var(--border-base);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.social-tabs::-webkit-scrollbar {
		display: none;
	}

	.social-tab {
		appearance: none;
		padding: 0.55rem 0.1rem 0.65rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
		background: transparent;
		border: 0;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		white-space: nowrap;
		transition: color 140ms ease;
	}

	.social-tab:hover {
		color: var(--text-base);
	}

	.social-tab.is-active {
		color: var(--text-base);
		border-bottom-color: var(--color-primary);
	}

	.social-panel {
		flex: 1;
	}
</style>
