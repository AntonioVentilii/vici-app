<script lang="ts">
	import { ArrowLeft, Copy, Check } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { functions } from '$declarations/satellite/satellite.api';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { leaveLeague, listMyLeagues, type LeagueWithRole } from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
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
	let loadState: 'loading' | 'ready' | 'not_member' | 'error' = $state('loading');
	let errorMessage: string | null = $state(null);
	let copied = $state(false);
	let leaving = $state(false);

	const load = async () => {
		try {
			const [memberships, memberList] = await Promise.all([
				listMyLeagues(),
				functions.listLeagueMembers({ leagueId })
			]);

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
			loadState = 'ready';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
			loadState = 'error';
		}
	};

	onMount(load);

	const canSeeInvite = $derived(myRole === 'owner' || myRole === 'admin');
	const canLeave = $derived(myRole !== 'owner' && myRole !== undefined);

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
						<span class="league-detail-member-name num">{shortPrincipal(member.member)}</span>
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
</style>
