<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import ResolveBoutModal from '$lib/components/leagues/ResolveBoutModal.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
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
	 * Bout detail — face-off view for a single bout. Shows sideA + sideB
	 * cards with their league names + accents, current scores (or a "—"
	 * placeholder pre-resolve), the state pill, the kickoff/settle
	 * window, and all the same inline transitions the inbox row exposes.
	 *
	 * Reads from `listMyBouts` then filters to the requested id. That's
	 * O(my-bouts) per render but our bout volumes are bounded by the
	 * caller's league count, so the cost is fine until we shard. A
	 * future `getBout` defineQuery would make this a single lookup.
	 */
	interface Props {
		boutId: string;
	}

	const { boutId }: Props = $props();

	let bouts: BoutDoc[] = $state([]);
	let memberships: LeagueWithRole[] = $state([]);
	let selfPrincipal: string | undefined = $state();
	let loadState: 'loading' | 'ready' | 'not_found' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);
	let actingBoutId = $state<string | null>(null);
	let resolveTarget = $state<BoutDoc | null>(null);
	let resolveOurSide = $state<string | null>(null);

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
			loadState = bouts.some((b) => b.id === boutId) ? 'ready' : 'not_found';
		} catch (err) {
			console.error('BoutDetailPage: load failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
			loadState = 'error';
		}
	};

	onMount(load);

	const bout = $derived(bouts.find((b) => b.id === boutId));

	const membershipByLeagueId = $derived.by(() => {
		const map = new SvelteMap<string, LeagueWithRole>();

		for (const m of memberships) {
			map.set(m.league.id, m);
		}

		return map;
	});

	const sideLabel = (sideId: string): string => {
		const mine = membershipByLeagueId.get(sideId);

		return mine?.league.name ?? sideId;
	};

	const sideAccent = (sideId: string): string =>
		membershipByLeagueId.get(sideId)?.league.accentColor ?? 'var(--laurel)';

	const ownedSide = $derived.by((): string | undefined => {
		if (!bout) {
			return;
		}

		const a = membershipByLeagueId.get(bout.sideA);

		if (a?.role === 'owner') {
			return bout.sideA;
		}

		const b = membershipByLeagueId.get(bout.sideB);

		return b?.role === 'owner' ? bout.sideB : undefined;
	});

	const stateLabelKey = (state: BoutState): MessageKey => {
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

	/**
	 * "Day X of Y" countdown when the bout is in flight. Day 1 starts
	 * at kickoff; the total floors to at least one day.
	 */
	const totalDays = $derived.by((): number => {
		if (!bout) {
			return 1;
		}

		const span = bout.settleMs - bout.kickoffMs;

		return Math.max(1, Math.ceil(span / DAY_IN_MS));
	});

	const dayOf = $derived.by((): number => {
		if (!bout) {
			return 1;
		}

		const elapsed = Date.now() - bout.kickoffMs;
		const days = Math.floor(elapsed / DAY_IN_MS) + 1;

		return Math.max(1, Math.min(totalDays, days));
	});

	const canAccept = $derived(bout?.state === 'proposed' && ownedSide === bout.sideB);
	const canKickoff = $derived(
		bout?.state === 'accepted' && ownedSide !== undefined && Date.now() >= bout.kickoffMs
	);
	const canResolve = $derived(
		bout?.state === 'in_flight' && ownedSide !== undefined && Date.now() >= bout.settleMs
	);
	const canRetract = $derived(
		bout?.state === 'proposed' && selfPrincipal !== undefined && bout.proposer === selfPrincipal
	);

	const handleAccept = async () => {
		if (!bout || actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await acceptBout({ bout });
			await load();
		} catch (err) {
			console.error('BoutDetailPage: acceptBout failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBoutId = null;
		}
	};

	const handleKickoff = async () => {
		if (!bout || actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await kickoffBout({ bout });
			await load();
		} catch (err) {
			console.error('BoutDetailPage: kickoffBout failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBoutId = null;
		}
	};

	const handleRetract = async () => {
		if (!bout || actingBoutId !== null) {
			return;
		}

		actingBoutId = bout.id;

		try {
			await retractBout({ bout });
			await load();
		} catch (err) {
			console.error('BoutDetailPage: retractBout failed', err);
			errorMessage = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			actingBoutId = null;
		}
	};

	const openResolve = () => {
		if (!bout || ownedSide === undefined) {
			return;
		}

		resolveTarget = bout;
		resolveOurSide = ownedSide;
	};

	const onResolveDone = () => {
		resolveTarget = null;
		resolveOurSide = null;
		void load();
	};

	const backToInbox = () => {
		void goto(`${resolve(AppPath.Social)}/bouts`);
	};
</script>

<div class="bout-detail">
	<MobileAppBar
		align="left"
		back={{
			label: t({ locale: $localeStore, key: 'bout.detail.back' }),
			onBack: backToInbox
		}}
		title={t({ locale: $localeStore, key: 'bout.detail.title' })}
	/>

	{#if loadState === 'loading'}
		<p class="bout-detail-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'bout.detail.loading' })}
		</p>
	{:else if loadState === 'error'}
		<p class="bout-detail-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
		</p>
	{:else if loadState === 'not_found' || !bout}
		<section class="bout-detail-empty">
			<h2>{t({ locale: $localeStore, key: 'bout.detail.not_found.title' })}</h2>
			<p>{t({ locale: $localeStore, key: 'bout.detail.not_found.sub' })}</p>
		</section>
	{:else}
		<section class="bout-detail-faceoff" data-state={bout.state}>
			<header class="bout-detail-faceoff-head">
				<span class="allcaps bout-detail-eyebrow" data-state={bout.state}>
					{t({ locale: $localeStore, key: stateLabelKey(bout.state) })}
				</span>
				{#if bout.state === 'in_flight'}
					<span class="num allcaps bout-detail-window">
						{t({
							locale: $localeStore,
							key: 'bout.detail.day_of',
							params: { day: dayOf, total: totalDays }
						})}
					</span>
				{:else if bout.state === 'proposed'}
					<span class="num allcaps bout-detail-window">
						{t({ locale: $localeStore, key: 'bout.detail.awaiting_acceptance' })}
					</span>
				{:else}
					<span class="num allcaps bout-detail-window">
						{formatDate(bout.kickoffMs)} → {formatDate(bout.settleMs)}
					</span>
				{/if}
			</header>

			<div class="bout-detail-stage">
				<div
					style:--team-accent={sideAccent(bout.sideA)}
					class="bout-detail-team"
					class:is-leading={bout.state === 'resolved' && bout.winner === 'A'}
				>
					<span class="bout-detail-emblem" aria-hidden="true">
						{sideLabel(bout.sideA).charAt(0)}
					</span>
					<span class="bout-detail-team-name">{sideLabel(bout.sideA)}</span>
					<span class="bout-detail-score num">
						{bout.scoreA ?? '—'}
					</span>
				</div>

				<span class="bout-detail-vs serif-italic">vs</span>

				<div
					style:--team-accent={sideAccent(bout.sideB)}
					class="bout-detail-team"
					class:is-leading={bout.state === 'resolved' && bout.winner === 'B'}
				>
					<span class="bout-detail-emblem" aria-hidden="true">
						{sideLabel(bout.sideB).charAt(0)}
					</span>
					<span class="bout-detail-team-name">{sideLabel(bout.sideB)}</span>
					<span class="bout-detail-score num">
						{bout.scoreB ?? '—'}
					</span>
				</div>
			</div>

			{#if bout.state === 'resolved' && bout.winner === 'draw'}
				<p class="allcaps bout-detail-winner">
					{t({ locale: $localeStore, key: 'leagues.bout.winner_draw' })}
				</p>
			{:else if bout.state === 'proposed'}
				<p class="serif-italic bout-detail-pending-foot">
					{t({ locale: $localeStore, key: 'bout.detail.pending_foot' })}
				</p>
			{/if}
		</section>

		<section class="bout-detail-meta">
			<div class="bout-detail-meta-row">
				<span class="eyebrow">{t({ locale: $localeStore, key: 'bout.detail.kind_label' })}</span>
				<span class="num allcaps">{bout.kind}</span>
			</div>
			<div class="bout-detail-meta-row">
				<span class="eyebrow">{t({ locale: $localeStore, key: 'bout.detail.proposer' })}</span>
				<span class="num bout-detail-meta-mono">
					{bout.proposer.slice(0, 5)}…{bout.proposer.slice(-5)}
				</span>
			</div>
		</section>

		<section class="bout-detail-actions">
			{#if canAccept}
				<button
					class="bout-detail-action is-primary"
					disabled={actingBoutId === bout.id}
					onclick={handleAccept}
					type="button"
				>
					{actingBoutId === bout.id
						? t({ locale: $localeStore, key: 'leagues.bout.action.accepting' })
						: t({ locale: $localeStore, key: 'leagues.bout.action.accept' })}
				</button>
			{:else if canKickoff}
				<button
					class="bout-detail-action is-primary"
					disabled={actingBoutId === bout.id}
					onclick={handleKickoff}
					type="button"
				>
					{actingBoutId === bout.id
						? t({ locale: $localeStore, key: 'leagues.bout.action.starting' })
						: t({ locale: $localeStore, key: 'leagues.bout.action.kickoff' })}
				</button>
			{:else if canResolve}
				<button class="bout-detail-action is-primary" onclick={openResolve} type="button">
					{t({ locale: $localeStore, key: 'leagues.bout.action.resolve' })}
				</button>
			{/if}
			{#if canRetract}
				<button
					class="bout-detail-action is-danger"
					disabled={actingBoutId === bout.id}
					onclick={handleRetract}
					type="button"
				>
					{actingBoutId === bout.id
						? t({ locale: $localeStore, key: 'leagues.bout.action.retracting' })
						: t({ locale: $localeStore, key: 'leagues.bout.action.retract' })}
				</button>
			{/if}
		</section>
	{/if}
</div>

{#if resolveTarget !== null && resolveOurSide !== null}
	<ResolveBoutModal
		bout={resolveTarget}
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
	.bout-detail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1.25rem 6rem;
	}

	.bout-detail-status,
	.bout-detail-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.bout-detail-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.bout-detail-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.bout-detail-empty {
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

	.bout-detail-empty h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-16, 1rem);
		color: var(--text-base);
	}

	.bout-detail-empty p {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.bout-detail-faceoff {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.bout-detail-faceoff[data-state='in_flight'] {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.bout-detail-faceoff-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.bout-detail-eyebrow {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.5rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--text-muted);
	}

	.bout-detail-eyebrow[data-state='in_flight'] {
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.bout-detail-window {
		font-size: var(--t-10, 0.65rem);
		color: var(--text-muted);
	}

	.bout-detail-stage {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.6rem;
		align-items: center;
	}

	.bout-detail-team {
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

	.bout-detail-team.is-leading {
		border-color: color-mix(in srgb, var(--team-accent) 55%, var(--border-base));
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--team-accent) 30%, transparent);
	}

	.bout-detail-emblem {
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

	.bout-detail-team-name {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	.bout-detail-score {
		font-size: var(--t-22, 1.4rem);
		font-weight: 700;
		color: var(--team-accent);
	}

	.bout-detail-vs {
		font-size: var(--t-14);
		color: var(--text-muted);
	}

	.bout-detail-winner {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		letter-spacing: var(--tracking-allcaps);
		text-align: center;
		color: var(--text-muted);
	}

	.bout-detail-pending-foot {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.45;
		text-align: center;
		color: var(--text-muted);
	}

	.bout-detail-meta {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.85rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.bout-detail-meta-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.bout-detail-meta-row .eyebrow {
		color: var(--text-muted);
	}

	.bout-detail-meta-mono {
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.bout-detail-actions {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.bout-detail-action {
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

	.bout-detail-action.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.bout-detail-action.is-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.bout-detail-action.is-danger {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.bout-detail-action.is-danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--no-wash, var(--no)) 20%, transparent);
	}

	.bout-detail-action:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
