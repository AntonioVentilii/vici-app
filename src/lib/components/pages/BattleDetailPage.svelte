<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/components/layout/ScreenHeader.svelte';
	import ResolveBattleModal from '$lib/components/leagues/ResolveBattleModal.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { isMarketTag, MARKET_TAG_LABEL_KEYS } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import {
		acceptBattle,
		kickoffBattle,
		listMyBattles,
		listMyLeagues,
		loadLeaguesByIds,
		retractBattle,
		type LeagueWithRole
	} from '$lib/services/leagues.services';
	import { leagueDirectoryStore } from '$lib/stores/league-directory.store';
	import { localeStore } from '$lib/stores/locale.store';
	import {
		BATTLE_SCOPE_DEFAULT,
		type BattleDoc,
		type BattleScope,
		type BattleState
	} from '$lib/types/battle';
	import { formatDate, shortLeagueId } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Battle detail — face-off view for a single battle. Shows sideA + sideB
	 * cards with their league names + accents, current scores (or a "—"
	 * placeholder pre-resolve), the state pill, the kickoff/settle
	 * window, and all the same inline transitions the inbox row exposes.
	 *
	 * Reads from `listMyBattles` then filters to the requested id. That's
	 * O(my-battles) per render but our battle volumes are bounded by the
	 * caller's league count, so the cost is fine until we shard. A
	 * future `getBattle` defineQuery would make this a single lookup.
	 */
	interface Props {
		battleId: string;
	}

	const { battleId }: Props = $props();

	let battles: BattleDoc[] = $state([]);
	let memberships: LeagueWithRole[] = $state([]);
	let selfPrincipal: string | undefined = $state();
	let loadState: 'loading' | 'ready' | 'not_found' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);
	let actingBattleId = $state<string | null>(null);
	let resolveTarget = $state<BattleDoc | null>(null);
	let resolveOurSide = $state<string | null>(null);

	const load = async () => {
		try {
			const [battleList, mineList, identity] = await Promise.all([
				listMyBattles(),
				listMyLeagues(),
				safeGetIdentityOnce()
			]);
			battles = battleList;
			memberships = mineList;
			selfPrincipal = identity.getPrincipal().toText();
			loadState = battles.some((b) => b.id === battleId) ? 'ready' : 'not_found';
		} catch (err) {
			console.error('BattleDetailPage: load failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
			loadState = 'error';
		}
	};

	onMount(load);

	const battle = $derived(battles.find((b) => b.id === battleId));

	const membershipByLeagueId = $derived.by(() => {
		const map = new SvelteMap<string, LeagueWithRole>();

		for (const m of memberships) {
			map.set(m.league.id, m);
		}

		return map;
	});

	// Resolve a side's league id to its current name (membership →
	// directory cache → shortened id). A 'duel' side is a principal, not
	// a league id, so both lookups miss and the shortened id stands.
	const sideLabel = (sideId: string): string =>
		membershipByLeagueId.get(sideId)?.league.name ??
		$leagueDirectoryStore.get(sideId)?.name ??
		shortLeagueId(sideId);

	const sideAccent = (sideId: string): string =>
		membershipByLeagueId.get(sideId)?.league.accentColor ??
		$leagueDirectoryStore.get(sideId)?.accentColor ??
		'var(--laurel)';

	// Hydrate the directory so the opponent side resolves too.
	$effect(() => {
		if (!battle) {
			return;
		}

		void loadLeaguesByIds({ ids: [battle.sideA, battle.sideB] });
	});

	const ownedSide = $derived.by((): string | undefined => {
		if (!battle) {
			return;
		}

		const a = membershipByLeagueId.get(battle.sideA);

		if (a?.role === 'owner') {
			return battle.sideA;
		}

		const b = membershipByLeagueId.get(battle.sideB);

		return b?.role === 'owner' ? battle.sideB : undefined;
	});

	// Localized scope label: `all` (or absent on legacy rows) reads
	// "All calls"; a market-tag scope reuses the canonical category
	// catalog so the label never drifts from the rest of the app.
	const scopeLabel = (scope: BattleScope | undefined): string => {
		const resolved = scope ?? BATTLE_SCOPE_DEFAULT;

		return resolved !== 'all' && isMarketTag(resolved)
			? t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[resolved] })
			: t({ locale: $localeStore, key: 'battle.detail.scope_all' });
	};

	const stateLabelKey = (state: BattleState): MessageKey => {
		switch (state) {
			case 'proposed':
				return 'leagues.battle.state.proposed';
			case 'accepted':
				return 'leagues.battle.state.accepted';
			case 'in_flight':
				return 'leagues.battle.state.in_flight';
			case 'resolved':
				return 'leagues.battle.state.resolved';
		}
	};

	/**
	 * "Day X of Y" countdown when the battle is in flight. Day 1 starts
	 * at kickoff; the total floors to at least one day.
	 */
	const totalDays = $derived.by((): number => {
		if (!battle) {
			return 1;
		}

		const span = battle.settleMs - battle.kickoffMs;

		return Math.max(1, Math.ceil(span / DAY_IN_MS));
	});

	const dayOf = $derived.by((): number => {
		if (!battle) {
			return 1;
		}

		const elapsed = Date.now() - battle.kickoffMs;
		const days = Math.floor(elapsed / DAY_IN_MS) + 1;

		return Math.max(1, Math.min(totalDays, days));
	});

	const canAccept = $derived(battle?.state === 'proposed' && ownedSide === battle.sideB);
	const canKickoff = $derived(
		battle?.state === 'accepted' && ownedSide !== undefined && Date.now() >= battle.kickoffMs
	);
	const canResolve = $derived(
		battle?.state === 'in_flight' && ownedSide !== undefined && Date.now() >= battle.settleMs
	);
	const canRetract = $derived(
		battle?.state === 'proposed' && selfPrincipal !== undefined && battle.proposer === selfPrincipal
	);

	const handleAccept = async () => {
		if (!battle || actingBattleId !== null) {
			return;
		}

		actingBattleId = battle.id;

		try {
			await acceptBattle({ battle });
			await load();
		} catch (err) {
			console.error('BattleDetailPage: acceptBattle failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBattleId = null;
		}
	};

	const handleKickoff = async () => {
		if (!battle || actingBattleId !== null) {
			return;
		}

		actingBattleId = battle.id;

		try {
			await kickoffBattle({ battle });
			await load();
		} catch (err) {
			console.error('BattleDetailPage: kickoffBattle failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBattleId = null;
		}
	};

	const handleRetract = async () => {
		if (!battle || actingBattleId !== null) {
			return;
		}

		actingBattleId = battle.id;

		try {
			await retractBattle({ battle });
			await load();
		} catch (err) {
			console.error('BattleDetailPage: retractBattle failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBattleId = null;
		}
	};

	const openResolve = () => {
		if (!battle || ownedSide === undefined) {
			return;
		}

		resolveTarget = battle;
		resolveOurSide = ownedSide;
	};

	const onResolveDone = () => {
		resolveTarget = null;
		resolveOurSide = null;
		void load();
	};

	const backToInbox = () => {
		void goto(`${resolve(AppPath.Arena)}/battles`);
	};
</script>

<div class="battle-detail">
	<ScreenHeader
		back={{
			label: t({ locale: $localeStore, key: 'battle.detail.back' }),
			onBack: backToInbox
		}}
		title={t({ locale: $localeStore, key: 'battle.detail.title' })}
	/>

	{#if loadState === 'loading'}
		<p class="battle-detail-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'battle.detail.loading' })}
		</p>
	{:else if loadState === 'error'}
		<p class="battle-detail-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
		</p>
	{:else if loadState === 'not_found' || !battle}
		<section class="battle-detail-empty">
			<h2>{t({ locale: $localeStore, key: 'battle.detail.not_found.title' })}</h2>
			<p>{t({ locale: $localeStore, key: 'battle.detail.not_found.sub' })}</p>
		</section>
	{:else}
		<section class="battle-detail-faceoff" data-state={battle.state}>
			<header class="battle-detail-faceoff-head">
				<span class="allcaps battle-detail-eyebrow" data-state={battle.state}>
					{t({ locale: $localeStore, key: stateLabelKey(battle.state) })}
				</span>
				{#if battle.state === 'in_flight'}
					<span class="num allcaps battle-detail-window">
						{t({
							locale: $localeStore,
							key: 'battle.detail.day_of',
							params: { day: dayOf, total: totalDays }
						})}
					</span>
				{:else if battle.state === 'proposed'}
					<span class="num allcaps battle-detail-window">
						{t({ locale: $localeStore, key: 'battle.detail.awaiting_acceptance' })}
					</span>
				{:else}
					<span class="num allcaps battle-detail-window">
						{formatDate(battle.kickoffMs)} → {formatDate(battle.settleMs)}
					</span>
				{/if}
			</header>

			<div class="battle-detail-stage">
				<div
					style:--team-accent={sideAccent(battle.sideA)}
					class="battle-detail-team"
					class:is-leading={battle.state === 'resolved' && battle.winner === 'A'}
				>
					<span class="battle-detail-emblem" aria-hidden="true">
						{sideLabel(battle.sideA).charAt(0)}
					</span>
					<span class="battle-detail-team-name">{sideLabel(battle.sideA)}</span>
					<span class="battle-detail-score num">
						{battle.scoreA ?? '—'}
					</span>
				</div>

				<span class="battle-detail-vs serif-italic">vs</span>

				<div
					style:--team-accent={sideAccent(battle.sideB)}
					class="battle-detail-team"
					class:is-leading={battle.state === 'resolved' && battle.winner === 'B'}
				>
					<span class="battle-detail-emblem" aria-hidden="true">
						{sideLabel(battle.sideB).charAt(0)}
					</span>
					<span class="battle-detail-team-name">{sideLabel(battle.sideB)}</span>
					<span class="battle-detail-score num">
						{battle.scoreB ?? '—'}
					</span>
				</div>
			</div>

			{#if battle.state === 'resolved' && battle.winner === 'draw'}
				<p class="allcaps battle-detail-winner">
					{t({ locale: $localeStore, key: 'leagues.battle.winner_draw' })}
				</p>
			{:else if battle.state === 'proposed'}
				<p class="serif-italic battle-detail-pending-foot">
					{t({ locale: $localeStore, key: 'battle.detail.pending_foot' })}
				</p>
			{/if}
		</section>

		<section class="battle-detail-meta">
			<div class="battle-detail-meta-row">
				<span class="eyebrow">{t({ locale: $localeStore, key: 'battle.detail.kind_label' })}</span>
				<span class="num allcaps">{battle.kind}</span>
			</div>
			<div class="battle-detail-meta-row">
				<span class="eyebrow">{t({ locale: $localeStore, key: 'battle.detail.scope_label' })}</span>
				<span class="num allcaps">{scopeLabel(battle.scope)}</span>
			</div>
			{#if battle.wager !== undefined && battle.wager > 0}
				<div class="battle-detail-meta-row">
					<span class="eyebrow"
						>{t({ locale: $localeStore, key: 'battle.detail.wager_label' })}</span
					>
					<span class="num">
						{t({
							locale: $localeStore,
							key: 'battle.detail.wager_value',
							params: { amount: battle.wager }
						})}
					</span>
				</div>
			{/if}
			<div class="battle-detail-meta-row">
				<span class="eyebrow">{t({ locale: $localeStore, key: 'battle.detail.proposer' })}</span>
				<span class="num battle-detail-meta-mono">
					{battle.proposer.slice(0, 5)}…{battle.proposer.slice(-5)}
				</span>
			</div>
		</section>

		{#if battle.trashTalk !== undefined && battle.trashTalk.length > 0}
			<section class="battle-detail-trash-talk">
				<span class="eyebrow">
					{t({ locale: $localeStore, key: 'battle.detail.trash_talk_label' })}
				</span>
				<p class="serif-italic battle-detail-trash-talk-quote">“{battle.trashTalk}”</p>
			</section>
		{/if}

		<section class="battle-detail-actions">
			{#if canAccept}
				<button
					class="battle-detail-action is-primary"
					disabled={actingBattleId === battle.id}
					onclick={handleAccept}
					type="button"
				>
					{actingBattleId === battle.id
						? t({ locale: $localeStore, key: 'leagues.battle.action.accepting' })
						: t({ locale: $localeStore, key: 'leagues.battle.action.accept' })}
				</button>
			{:else if canKickoff}
				<button
					class="battle-detail-action is-primary"
					disabled={actingBattleId === battle.id}
					onclick={handleKickoff}
					type="button"
				>
					{actingBattleId === battle.id
						? t({ locale: $localeStore, key: 'leagues.battle.action.starting' })
						: t({ locale: $localeStore, key: 'leagues.battle.action.kickoff' })}
				</button>
			{:else if canResolve}
				<button class="battle-detail-action is-primary" onclick={openResolve} type="button">
					{t({ locale: $localeStore, key: 'leagues.battle.action.resolve' })}
				</button>
			{/if}
			{#if canRetract}
				<button
					class="battle-detail-action is-danger"
					disabled={actingBattleId === battle.id}
					onclick={handleRetract}
					type="button"
				>
					{actingBattleId === battle.id
						? t({ locale: $localeStore, key: 'leagues.battle.action.retracting' })
						: t({ locale: $localeStore, key: 'leagues.battle.action.retract' })}
				</button>
			{/if}
		</section>
	{/if}
</div>

{#if resolveTarget !== null && resolveOurSide !== null}
	<ResolveBattleModal
		battle={resolveTarget}
		isOpen={true}
		onClose={() => {
			resolveTarget = null;
			resolveOurSide = null;
		}}
		onResolved={onResolveDone}
		ourLeagueId={resolveOurSide}
	/>
{/if}

<style lang="postcss">
	.battle-detail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem 6rem;
	}

	.battle-detail-status,
	.battle-detail-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.battle-detail-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.battle-detail-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.battle-detail-empty {
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

	.battle-detail-empty h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-16, 1rem);
		color: var(--text-base);
	}

	.battle-detail-empty p {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.battle-detail-faceoff {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.battle-detail-faceoff[data-state='in_flight'] {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.battle-detail-faceoff-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.battle-detail-eyebrow {
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.5rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--text-muted);
	}

	.battle-detail-eyebrow[data-state='in_flight'] {
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.battle-detail-window {
		font-size: var(--t-10);
		color: var(--text-muted);
	}

	.battle-detail-stage {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.6rem;
		align-items: center;
	}

	.battle-detail-team {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 0.8rem 0.5rem;
		background: color-mix(in srgb, var(--team-accent) 8%, var(--bg-surface));
		border: 1px solid color-mix(in srgb, var(--team-accent) 25%, var(--border-base));
		border-radius: var(--r-12);
		min-width: 0;
	}

	.battle-detail-team.is-leading {
		border-color: color-mix(in srgb, var(--team-accent) 55%, var(--border-base));
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--team-accent) 30%, transparent);
	}

	.battle-detail-emblem {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		font-size: var(--t-18, 1.2rem);
		font-weight: 700;
		color: var(--text-base);
		background: color-mix(in srgb, var(--team-accent) 22%, var(--bg-surface));
		border-radius: var(--r-pill);
	}

	.battle-detail-team-name {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	.battle-detail-score {
		font-size: var(--t-22, 1.4rem);
		font-weight: 700;
		color: var(--team-accent);
	}

	.battle-detail-vs {
		font-size: var(--t-14);
		color: var(--text-muted);
	}

	.battle-detail-winner {
		margin: 0;
		font-size: var(--t-11);
		letter-spacing: var(--tracking-allcaps);
		text-align: center;
		color: var(--text-muted);
	}

	.battle-detail-pending-foot {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.45;
		text-align: center;
		color: var(--text-muted);
	}

	.battle-detail-meta {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.85rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.battle-detail-meta-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.battle-detail-meta-row .eyebrow {
		color: var(--text-muted);
	}

	.battle-detail-meta-mono {
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.battle-detail-trash-talk {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.85rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.battle-detail-trash-talk .eyebrow {
		color: var(--text-muted);
	}

	.battle-detail-trash-talk-quote {
		margin: 0;
		font-size: var(--t-15, 0.95rem);
		line-height: 1.45;
		color: var(--text-base);
	}

	.battle-detail-actions {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.battle-detail-action {
		appearance: none;
		padding: 0.75rem 1.1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease;
	}

	.battle-detail-action.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.battle-detail-action.is-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.battle-detail-action.is-danger {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.battle-detail-action.is-danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--no-wash, var(--no)) 20%, transparent);
	}

	.battle-detail-action:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
