<script lang="ts">
	import { onMount } from 'svelte';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import SocialSubNav from '$lib/components/layout/SocialSubNav.svelte';
	import { listSocialFeed } from '$lib/services/social-feed.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { SocialFeedEntryDoc, SocialFeedEntryKind } from '$lib/types/social-feed';
	import { formatDate } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Phase 10 FE-6 — global social-feed surface.
	 *
	 * Renders the global cohort activity log: leagues joined, bouts
	 * proposed/accepted/resolved, Worlds affiliations claimed.
	 * Entries are written by satellite hooks (BE-12) on their source
	 * collections, so this page is read-only.
	 */

	let entries: SocialFeedEntryDoc[] = $state([]);
	let loadState: 'loading' | 'ready' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);

	const load = async () => {
		try {
			entries = await listSocialFeed({});
			loadState = 'ready';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
			loadState = 'error';
		}
	};

	onMount(load);

	const kindLabelKey = (kind: SocialFeedEntryKind): MessageKey => {
		switch (kind) {
			case 'league_joined':
				return 'social.feed.kind.league_joined';
			case 'bout_proposed':
				return 'social.feed.kind.bout_proposed';
			case 'bout_accepted':
				return 'social.feed.kind.bout_accepted';
			case 'bout_resolved':
				return 'social.feed.kind.bout_resolved';
			case 'affiliation_set':
				return 'social.feed.kind.affiliation_set';
		}
	};

	const shortPrincipal = (principal: string): string =>
		principal.length > 12 ? `${principal.slice(0, 5)}…${principal.slice(-5)}` : principal;
</script>

<div class="social-feed">
	<MobileAppBar align="left" title={t({ locale: $localeStore, key: 'social.feed.title' })} />

	<SocialSubNav />

	<p class="social-feed-sub">{t({ locale: $localeStore, key: 'social.feed.sub' })}</p>

	{#if loadState === 'loading'}
		<p class="social-feed-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'social.feed.loading' })}
		</p>
	{:else if loadState === 'error'}
		<p class="social-feed-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'social.feed.error.generic' })}
		</p>
	{:else if entries.length === 0}
		<section class="social-feed-empty">
			<h2>{t({ locale: $localeStore, key: 'social.feed.empty.title' })}</h2>
			<p>{t({ locale: $localeStore, key: 'social.feed.empty.sub' })}</p>
		</section>
	{:else}
		<ul class="social-feed-list">
			{#each entries as entry (`${entry.createdAtMs}/${entry.actor}/${entry.kind}/${entry.refId}`)}
				<li class="social-feed-entry" data-kind={entry.kind}>
					<div class="social-feed-entry-head">
						<span class="num social-feed-entry-actor">{shortPrincipal(entry.actor)}</span>
						<span class="allcaps social-feed-entry-kind">
							{t({ locale: $localeStore, key: kindLabelKey(entry.kind) })}
						</span>
					</div>
					<p class="num social-feed-entry-ref">{entry.refId}</p>
					{#if entry.context}
						<p class="social-feed-entry-context">{entry.context}</p>
					{/if}
					<p class="num social-feed-entry-time">{formatDate(entry.createdAtMs)}</p>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="postcss">
	.social-feed {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1rem 6rem;
	}

	.social-feed-sub {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.social-feed-status,
	.social-feed-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.social-feed-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.social-feed-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.social-feed-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2.5rem 1.25rem;
		text-align: center;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.social-feed-empty h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-16, 1rem);
		color: var(--text-base);
	}

	.social-feed-empty p {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
		max-width: 32ch;
	}

	.social-feed-list {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.social-feed-entry {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.7rem 0.85rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-left: 3px solid var(--text-muted);
		border-radius: var(--r-12);
	}

	.social-feed-entry[data-kind='bout_resolved'] {
		border-left-color: var(--laurel);
	}

	.social-feed-entry[data-kind='bout_proposed'],
	.social-feed-entry[data-kind='bout_accepted'] {
		border-left-color: color-mix(in srgb, var(--laurel) 55%, transparent);
	}

	.social-feed-entry[data-kind='league_joined'],
	.social-feed-entry[data-kind='affiliation_set'] {
		border-left-color: color-mix(in srgb, var(--text-muted) 55%, transparent);
	}

	.social-feed-entry-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.social-feed-entry-actor {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
	}

	.social-feed-entry-kind {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--text-muted);
	}

	.social-feed-entry-ref {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-base);
	}

	.social-feed-entry-context {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.social-feed-entry-time {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}
</style>
