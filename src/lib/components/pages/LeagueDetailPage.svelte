<script lang="ts">
	import { ArrowLeft, Copy, Check, Plus } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { functions } from '$declarations/satellite/satellite.api';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import ProposeBoutModal from '$lib/components/leagues/ProposeBoutModal.svelte';
	import ResolveBoutModal from '$lib/components/leagues/ResolveBoutModal.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import {
		acceptBout,
		kickoffBout,
		leaveLeague,
		listLeagueBouts,
		listMyLeagues,
		retractBout,
		type LeagueWithRole
	} from '$lib/services/leagues.services';
	import { loadProfilesByPrincipals } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { profilesStore } from '$lib/stores/profiles.store';
	import type { BoutDoc, BoutState } from '$lib/types/bout';
	import type { LeagueDoc } from '$lib/types/league';
	import type { LeagueMemberDoc, LeagueMemberRole } from '$lib/types/league-member';
	import { formatDate } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Phase 10 FE-2 — V1.2 league detail page.
	 *
	 * Mounts at `/social/leagues/[id]`. Renders the league header,
	 * member roster (via `listLeagueMembers`), the invite code for
	 * owners/admins (with copy-to-clipboard), and the caller's leave
	 * action (non-owners only — owners must transfer first).
	 */
	interface Props {
		leagueId: string;
	}

	const { leagueId }: Props = $props();

	let league: LeagueDoc | undefined = $state();
	let myRole: LeagueMemberRole | undefined = $state();
	let members: LeagueMemberDoc[] = $state([]);
	let bouts: BoutDoc[] = $state([]);
	let selfPrincipal: string | undefined = $state();
	let loadState: 'loading' | 'ready' | 'not_member' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);
	let copied = $state(false);
	let leaving = $state(false);
	let proposeOpen = $state(false);

	const load = async () => {
		try {
			const [memberships, memberList, boutList, identity] = await Promise.all([
				listMyLeagues(),
				functions.listLeagueMembers({ leagueId }),
				listLeagueBouts({ leagueId }),
				safeGetIdentityOnce()
			]);

			selfPrincipal = identity.getPrincipal().toText();

			const mine: LeagueWithRole | undefined = memberships.find((m) => m.league.id === leagueId);

			if (!mine) {
				loadState = 'not_member';

				return;
			}

			({ league, role: myRole } = mine);
			members = memberList.items.map((m) => ({
				leagueId: m.league_id,
				member: m.member,
				joinedAtMs: m.joined_at_ms,
				role: m.role
			}));
			bouts = boutList;
			// Hydrate handles/avatars for the member roster.
			// Fire-and-forget; the derived `memberHandle` picks up
			// nicknames once the cache lands.
			void loadProfilesByPrincipals({
				principals: memberList.items.map((m) => m.member)
			});
			loadState = 'ready';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
			loadState = 'error';
		}
	};

	onMount(load);

	const canSeeInvite = $derived(myRole === 'owner' || myRole === 'admin');
	const canLeave = $derived(myRole !== 'owner' && myRole !== undefined);
	const canProposeBout = $derived(myRole === 'owner');

	const handleBoutProposed = () => {
		proposeOpen = false;
		void load();
	};

	const handleCopyInvite = async () => {
		if (!league) {
			return;
		}

		try {
			await navigator.clipboard.writeText(league.inviteCode);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1600);
		} catch {
			// Clipboard may be unavailable (insecure context). Surface a
			// silent no-op; the user can still read the code on-screen.
		}
	};

	const handleLeave = async () => {
		if (!league || leaving) {
			return;
		}

		leaving = true;

		try {
			await leaveLeague({ leagueId: league.id });
			void goto(`${resolve(AppPath.Social)}/leagues`);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			leaving = false;
		}
	};

	const roleLabelKey = (role: LeagueMemberRole): MessageKey =>
		role === 'owner'
			? 'leagues.role.owner'
			: role === 'admin'
				? 'leagues.role.admin'
				: 'leagues.role.member';

	const shortPrincipal = (principal: string): string =>
		principal.length > 12 ? `${principal.slice(0, 5)}…${principal.slice(-5)}` : principal;

	const memberHandle = (principal: string): string => {
		const profile = $profilesStore.get(principal);

		if (profile?.nickname && profile.nickname.length > 0) {
			return `@${profile.nickname}`;
		}

		return shortPrincipal(principal);
	};

	// Bouts grouped by state. Order matches V1.2's prototype panel —
	// active first (in_flight), then near-term (accepted / proposed),
	// resolved at the bottom.
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

	// Resolve the opponent's league id for a bout — sideA or sideB,
	// whichever isn't us. Display only; full league hydration (name +
	// accent) would need a batched lookup which we defer.
	const opponentId = ({ bout, selfId }: { bout: BoutDoc; selfId: string }): string =>
		bout.sideA === selfId ? bout.sideB : bout.sideA;

	// Per-bout transition affordances. Owner-only — admins can promote
	// members but not move bouts, per the V1.2 spec.
	let actingBoutId = $state<string | null>(null);
	let resolveBoutTarget = $state<BoutDoc | null>(null);

	const canAcceptBout = (bout: BoutDoc): boolean =>
		myRole === 'owner' && bout.state === 'proposed' && bout.sideB === leagueId;

	const canKickoffBout = (bout: BoutDoc): boolean =>
		myRole === 'owner' &&
		bout.state === 'accepted' &&
		(bout.sideA === leagueId || bout.sideB === leagueId) &&
		Date.now() >= bout.kickoffMs;

	const canResolveBout = (bout: BoutDoc): boolean =>
		myRole === 'owner' &&
		bout.state === 'in_flight' &&
		(bout.sideA === leagueId || bout.sideB === leagueId) &&
		Date.now() >= bout.settleMs;

	const canRetractBout = (bout: BoutDoc): boolean =>
		bout.state === 'proposed' && selfPrincipal !== undefined && bout.proposer === selfPrincipal;

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

	const handleResolveBoutDone = () => {
		resolveBoutTarget = null;
		void load();
	};
