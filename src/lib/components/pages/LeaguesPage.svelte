<script lang="ts">
	import { Plus, KeyRound } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import CreateLeagueModal from '$lib/components/leagues/CreateLeagueModal.svelte';
	import JoinLeagueModal from '$lib/components/leagues/JoinLeagueModal.svelte';
	import { listMyLeagues, type LeagueWithRole } from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { formatDate } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Social cohorts list page.
	 *
	 * Lists every league the caller is a member of via the satellite
	 * `listMyLeagues` query. Create + Join CTAs are stubs in this
	 * commit (FE-1c lands the modals that drive `createLeague` /
	 * `joinLeagueByInvite`).
	 */

	interface Props {
		// When true, hide the page's own appbar — the container is
		// expected to render one (e.g. the tabbed Social parent).
		embedded?: boolean;
	}

	const { embedded = false }: Props = $props();

	let leagues = $state<LeagueWithRole[]>([]);
	let loadState = $state<'loading' | 'ready' | 'error'>('loading');
	let errorMessage = $state<string | null>(null);
	let createOpen = $state(false);
	let joinOpen = $state(false);

	const refresh = async () => {
		try {
			leagues = await listMyLeagues();
			loadState = 'ready';
		} catch (err) {
			console.error('LeaguesPage: listMyLeagues failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
			loadState = 'error';
		}
	};

	onMount(refresh);

	const roleLabelKey = (role: LeagueWithRole['role']): MessageKey =>
		role === 'owner'
			? 'leagues.role.owner'
			: role === 'admin'
				? 'leagues.role.admin'
				: 'leagues.role.member';

	const openCreate = () => {
		createOpen = true;
	};

	const openJoin = () => {
		joinOpen = true;
	};

	// Both modals close themselves on success via the same callback —
	// they own their reset; this page just hides them and re-fetches.
	const handleAfterAction = () => {
		createOpen = false;
		joinOpen = false;
		void refresh();
	};
</script>

<div class="leagues-page space-y-6 pb-24">
	{#if !embedded}
		<MobileAppBar align="left" title={t({ locale: $localeStore, key: 'leagues.title' })} />
	{/if}

	<div class="leagues-actions">
		<button class="leagues-cta" onclick={openCreate} type="button">
			<Plus aria-hidden="true" size={16} strokeWidth={2.2} />
			<span>{t({ locale: $localeStore, key: 'leagues.action.create' })}</span>
		</button>
		<button class="leagues-cta is-secondary" onclick={openJoin} type="button">
			<KeyRound aria-hidden="true" size={16} strokeWidth={2.2} />
			<span>{t({ locale: $localeStore, key: 'leagues.action.join' })}</span>
		</button>
	</div>

	{#if loadState === 'loading'}
		<ul class="leagues-list" aria-busy="true">
			{#each Array.from({ length: 3 }) as _, i (i)}
				<li class="league-card is-skeleton" aria-hidden="true"></li>
			{/each}
		</ul>
	{:else if loadState === 'error'}
		<p class="leagues-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
		</p>
	{:else if leagues.length === 0}
		<section class="leagues-empty">
			<h2>{t({ locale: $localeStore, key: 'leagues.empty.title' })}</h2>
			<p>{t({ locale: $localeStore, key: 'leagues.empty.sub' })}</p>
			<div class="leagues-empty-ctas">
				<button class="leagues-cta" onclick={openCreate} type="button">
					{t({ locale: $localeStore, key: 'leagues.empty.cta_create' })}
				</button>
				<button class="leagues-cta is-secondary" onclick={openJoin} type="button">
					{t({ locale: $localeStore, key: 'leagues.empty.cta_join' })}
				</button>
			</div>
		</section>
	{:else}
		<ul class="leagues-list">
			{#each leagues as { league, role, joinedAtMs } (league.id)}
				<li style:--accent={league.accentColor ?? 'var(--laurel)'} class="league-card">
					<div class="league-card-head">
						<h3 class="league-card-name">{league.name}</h3>
						<span class="league-card-role allcaps" data-role={role}>
							{t({ locale: $localeStore, key: roleLabelKey(role) })}
						</span>
					</div>
					{#if league.description}
						<p class="league-card-desc">{league.description}</p>
					{/if}
					<p class="league-card-meta num">
						{t({
							locale: $localeStore,
							key: 'leagues.joined_on',
							params: { date: formatDate(joinedAtMs) }
						})}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<CreateLeagueModal
	isOpen={createOpen}
	onClose={() => (createOpen = false)}
	onCreated={handleAfterAction}
/>

<JoinLeagueModal
	isOpen={joinOpen}
	onClose={() => (joinOpen = false)}
	onJoined={handleAfterAction}
/>

<style lang="postcss">
	.leagues-page {
		padding: 0 1rem;
	}

	.leagues-actions {
		display: flex;
		gap: 0.6rem;
	}

	.leagues-cta {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.6rem 0.95rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease;
	}

	.leagues-cta:hover {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.leagues-cta.is-secondary {
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border-color: var(--border-base);
	}

	.leagues-cta.is-secondary:hover {
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		border-color: var(--border-strong);
	}

	.leagues-list {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.league-card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.9rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border: 1px solid var(--border-base);
		border-left: 3px solid var(--accent, var(--laurel));
		border-radius: var(--r-12);
	}

	.league-card.is-skeleton {
		min-height: 4.4rem;
		background: color-mix(in srgb, var(--bg-surface) 75%, transparent);
		border-left-color: color-mix(in srgb, var(--laurel) 30%, transparent);
		opacity: 0.55;
		animation: leagues-pulse 1.4s ease-in-out infinite;
	}

	@keyframes leagues-pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.75;
		}
	}

	.league-card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.league-card-name {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-16, 1rem);
		font-weight: 600;
		color: var(--text-base);
	}

	.league-card-role {
		font-size: var(--t-11, 0.7rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.15rem 0.45rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--accent);
	}

	.league-card-role[data-role='owner'] {
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.league-card-desc {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.league-card-meta {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.leagues-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		padding: 2.5rem 1.25rem;
		text-align: center;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-16, var(--r-12));
	}

	.leagues-empty h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-18, 1.1rem);
		color: var(--text-base);
	}

	.leagues-empty p {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
		max-width: 32ch;
	}

	.leagues-empty-ctas {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.45rem;
	}

	.leagues-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
		border-radius: var(--r-12);
	}
</style>
