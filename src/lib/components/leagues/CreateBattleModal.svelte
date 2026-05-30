<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { listMyLeagues, type LeagueWithRole } from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Create-battle entry point. Reachable from any social surface
	 * (BattlesInboxPage empty state, etc) — not tied to a specific
	 * league context.
	 *
	 *  - If the caller owns 0 leagues → empty state with
	 *    "Go to Leagues" CTA.
	 *  - If the caller owns 1+ leagues → list them; selecting one
	 *    navigates to that league's detail page with
	 *    `?propose=1` so the existing `ProposeBattleModal` opens
	 *    auto-magically with that league as `ourLeagueId`. Keeps the
	 *    propose form in one place.
	 *
	 * Empty + picker flow, minus the per-battle configuration screen —
	 * that lives in `ProposeBattleModal` already.
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
			console.error('CreateBattleModal: listMyLeagues failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
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
		void goto(`${resolve(AppPath.Arena)}/leagues/${leagueId}?propose=1`);
	};

	const goToLeagues = () => {
		onClose();
		void goto(`${resolve(AppPath.Arena)}/leagues`);
	};
</script>

<BottomSheet {isOpen} {onClose}>
	<div class="create-battle">
		<h2 class="create-battle-title">
			{t({ locale: $localeStore, key: 'battle.create.title' })}
		</h2>

		{#if loadState === 'loading'}
			<p class="create-battle-status" aria-busy="true">
				{t({ locale: $localeStore, key: 'battle.create.loading' })}
			</p>
		{:else if loadState === 'error'}
			<p class="create-battle-error" role="alert">
				{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
			</p>
		{:else if ownedLeagues.length === 0}
			<p class="create-battle-empty-lede serif-italic">
				{t({ locale: $localeStore, key: 'battle.create.empty.lede' })}
			</p>
			<p class="create-battle-empty-sub">
				{t({ locale: $localeStore, key: 'battle.create.empty.sub' })}
			</p>
			<button class="create-battle-cta" onclick={goToLeagues} type="button">
				{t({ locale: $localeStore, key: 'battle.create.empty.cta' })}
			</button>
		{:else}
			<p class="create-battle-sub">
				{t({ locale: $localeStore, key: 'battle.create.pick_league' })}
			</p>
			<ul class="create-battle-list">
				{#each ownedLeagues as { league } (league.id)}
					<li>
						<button
							style:--accent={league.accentColor ?? 'var(--laurel)'}
							class="create-battle-league"
							onclick={() => pickLeague(league.id)}
							type="button"
						>
							<span class="create-battle-league-name">{league.name}</span>
							<span aria-hidden="true">→</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</BottomSheet>

<style lang="postcss">
	.create-battle {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 0.25rem 0 0.5rem;
	}

	.create-battle-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-18, 1.15rem);
		font-weight: 600;
		color: var(--text-base);
	}

	.create-battle-sub {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.create-battle-status,
	.create-battle-error {
		margin: 0;
		padding: 0.85rem 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.create-battle-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.create-battle-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.create-battle-empty-lede {
		margin: 0;
		font-size: var(--t-15, 1rem);
		color: var(--laurel);
	}

	.create-battle-empty-sub {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.create-battle-cta {
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

	.create-battle-list {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.create-battle-league {
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

	.create-battle-league:hover {
		background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
		border-color: color-mix(in srgb, var(--laurel) 35%, var(--border-base));
	}

	.create-battle-league-name {
		font-size: var(--t-14);
		font-weight: 600;
	}
</style>
