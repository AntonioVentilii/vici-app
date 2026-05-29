<script lang="ts">
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import { leaderboard } from '$lib/derived/leaderboard.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	// We don't yet have a "top predictors *on this market*" satellite
	// query — slice the global leaderboard to approximate it. Top 4
	// by points until we wire a per-market aggregate (tracked in the
	// follow-up backlog).
	const top = $derived($leaderboard.slice(0, 4));

	// Crowd lean drives the side-pill on each row — tag each row with
	// the actual crowd-favoured side so the rows feel grounded in the
	// live market.
	const crowdSide = $derived(market.yesProbability >= market.noProbability ? 'YES' : 'NO');
</script>

<!-- "Top predictors here" mini-leaderboard. Reads from the cached
     global leaderboard store (already populated by `LoaderLeaderboard`
     on app boot) so the section paints instantly without a fresh
     fetch. -->
<section class="market-top-predictors" aria-labelledby="market-top-predictors-h">
	<header class="market-top-predictors-head">
		<h3 id="market-top-predictors-h" class="market-top-predictors-title">
			{t({ locale: $localeStore, key: 'market.detail.top_predictors.title' })}
		</h3>
		<span class="market-top-predictors-more">
			{t({ locale: $localeStore, key: 'market.detail.top_predictors.all' })}
		</span>
	</header>

	{#if top.length === 0}
		<p class="market-top-predictors-empty">
			{t({ locale: $localeStore, key: 'market.detail.top_predictors.empty' })}
		</p>
	{:else}
		<ul class="market-top-predictors-list">
			{#each top as user (user.owner)}
				<li class="market-top-predictors-row">
					<div class="market-top-predictors-id">
						<Avatar
							class="market-top-predictors-avatar"
							avatar={user.avatar}
							nickname={user.nickname}
							owner={user.owner}
						/>
						<div class="market-top-predictors-meta">
							<span class="market-top-predictors-name">
								{user.nickname !== '' ? user.nickname : user.owner.slice(0, 8)}
							</span>
							<span class="num market-top-predictors-sub">
								{Math.round(user.accuracy)}%
								{t({ locale: $localeStore, key: 'market.detail.top_predictors.acc' })} ·
								{user.streak}{t({
									locale: $localeStore,
									key: 'market.detail.top_predictors.streak'
								})}
							</span>
						</div>
					</div>
					<span class="market-top-predictors-side" class:is-no={crowdSide === 'NO'}>
						{crowdSide === 'YES'
							? t({ locale: $localeStore, key: 'outcome.yes' })
							: t({ locale: $localeStore, key: 'outcome.no' })}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style lang="postcss">
	.market-top-predictors {
		padding: 0.5rem 1.25rem 1.25rem;
	}

	.market-top-predictors-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0 0.75rem;
	}

	.market-top-predictors-title {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-16);
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.market-top-predictors-more {
		color: var(--laurel);
		font-size: var(--t-12);
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.market-top-predictors-empty {
		margin: 0;
		padding: 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		color: var(--text-muted);
		font-size: var(--t-13);
	}

	.market-top-predictors-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.market-top-predictors-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
	}

	.market-top-predictors-id {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
	}

	:global(.market-top-predictors-avatar) {
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
	}

	.market-top-predictors-meta {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.market-top-predictors-name {
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.market-top-predictors-sub {
		color: var(--text-muted);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.market-top-predictors-side {
		flex-shrink: 0;
		padding: 0.2rem 0.5rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--yes) 12%, transparent);
		color: var(--yes);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.market-top-predictors-side.is-no {
		background: color-mix(in srgb, var(--no) 12%, transparent);
		color: var(--no);
	}
</style>
