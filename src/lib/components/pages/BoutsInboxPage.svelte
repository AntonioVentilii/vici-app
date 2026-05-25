<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import ResolveBoutModal from '$lib/components/leagues/ResolveBoutModal.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import {
		acceptBout,
		kickoffBout,
		listMyBouts,
		listMyLeagues,
		retractBout,
		type LeagueWithRole
	} from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { BoutDoc, BoutState } from '$lib/types/bout';
	import { formatDate } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * cross-league bouts inbox.
	 *
	 * Aggregates every bout involving any of the caller's leagues into
	 * one timeline, grouped by state. Owners can act inline (Accept,
	 * Kickoff, Resolve) without bouncing through each league's detail
	 * page. League-name hydration uses the membership list so both
	 * sides can render their human-readable name + accent when known;
	 * unknown sides (e.g. an opponent league the caller isn't in) fall
	 * back to the league id.
	 */

	interface Props {
		// When true, hide the page's own appbar — the container is
		// expected to render one (e.g. the tabbed Social parent).
		embedded?: boolean;
	}

	const { embedded = false }: Props = $props();

	let bouts: BoutDoc[] = $state([]);
	let memberships: LeagueWithRole[] = $state([]);
	let selfPrincipal: string | undefined = $state();
	let loadState: 'loading' | 'ready' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);

	const load = async () => {
		try {
			const [boutList, mineList, identity] = await Promise.all([
				listMyBouts(),
				listMyLeagues(),
				safeGetIdentityOnce()
			]);
			bouts = boutList;
			memberships = mineList;
			selfPrincipal = identity.getPrincipal().toText();
			loadState = 'ready';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
			loadState = 'error';
		}
	};

	onMount(load);

	const membershipByLeagueId = $derived.by(() => {
		const map = new SvelteMap<string, LeagueWithRole>();

		for (const m of memberships) {
			map.set(m.league.id, m);
		}

		return map;
	});

	const myLeagueIds = $derived(new SvelteSet(memberships.map((m) => m.league.id)));

	const sideLabel = (sideId: string): string => {
		const mine = membershipByLeagueId.get(sideId);

		return mine?.league.name ?? sideId;
	};

	const sideAccent = (sideId: string): string =>
		membershipByLeagueId.get(sideId)?.league.accentColor ?? 'var(--laurel)';

	const BOUT_STATE_ORDER: readonly BoutState[] = [
		'in_flight',
		'accepted',
		'proposed',
		'resolved'
	] as const;

	const boutsByState = $derived.by(() => {
		const groups: Record<BoutState, BoutDoc[]> = {
			in_flight: [],
			accepted: [],
			proposed: [],
			resolved: []
		};

		for (const bout of bouts) {
			groups[bout.state].push(bout);
		}

		return groups;
	});

	const boutStateLabelKey = (state: BoutState): MessageKey => {
		switch (state) {
			case 'proposed':
				return 'leagues.bout.state.proposed';
			case 'accepted':
				return 'leagues.bout.state.accepted';
			case 'in_flight':
				return 'leagues.bout.state.in_flight';
			case 'resolved':
				return 'leagues.bout.state.resolved';
		}
	};

	// Owner-side controls — same rules as LeagueDetailPage but resolved
	// against whichever of the bout's two sides the caller owns.
	const ownedSide = (bout: BoutDoc): string | undefined => {
		const a = membershipByLeagueId.get(bout.sideA);

		if (a?.role === 'owner') {
			return bout.sideA;
		}

		const b = membershipByLeagueId.get(bout.sideB);

		return b?.role === 'owner' ? bout.sideB : undefined;
	};

	const canAcceptBout = (bout: BoutDoc): boolean => {
		const owned = ownedSide(bout);

		return owned !== undefined && bout.state === 'proposed' && bout.sideB === owned;
	};

	const canKickoffBout = (bout: BoutDoc): boolean =>
		ownedSide(bout) !== undefined && bout.state === 'accepted' && Date.now() >= bout.kickoffMs;

	const canResolveBout = (bout: BoutDoc): boolean =>
		ownedSide(bout) !== undefined && bout.state === 'in_flight' && Date.now() >= bout.settleMs;

	const canRetractBout = (bout: BoutDoc): boolean =>
		bout.state === 'proposed' && selfPrincipal !== undefined && bout.proposer === selfPrincipal;

	let actingBoutId = $state<string | null>(null);
	let resolveBoutTarget = $state<BoutDoc | null>(null);
	let resolveBoutOurSide = $state<string | null>(null);

	const handleAcceptBout = async (bout: BoutDoc) => {
		if (actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await acceptBout({ bout });
			await load();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			actingBoutId = null;
		}
	};

	const handleKickoffBout = async (bout: BoutDoc) => {
		if (actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await kickoffBout({ bout });
			await load();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			actingBoutId = null;
		}
	};

	const openResolve = (bout: BoutDoc) => {
		const owned = ownedSide(bout);

		if (owned === undefined) {
			return;
		}

		resolveBoutTarget = bout;
		resolveBoutOurSide = owned;
	};

	const handleRetractBout = async (bout: BoutDoc) => {
		if (actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await retractBout({ bout });
			await load();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			actingBoutId = null;
		}
	};

	const handleResolveDone = () => {
		resolveBoutTarget = null;
		resolveBoutOurSide = null;
		void load();
	};

	const goToLeague = (leagueId: string) => {
		if (!myLeagueIds.has(leagueId)) {
			return;
		}

		void goto(`${resolve(AppPath.Social)}/leagues/${leagueId}`);
	};

	const goToBoutDetail = (bout: BoutDoc) => {
		void goto(`${resolve(AppPath.Social)}/bouts/${bout.id}`);
	};
