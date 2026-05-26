<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { listMyLeagues, type LeagueWithRole } from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Create-bout entry point. Reachable from any social surface
	 * (BoutsInboxPage empty state, etc) — not tied to a specific
	 * league context.
	 *
	 *  - If the caller owns 0 leagues → empty state with
	 *    "Go to Leagues" CTA.
	 *  - If the caller owns 1+ leagues → list them; selecting one
	 *    navigates to that league's detail page with
	 *    `?propose=1` so the existing `ProposeBoutModal` opens
	 *    auto-magically with that league as `ourLeagueId`. Keeps the
	 *    propose form in one place.
	 *
	 * Empty + picker flow, minus the per-bout configuration screen —
	 * that lives in `ProposeBoutModal` already.
	 */
	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	const { isOpen, onClose }: Props = $props();

	let leagues = $state<LeagueWithRole[]>([]);
	let loadState = $state<'loading' | 'ready' | 'error'>('loading');
	let errorMessage = $state<string | null>(null);

	const ownedLeagues = $derived(leagues.filter((m) => m.role === 'owner'));

	const load = async () => {
		if (loadState === 'ready') {
			return;
		}

		try {
			leagues = await listMyLeagues();
			loadState = 'ready';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
			loadState = 'error';
		}
	};

	onMount(load);

	$effect(() => {
		if (isOpen) {
			void load();
		}
	});

	const pickLeague = (leagueId: string) => {
		onClose();
		void goto(`${resolve(AppPath.Social)}/leagues/${leagueId}?propose=1`);
	};

	const goToLeagues = () => {
		onClose();
		void goto(`${resolve(AppPath.Social)}/leagues`);
	};
</script>

<Modal {isOpen} {onClose}>
	<div class="create-bout">
		<h2 class="create-bout-title">
			{t({ locale: $localeStore, key: 'bout.create.title' })}
		</h2>

		{#if loadState === 'loading'}
			<p class="create-bout-status" aria-busy="true">
				{t({ locale: $localeStore, key: 'bout.create.loading' })}
			</p>
		{:else if loadState === 'error'}
			<p class="create-bout-error" role="alert">
				{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
			</p>
		{:else if ownedLeagues.length === 0}
			<p class="create-bout-empty-lede serif-italic">
				{t({ locale: $localeStore, key: 'bout.create.empty.lede' })}
			</p>
			<p class="create-bout-empty-sub">
				{t({ locale: $localeStore, key: 'bout.create.empty.sub' })}
			</p>
			<button class="create-bout-cta" onclick={goToLeagues} type="button">
				{t({ locale: $localeStore, key: 'bout.create.empty.cta' })}
			</button>
		{:else}
			<p class="create-bout-sub">
				{t({ locale: $localeStore, key: 'bout.create.pick_league' })}
			</p>
			<ul class="create-bout-list">
				{#each ownedLeagues as { league } (league.id)}
					<li>
						<button
							style:--accent={league.accentColor ?? 'var(--laurel)'}
							class="create-bout-league"
							onclick={() => pickLeague(league.id)}
							type="button"
						>
							<span class="create-bout-league-name">{league.name}</span>
							<span aria-hidden="true">→</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Modal>

<style lang="postcss">
	.create-bout {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1rem 1.1rem;
	}

	.create-bout-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-18, 1.15rem);
		font-weight: 600;
		color: var(--text-base);
	}

	.create-bout-sub {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.create-bout-status,
	.create-bout-error {
		margin: 0;
		padding: 0.85rem 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.create-bout-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.create-bout-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.create-bout-empty-lede {
		margin: 0;
		font-size: var(--t-15, 1rem);
		color: var(--laurel);
	}

	.create-bout-empty-sub {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.create-bout-cta {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 0.4rem;
		padding: 0.85rem 1.25rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.create-bout-list {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.create-bout-league {
		appearance: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.85rem 1rem;
		font: inherit;
		text-align: left;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border: 1px solid var(--border-base);
		border-left: 3px solid var(--accent, var(--laurel));
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease;
	}

	.create-bout-league:hover {
		background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
		border-color: color-mix(in srgb, var(--laurel) 35%, var(--border-base));
	}

	.create-bout-league-name {
		font-size: var(--t-14);
		font-weight: 600;
	}
</style>