</script>

<div class="league-detail">
	<MobileAppBar
		align="left"
		back={{
			label: t({ locale: $localeStore, key: 'leagues.detail.back' }),
			onBack: () => void goto(`${resolve(AppPath.Social)}/leagues`)
		}}
		title={league?.name ?? t({ locale: $localeStore, key: 'leagues.title' })}
	/>

	{#if loadState === 'loading'}
		<p class="league-detail-status" aria-busy="true">
			{t({ locale: $localeStore, key: 'leagues.detail.loading' })}
		</p>
	{:else if loadState === 'not_member'}
		<section class="league-detail-empty">
			<h2>{t({ locale: $localeStore, key: 'leagues.detail.not_member.title' })}</h2>
			<p>{t({ locale: $localeStore, key: 'leagues.detail.not_member.sub' })}</p>
			<a class="league-detail-back-link" href={`${resolve(AppPath.Social)}/leagues`}>
				<ArrowLeft aria-hidden="true" size={16} strokeWidth={2.2} />
				<span>{t({ locale: $localeStore, key: 'leagues.detail.back' })}</span>
			</a>
		</section>
	{:else if loadState === 'error'}
		<p class="league-detail-error" role="alert">
			{errorMessage ?? t({ locale: $localeStore, key: 'leagues.error.generic' })}
		</p>
	{:else if league}
		<header style:--accent={league.accentColor ?? 'var(--laurel)'} class="league-detail-head">
			<div class="league-detail-title-row">
				<h1>{league.name}</h1>
				{#if myRole}
					<span class="league-detail-role allcaps" data-role={myRole}>
						{t({ locale: $localeStore, key: roleLabelKey(myRole) })}
					</span>
				{/if}
			</div>
			{#if league.description}
				<p class="league-detail-desc">{league.description}</p>
			{/if}

			{#if canSeeInvite}
				<div class="league-detail-invite">
					<span class="allcaps league-detail-invite-label">
						{t({ locale: $localeStore, key: 'leagues.detail.invite_label' })}
					</span>
					<code class="league-detail-invite-code num">{league.inviteCode}</code>
					<button
						class="league-detail-invite-copy"
						aria-label={t({ locale: $localeStore, key: 'leagues.detail.invite_copy' })}
						onclick={handleCopyInvite}
						type="button"
					>
						{#if copied}
							<Check aria-hidden="true" size={14} strokeWidth={2.4} />
							<span>{t({ locale: $localeStore, key: 'leagues.detail.invite_copied' })}</span>
						{:else}
							<Copy aria-hidden="true" size={14} strokeWidth={2.2} />
							<span>{t({ locale: $localeStore, key: 'leagues.detail.invite_copy' })}</span>
						{/if}
					</button>
				</div>
			{/if}
		</header>

		<section class="league-detail-section">
			<h2 class="eyebrow league-detail-section-title">
				{t({
					locale: $localeStore,
					key: 'leagues.detail.members_eyebrow',
					params: { count: members.length }
				})}
			</h2>
			<ul class="league-detail-members">
				{#each members as member (member.member)}
					<li class="league-detail-member">
						<span class="league-detail-member-name num">{memberHandle(member.member)}</span>
						<span class="league-detail-member-role allcaps" data-role={member.role}>
							{t({ locale: $localeStore, key: roleLabelKey(member.role) })}
						</span>
						<span class="league-detail-member-joined num">
							{formatDate(member.joinedAtMs)}
						</span>
					</li>
				{/each}
			</ul>
		</section>

		<section class="league-detail-section">
			<div class="league-detail-bouts-head">
				<h2 class="eyebrow league-detail-section-title">
					{t({
						locale: $localeStore,
						key: 'leagues.detail.bouts_eyebrow',
						params: { count: bouts.length }
					})}
				</h2>
				{#if canProposeBout}
					<button class="league-detail-propose" onclick={() => (proposeOpen = true)} type="button">
						<Plus aria-hidden="true" size={14} strokeWidth={2.4} />
						<span>{t({ locale: $localeStore, key: 'leagues.bout.propose.cta_open' })}</span>
					</button>
				{/if}
			</div>

			{#if bouts.length === 0}
				<p class="league-detail-bouts-empty">
					{t({ locale: $localeStore, key: 'leagues.detail.bouts_empty' })}
				</p>
			{:else}
				{#each BOUT_STATE_ORDER as state (state)}
					{#if boutsByState[state].length > 0}
						<div class="league-detail-bouts-group">
							<h3 class="allcaps league-detail-bouts-group-title" data-state={state}>
								{t({ locale: $localeStore, key: boutStateLabelKey(state) })}
								<span class="num">· {boutsByState[state].length}</span>
							</h3>
							<ul class="league-detail-bouts">
								{#each boutsByState[state] as bout (bout.id)}
									<li class="league-detail-bout" data-state={bout.state}>
										<div class="league-detail-bout-head">
											<span class="num league-detail-bout-opponent">
												vs <span class="serif-italic">{opponentId({ bout, selfId: leagueId })}</span
												>
											</span>
											<span class="allcaps league-detail-bout-state" data-state={bout.state}>
												{t({ locale: $localeStore, key: boutStateLabelKey(bout.state) })}
											</span>
										</div>
										<p class="league-detail-bout-window num">
											{formatDate(bout.kickoffMs)} → {formatDate(bout.settleMs)}
										</p>
										{#if bout.state === 'resolved' && bout.winner !== undefined}
											<p class="league-detail-bout-winner allcaps" data-winner={bout.winner}>
												{#if bout.winner === 'draw'}
													{t({ locale: $localeStore, key: 'leagues.bout.winner_draw' })}
												{:else if (bout.winner === 'A' ? bout.sideA : bout.sideB) === leagueId}
													{t({ locale: $localeStore, key: 'leagues.bout.winner_us' })}
												{:else}
													{t({ locale: $localeStore, key: 'leagues.bout.winner_them' })}
												{/if}
												{#if bout.scoreA !== undefined && bout.scoreB !== undefined}
													<span class="num league-detail-bout-score">
														· {bout.sideA === leagueId
															? `${bout.scoreA}–${bout.scoreB}`
															: `${bout.scoreB}–${bout.scoreA}`}
													</span>
												{/if}
											</p>
										{/if}
										{#if canAcceptBout(bout)}
											<button
												class="league-detail-bout-action is-primary"
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
												class="league-detail-bout-action is-primary"
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
												class="league-detail-bout-action is-primary"
												onclick={() => (resolveBoutTarget = bout)}
												type="button"
											>
												{t({ locale: $localeStore, key: 'leagues.bout.action.resolve' })}
											</button>
										{/if}
										{#if canRetractBout(bout)}
											<button
												class="league-detail-bout-action is-danger"
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
						</div>
					{/if}
				{/each}
			{/if}
		</section>

		{#if canLeave}
			<div class="league-detail-actions">
				<button class="league-detail-leave" disabled={leaving} onclick={handleLeave} type="button">
					{t({
						locale: $localeStore,
						key: leaving ? 'leagues.detail.leaving' : 'leagues.detail.leave'
					})}
				</button>
			</div>
		{/if}
	{/if}
</div>

{#if canProposeBout}
	<ProposeBoutModal
		isOpen={proposeOpen}
		onClose={() => (proposeOpen = false)}
		onProposed={handleBoutProposed}
		ourLeagueId={leagueId}
	/>
{/if}

<ResolveBoutModal
	bout={resolveBoutTarget}
	isOpen={resolveBoutTarget !== null}
	onClose={() => (resolveBoutTarget = null)}
	onResolved={handleResolveBoutDone}
	ourLeagueId={leagueId}
/>

<style lang="postcss">
	.league-detail {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 0 1rem 6rem;
	}

	.league-detail-status,
	.league-detail-error {
		margin: 0;
		padding: 1rem;
		font-size: var(--t-13);
		border-radius: var(--r-12);
	}

	.league-detail-status {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
	}

	.league-detail-error {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.league-detail-empty {
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

	.league-detail-empty h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-16, 1rem);
		color: var(--text-base);
	}

	.league-detail-empty p {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.league-detail-back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.5rem;
		padding: 0.45rem 0.9rem;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--laurel);
		text-decoration: none;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
	}

	.league-detail-head {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1rem 1.1rem;
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border: 1px solid var(--border-base);
		border-left: 3px solid var(--accent, var(--laurel));
		border-radius: var(--r-12);
	}

	.league-detail-title-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.65rem;
	}

	.league-detail-head h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-22, 1.4rem);
		color: var(--text-base);
	}

	.league-detail-role {
		font-size: var(--t-11, 0.7rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.15rem 0.45rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--accent);
	}

	.league-detail-role[data-role='owner'] {
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.league-detail-desc {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.league-detail-invite {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
		margin-top: 0.35rem;
		padding: 0.6rem 0.75rem;
		background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
		border: 1px dashed color-mix(in srgb, var(--accent) 40%, var(--border-base));
		border-radius: var(--r-12);
	}

	.league-detail-invite-label {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.league-detail-invite-code {
		font-size: var(--t-16, 1rem);
		font-weight: 700;
		letter-spacing: 0.18em;
		color: var(--text-base);
	}

	.league-detail-invite-copy {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.55rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 600;
		color: var(--laurel);
		background: none;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}

	.league-detail-invite-copy:hover {
		background: color-mix(in srgb, var(--laurel) 10%, transparent);
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
	}

	.league-detail-section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.league-detail-section-title {
		margin: 0;
		color: var(--text-muted);
	}

	.league-detail-members {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.league-detail-member {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 0.85rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-member-name {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.league-detail-member-role {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--laurel) 18%, transparent);
		color: var(--laurel);
	}

	.league-detail-member-role[data-role='member'] {
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--text-muted);
	}

	.league-detail-member-joined {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.league-detail-actions {
		display: flex;
		justify-content: flex-end;
	}

	.league-detail-leave {
		appearance: none;
		padding: 0.65rem 1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
		border-radius: var(--r-12);
		cursor: pointer;
	}

	.league-detail-leave:hover:not(:disabled) {
		background: color-mix(in srgb, var(--no-wash, var(--no)) 20%, transparent);
	}

	.league-detail-leave:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.league-detail-bouts-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.league-detail-propose {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.65rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 35%, var(--border-base));
		border-radius: var(--r-pill);
		cursor: pointer;
	}

	.league-detail-propose:hover {
		background: color-mix(in srgb, var(--laurel) 20%, transparent);
	}

	.league-detail-bouts-empty {
		margin: 0;
		padding: 0.75rem 1rem;
		font-size: var(--t-13);
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-bouts-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.league-detail-bouts-group-title {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
		letter-spacing: var(--tracking-allcaps);
	}

	.league-detail-bouts-group-title[data-state='in_flight'] {
		color: var(--laurel);
	}

	.league-detail-bouts {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.league-detail-bout {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.7rem 0.85rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.league-detail-bout[data-state='in_flight'] {
		border-color: color-mix(in srgb, var(--laurel) 38%, var(--border-base));
	}

	.league-detail-bout-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.league-detail-bout-opponent {
		font-size: var(--t-13);
		color: var(--text-base);
	}

	.league-detail-bout-state {
		font-size: var(--t-10, 0.65rem);
		letter-spacing: var(--tracking-allcaps);
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--text-muted);
	}

	.league-detail-bout-state[data-state='in_flight'] {
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.league-detail-bout-state[data-state='resolved'] {
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
		opacity: 0.7;
	}

	.league-detail-bout-window {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.league-detail-bout-winner {
		margin: 0;
		font-size: var(--t-11, 0.7rem);
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
	}

	.league-detail-bout-score {
		margin-left: 0.25rem;
		color: var(--text-base);
	}

	.league-detail-bout-action {
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

	.league-detail-bout-action.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.league-detail-bout-action.is-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.league-detail-bout-action.is-danger {
		color: var(--no);
		background: color-mix(in srgb, var(--no-wash, var(--no)) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--no) 35%, var(--border-base));
	}

	.league-detail-bout-action.is-danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--no-wash, var(--no)) 20%, transparent);
	}

	.league-detail-bout-action:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