</script>

<div class="bouts-inbox">
	{#if !embedded}
		<MobileAppBar
			align="left"
			back={{
				label: t({ locale: $localeStore, key: 'leagues.bouts_inbox.back' }),
				onBack: () => void goto(resolve(AppPath.Social))
			}}
			title={t({ locale: $localeStore, key: 'leagues.bouts_inbox.title' })}
		/>
	{/if}

	<p class="bouts-inbox-sub">
		{t({ locale: $localeStore, key: 'leagues.bouts_inbox.sub' })}
	</p>

	{#if loadState === 'loading'}
		<p class="bouts-inbox-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'leagues.bouts_inbox.loading' })}
		</p>
	{:else if loadState === 'error'}
		<p class="bouts-inbox-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
		</p>
	{:else if bouts.length === 0}
		<section class="bouts-inbox-empty">
			<h2>{t({ locale: $localeStore, key: 'leagues.bouts_inbox.empty.title' })}</h2>
			<p>{t({ locale: $localeStore, key: 'leagues.bouts_inbox.empty.sub' })}</p>
		</section>
	{:else}
		{#each BOUT_STATE_ORDER as state (state)}
			{#if boutsByState[state].length > 0}
				<section class="bouts-inbox-group">
					<h2 class="allcaps bouts-inbox-group-title" data-state={state}>
						{t({ locale: $localeStore, key: boutStateLabelKey(state) })}
						<span class="num">· {boutsByState[state].length}</span>
					</h2>
					<ul class="bouts-inbox-list">
						{#each boutsByState[state] as bout (bout.id)}
							{@const owned = ownedSide(bout)}
							<li class="bouts-inbox-bout" data-state={bout.state}>
								<div class="bouts-inbox-bout-head">
									<div class="bouts-inbox-sides">
										<button
											style:--side-accent={sideAccent(bout.sideA)}
											class="bouts-inbox-side"
											data-known={membershipByLeagueId.has(bout.sideA)}
											data-ours={owned === bout.sideA}
											disabled={!myLeagueIds.has(bout.sideA)}
											onclick={() => goToLeague(bout.sideA)}
											type="button"
										>
											{sideLabel(bout.sideA)}
										</button>
										<span class="bouts-inbox-vs serif-italic">vs</span>
										<button
											style:--side-accent={sideAccent(bout.sideB)}
											class="bouts-inbox-side"
											data-known={membershipByLeagueId.has(bout.sideB)}
											data-ours={owned === bout.sideB}
											disabled={!myLeagueIds.has(bout.sideB)}
											onclick={() => goToLeague(bout.sideB)}
											type="button"
										>
											{sideLabel(bout.sideB)}
										</button>
									</div>
									<button
										class="bouts-inbox-state-link"
										onclick={() => goToBoutDetail(bout)}
										type="button"
									>
										<span class="allcaps bouts-inbox-state" data-state={bout.state}>
											{t({ locale: $localeStore, key: boutStateLabelKey(bout.state) })}
										</span>
										<span aria-hidden="true">→</span>
									</button>
								</div>
								<p class="bouts-inbox-window num">
									{formatDate(bout.kickoffMs)} → {formatDate(bout.settleMs)}
								</p>
								{#if bout.state === 'resolved' && bout.winner !== undefined && owned !== undefined}
									<p class="bouts-inbox-winner allcaps" data-winner={bout.winner}>
										{#if bout.winner === 'draw'}
											{t({ locale: $localeStore, key: 'leagues.bout.winner_draw' })}
										{:else if (bout.winner === 'A' ? bout.sideA : bout.sideB) === owned}
											{t({ locale: $localeStore, key: 'leagues.bout.winner_us' })}
										{:else}
											{t({ locale: $localeStore, key: 'leagues.bout.winner_them' })}
										{/if}
										{#if bout.scoreA !== undefined && bout.scoreB !== undefined}
											<span class="num bouts-inbox-score">
												· {bout.sideA === owned
													? `${bout.scoreA}–${bout.scoreB}`
													: `${bout.scoreB}–${bout.scoreA}`}
											</span>
										{/if}
									</p>
								{/if}
								{#if canAcceptBout(bout)}
									<button
										class="bouts-inbox-action is-primary"
										disabled={actingBoutId === bout.id}
										onclick={() => handleAcceptBout(bout)}
										type="button"
									>
										{actingBoutId === bout.id
											? t({ locale: $localeStore, key: 'leagues.bout.action.accepting' })
											: t({ locale: $localeStore, key: 'leagues.bout.action.accept' })}
									</button>
								{:else if canKickoffBout(bout)}
									<button
										class="bouts-inbox-action is-primary"
										disabled={actingBoutId === bout.id}
										onclick={() => handleKickoffBout(bout)}
										type="button"
									>
										{actingBoutId === bout.id
											? t({ locale: $localeStore, key: 'leagues.bout.action.starting' })
											: t({ locale: $localeStore, key: 'leagues.bout.action.kickoff' })}
									</button>
								{:else if canResolveBout(bout)}
									<button
										class="bouts-inbox-action is-primary"
										onclick={() => openResolve(bout)}
										type="button"
									>
										{t({ locale: $localeStore, key: 'leagues.bout.action.resolve' })}
									</button>
								{/if}
								{#if canRetractBout(bout)}
									<button
										class="bouts-inbox-action is-danger"
										disabled={actingBoutId === bout.id}
										onclick={() => handleRetractBout(bout)}
										type="button"
									>
										{actingBoutId === bout.id
											? t({ locale: $localeStore, key: 'leagues.bout.action.retracting' })
											: t({ locale: $localeStore, key: 'leagues.bout.action.retract' })}
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/each}
	{/if}
</div>

{#if resolveBoutTarget !== null && resolveBoutOurSide !== null}
	<ResolveBoutModal
		bout={resolveBoutTarget}
		isOpen={true}
		onClose={() => {
			resolveBoutTarget = null;
			resolveBoutOurSide = null;
		}}
		onResolved={handleResolveDone}
		ourLeagueId={resolveBoutOurSide}
	/>
{/if}

<style lang="postcss">
	.bouts-inbox {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 0 1rem 6rem;
	}

	.bouts-inbox-sub {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.bouts-inbox-status,
	.bouts-inbox-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.bouts-inbox-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.bouts-inbox-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.bouts-inbox-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2.5rem 1rem;
		text-align: center;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.bouts-inbox-empty h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-16, 1rem);
		color: var(--text-base);
	}

	.bouts-inbox-empty p {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.bouts-inbox-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.bouts-inbox-group-title {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
		letter-spacing: var(--tracking-allcaps);
	}

	.bouts-inbox-group-title[data-state='in_flight'] {
		color: var(--laurel);
	}

	.bouts-inbox-list {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.bouts-inbox-bout {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.75rem 0.9rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.bouts-inbox-bout[data-state='in_flight'] {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.bouts-inbox-bout-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.bouts-inbox-sides {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.bouts-inbox-side {
		appearance: none;
		padding: 0.2rem 0.5rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
		background: color-mix(in srgb, var(--side-accent) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--side-accent) 30%, var(--border-base));
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.bouts-inbox-side:disabled {
		cursor: default;
		color: var(--text-muted);
		background: none;
		border-color: var(--border-base);
	}

	.bouts-inbox-side[data-ours='true'] {
		font-weight: 700;
		color: var(--side-accent);
	}

	.bouts-inbox-vs {
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.bouts-inbox-state-link {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0;
		font: inherit;
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
	}

	.bouts-inbox-state-link:hover {
		color: var(--text-base);
	}

	.bouts-inbox-state {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--text-muted);
	}

	.bouts-inbox-state[data-state='in_flight'] {
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.bouts-inbox-state[data-state='resolved'] {
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
		opacity: 0.7;
	}

	.bouts-inbox-window {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.bouts-inbox-winner {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.bouts-inbox-score {
		margin-left: 0.25rem;
		color: var(--text-base);
	}

	.bouts-inbox-action {
		appearance: none;
		align-self: flex-start;
		margin-top: 0.3rem;
		padding: 0.4rem 0.85rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease;
	}

	.bouts-inbox-action.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.bouts-inbox-action.is-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.bouts-inbox-action.is-danger {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.bouts-inbox-action.is-danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--no-wash, var(--no)) 20%, transparent);
	}

	.bouts-inbox-action:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
