<script lang="ts">
	import { ArrowRight, Check } from 'lucide-svelte/icons';
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import type { ClearingDid } from '$declarations';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { PLAYGROUND_CLEARING_MARGIN_DECIMALS } from '$lib/constants/playground.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import {
		deleteMyAccount,
		hibernateMyAccount,
		type LeagueResolution,
		listMyBlockingLeagues
	} from '$lib/services/account.services';
	import { listLeagueMembers, listMyLeagues } from '$lib/services/leagues.services';
	import { cancelLimitOrder, getUserOrders } from '$lib/services/order.services';
	import { getPositions } from '$lib/services/position.services';
	import { loadProfilesByPrincipals } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { profilesStore } from '$lib/stores/profiles.store';
	import type { ButtonStatus } from '$lib/types/components';
	import { EXIT_SIGNAL_NOTE_MAX_LENGTH, type ExitSignalReason } from '$lib/types/exit-signal';
	import type { LeagueMemberDoc } from '$lib/types/league-member';
	import { shortenPrincipal } from '$lib/utils/format.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';

	/**
	 * Six-beat account-deletion flow, docked in a {@link BottomSheet}.
	 *
	 * `reason → what-happens → leagues → confirm → gone`. The
	 * `deleting` beat is folded into `confirm`'s spinner — there is no
	 * separate sheet for the in-flight moment. Owned non-empty leagues
	 * must be resolved (transferred or disbanded) before the confirm
	 * step unlocks; open orders are cancelled FE-side first because the
	 * satellite can't reach the clearing engine.
	 */
	interface Props {
		isOpen: boolean;
		/** The user's handle — typed back on the confirm step. */
		nickname: string;
		onClose: () => void;
		/** Sign-out path reused from the host page. */
		onSignOut: () => Promise<void> | void;
	}

	const { isOpen, nickname, onClose, onSignOut }: Props = $props();

	type Step = 'reason' | 'what-happens' | 'leagues' | 'confirm' | 'gone';

	let step = $state<Step>('reason');

	// Reason ----------------------------------------------------------
	let reason = $state<ExitSignalReason | null>(null);
	let note = $state('');

	const reasonOptions: ReadonlyArray<{ id: ExitSignalReason; key: MessageKey }> = [
		{ id: 'not-for-me', key: 'settings.delete.reason.not_for_me' },
		{ id: 'too-complex', key: 'settings.delete.reason.too_complex' },
		{ id: 'bored', key: 'settings.delete.reason.bored' },
		{ id: 'no-friends', key: 'settings.delete.reason.no_friends' },
		{ id: 'too-noisy', key: 'settings.delete.reason.too_noisy' },
		{ id: 'other', key: 'settings.delete.reason.other' }
	];

	// Disclosure counts -----------------------------------------------
	let openOrders = $state<ClearingDid.LimitOrder[]>([]);
	let ownedLeagues = $state<{ id: string; name: string; memberCount: number }[]>([]);
	let activeTradeCount = $state(0);
	let activeTradeValue = $state<bigint>(ZERO);
	let hasTradeData = $state(false);
	let dataLoaded = $state(false);

	const openOrderCount = $derived(openOrders.length);
	const openOrderValue = $derived(openOrders.reduce((sum, o) => sum + o.blocked_margin_usd, ZERO));
	const ownedLeagueCount = $derived(ownedLeagues.length);

	const formatVxp = (value: bigint): string =>
		formatVxpBalance({ value, decimals: PLAYGROUND_CLEARING_MARGIN_DECIMALS });

	// Leagues resolution ----------------------------------------------
	interface LeagueResolutionDraft {
		action: 'transfer' | 'delete' | null;
		transferTo: string | null;
		/** The delete pill has been pressed (the inline confirm). */
		deleteConfirmed: boolean;
		members: LeagueMemberDoc[];
	}

	let resolutions = $state<Record<string, LeagueResolutionDraft>>({});

	const isLeagueResolved = (id: string): boolean => {
		const r = resolutions[id];

		if (!r) {
			return false;
		}

		if (r.action === 'transfer') {
			return r.transferTo !== null && r.transferTo.length > 0;
		}

		if (r.action === 'delete') {
			return r.deleteConfirmed;
		}

		return false;
	};

	const allLeaguesResolved = $derived(ownedLeagues.every((l) => isLeagueResolved(l.id)));

	const buildResolutions = (): LeagueResolution[] =>
		ownedLeagues.map((l) => {
			const r = resolutions[l.id];

			if (r?.action === 'transfer' && r.transferTo !== null) {
				return { leagueId: l.id, action: 'transfer', transferTo: r.transferTo };
			}

			return { leagueId: l.id, action: 'delete' };
		});

	// Confirm ----------------------------------------------------------
	let typedHandle = $state('');
	let deleteStatus = $state<ButtonStatus>('enabled');
	let inFlight = $state(false);
	let errorKey = $state<MessageKey | null>(null);
	let errorParams = $state<Record<string, string | number> | undefined>(undefined);
	let confirmInputEl = $state<HTMLInputElement | undefined>();

	const handleMatches = $derived(
		nickname.length > 0 && typedHandle.trim().toLowerCase() === nickname.toLowerCase()
	);

	// Gone countdown ---------------------------------------------------
	const REDIRECT_DELAY_SECONDS = 5;
	let countdown = $state(REDIRECT_DELAY_SECONDS);
	let countdownTimer: ReturnType<typeof setInterval> | undefined;

	const memberHandle = (principal: string): string => {
		const profile = $profilesStore.get(principal);

		if (profile?.nickname && profile.nickname.length > 0) {
			return `@${profile.nickname}`;
		}

		return shortenPrincipal(principal);
	};

	const transferCandidates = (id: string): LeagueMemberDoc[] => {
		const r = resolutions[id];

		if (!r) {
			return [];
		}

		return [...r.members]
			.filter((m) => m.role !== 'owner')
			.sort((a, b) => a.joinedAtMs - b.joinedAtMs);
	};

	const resetState = () => {
		step = 'reason';
		reason = null;
		note = '';
		openOrders = [];
		ownedLeagues = [];
		activeTradeCount = 0;
		activeTradeValue = ZERO;
		hasTradeData = false;
		dataLoaded = false;
		resolutions = {};
		typedHandle = '';
		deleteStatus = 'enabled';
		inFlight = false;
		errorKey = null;
		errorParams = undefined;
		countdown = REDIRECT_DELAY_SECONDS;
	};

	const handleClose = () => {
		if (inFlight) {
			return;
		}

		onClose();
	};

	/**
	 * Load the disclosure figures once the sheet opens. Each fetch
	 * degrades on its own: an orders failure leaves the open-orders row
	 * hidden, a positions failure hides the active-trades row, etc.
	 * Owned leagues are sourced from `listMyLeagues` (role === 'owner')
	 * and cross-checked against `listMyBlockingLeagues` so the leagues
	 * step only surfaces leagues that actually block deletion (own +
	 * other members present).
	 */
	const loadData = async () => {
		const domain = get(balanceDomain);

		try {
			openOrders = await getUserOrders(domain);
		} catch (_err: unknown) {
			openOrders = [];
		}

		try {
			const positions = await getPositions(domain);
			const live = positions.filter((p) => p.netQty !== ZERO);
			activeTradeCount = live.length;
			activeTradeValue = live.reduce((sum, p) => sum + p.lockedCollateral, ZERO);
			hasTradeData = true;
		} catch (_err: unknown) {
			hasTradeData = false;
		}

		try {
			const [leagues, blockingIds] = await Promise.all([listMyLeagues(), listMyBlockingLeagues()]);
			const blocking = new Set(blockingIds);
			const owned = leagues.filter((l) => l.role === 'owner' && blocking.has(l.league.id));

			const drafts: Record<string, LeagueResolutionDraft> = {};

			const hydrated = await Promise.all(
				owned.map(async ({ league }) => {
					let members: LeagueMemberDoc[] = [];

					try {
						members = await listLeagueMembers({ leagueId: league.id });
					} catch (_err: unknown) {
						members = [];
					}

					drafts[league.id] = {
						action: null,
						transferTo: null,
						deleteConfirmed: false,
						members
					};

					return {
						id: league.id,
						name: league.name,
						memberCount: members.length
					};
				})
			);

			ownedLeagues = hydrated;
			resolutions = drafts;

			const principals = Object.values(drafts).flatMap((d) => d.members.map((m) => m.member));

			if (principals.length > 0) {
				void loadProfilesByPrincipals({ principals });
			}
		} catch (_err: unknown) {
			ownedLeagues = [];
		}

		dataLoaded = true;
	};

	const goToDisclosure = async () => {
		if (reason === null) {
			return;
		}

		step = 'what-happens';

		if (!dataLoaded) {
			await loadData();
		}
	};

	const advanceFromDisclosure = () => {
		step = ownedLeagueCount > 0 ? 'leagues' : 'confirm';
	};

	const pause30Days = async () => {
		let result: Awaited<ReturnType<typeof hibernateMyAccount>>;

		try {
			result = await hibernateMyAccount();
		} catch (_err: unknown) {
			errorKey = 'settings.delete.error';
			errorParams = undefined;

			return;
		}

		// The wrapper resolves (doesn't throw) on a satellite refusal
		// (`no_profile` / already soft-deleted). Surface it instead of
		// signing the user out as if the pause succeeded.
		if (!result.ok) {
			errorKey = 'settings.delete.error';
			errorParams = undefined;

			return;
		}

		await Promise.resolve(onSignOut());
		onClose();
	};

	const enterConfirm = async () => {
		step = 'confirm';
		await tick();
		confirmInputEl?.focus();
	};

	/**
	 * The delete sequence. Cancel every open order against the clearing
	 * engine first (the satellite cannot), abort if any cancel fails,
	 * then call `deleteMyAccount`. Map the structured refusal reasons to
	 * inline copy; on `owns_non_empty_league` bounce back to the leagues
	 * step so the user can resolve them. On success advance to `gone`.
	 */
	const runDelete = async () => {
		if (!handleMatches || inFlight) {
			return;
		}

		inFlight = true;
		deleteStatus = 'pending';
		errorKey = null;
		errorParams = undefined;

		// Call `deleteMyAccount` FIRST. The satellite applies league resolution
		// + the owner-leagues guard BEFORE the soft-delete, so a refusal
		// (`owns_non_empty_league` / `league_resolution_failed`) leaves the
		// account fully intact. We must not cancel the user's open orders
		// until the delete has actually committed — otherwise a transient
		// refusal would irreversibly wipe orders without deleting anything.
		let result: Awaited<ReturnType<typeof deleteMyAccount>>;

		try {
			result = await deleteMyAccount({
				reason: reason ?? 'other',
				note: note.trim(),
				leagueResolutions: ownedLeagueCount > 0 ? buildResolutions() : undefined
			});
		} catch (_err: unknown) {
			errorKey = 'settings.delete.error';
			errorParams = undefined;
			deleteStatus = 'enabled';
			inFlight = false;

			return;
		}

		if (!result.ok) {
			if (result.reason === 'owns_non_empty_league') {
				deleteStatus = 'enabled';
				inFlight = false;
				await loadData();
				step = 'leagues';

				return;
			}

			if (result.reason === 'league_resolution_failed') {
				const failed = ownedLeagues.find((l) => l.id === result.failedLeagueId);
				errorKey = 'settings.delete.error_handoff';
				errorParams = { league: failed?.name ?? result.failedLeagueId ?? '' };
			} else {
				errorKey = 'settings.delete.error';
				errorParams = undefined;
			}

			deleteStatus = 'enabled';
			inFlight = false;

			return;
		}

		// Soft-delete committed. Now cancel open orders FE-side (the satellite
		// can't reach the clearing engine). A cancel failure here can't undo
		// the delete — the account is recoverable for 30 days and any open
		// trades settle at expiry regardless — so we still proceed to `gone`.
		try {
			for (const order of openOrders) {
				await cancelLimitOrder(order.order_id);
			}
		} catch (err: unknown) {
			console.error('DeleteAccountFlow: order cancel after delete failed', err);
		}

		step = 'gone';
		startCountdown();
	};

	const finish = async () => {
		clearCountdown();
		await Promise.resolve(onSignOut());
		onClose();
	};

	const startCountdown = () => {
		clearCountdown();
		countdown = REDIRECT_DELAY_SECONDS;
		countdownTimer = setInterval(() => {
			countdown -= 1;

			if (countdown <= 0) {
				void finish();
			}
		}, 1000);
	};

	const clearCountdown = () => {
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = undefined;
		}
	};

	// Reset to the first beat each time the sheet (re)opens so a
	// re-entry never lands mid-flow on stale state.
	$effect(() => {
		if (isOpen) {
			resetState();
		} else {
			clearCountdown();
		}
	});

	onMount(() => () => clearCountdown());
</script>

<BottomSheet {isOpen} onClose={handleClose}>
	{#if step === 'reason'}
		<div class="del">
			<h2 class="del-title">
				{t({ locale: $localeStore, key: 'settings.delete.reason_heading' })}
			</h2>
			<p class="del-body">{t({ locale: $localeStore, key: 'settings.delete.reason_body' })}</p>

			<div class="del-reasons" role="group">
				{#each reasonOptions as opt (opt.id)}
					<button
						class="del-reason"
						class:is-active={reason === opt.id}
						aria-pressed={reason === opt.id}
						onclick={() => (reason = opt.id)}
						type="button"
					>
						{t({ locale: $localeStore, key: opt.key })}
					</button>
				{/each}
			</div>

			{#if reason !== null}
				<textarea
					class="del-note"
					maxlength={EXIT_SIGNAL_NOTE_MAX_LENGTH}
					placeholder={t({ locale: $localeStore, key: 'settings.delete.note_placeholder' })}
					rows="3"
					bind:value={note}
				></textarea>
			{/if}

			<div class="del-retain">
				<p class="del-retain-head">
					{t({ locale: $localeStore, key: 'settings.delete.stay_heading' })}
				</p>
				<p class="del-retain-body">
					{t({ locale: $localeStore, key: 'settings.delete.stay_body' })}
				</p>
				<div class="del-retain-actions">
					<button class="del-retain-btn" onclick={pause30Days} type="button">
						{t({ locale: $localeStore, key: 'settings.delete.stay_pause' })}
					</button>
					<a class="del-retain-btn" href="mailto:support@vici.market">
						{t({ locale: $localeStore, key: 'settings.delete.stay_contact' })}
					</a>
				</div>
			</div>

			{#if errorKey !== null}
				<p class="del-error" role="alert">
					{t({ locale: $localeStore, key: errorKey, params: errorParams })}
				</p>
			{/if}

			<div class="del-actions">
				<Button onclick={handleClose} variant="ghost">
					{t({ locale: $localeStore, key: 'settings.delete.never_mind' })}
				</Button>
				<Button
					onclick={goToDisclosure}
					status={reason === null ? 'disabled' : 'enabled'}
					variant="danger"
				>
					{t({ locale: $localeStore, key: 'settings.delete.continue' })}
					<ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} />
				</Button>
			</div>
		</div>
	{:else if step === 'what-happens'}
		<div class="del">
			<h2 class="del-title">
				{t({ locale: $localeStore, key: 'settings.delete.happens_heading' })}
			</h2>

			<ul class="del-rows">
				<li class="del-row">
					<span class="del-row-label">
						{t({ locale: $localeStore, key: 'settings.delete.happens_profile_label' })}
					</span>
					<span class="del-row-sub">
						{t({ locale: $localeStore, key: 'settings.delete.happens_profile_sub' })}
					</span>
				</li>

				{#if openOrderCount > 0}
					<li class="del-row">
						<span class="del-row-label">
							{t({
								locale: $localeStore,
								key: 'settings.delete.happens_orders_label',
								params: { count: openOrderCount, value: formatVxp(openOrderValue) }
							})}
						</span>
						<span class="del-row-sub">
							{t({ locale: $localeStore, key: 'settings.delete.happens_orders_sub' })}
						</span>
					</li>
				{/if}

				{#if hasTradeData && activeTradeCount > 0}
					<li class="del-row is-warn">
						<span class="del-row-label">
							{t({
								locale: $localeStore,
								key: 'settings.delete.happens_trades_label',
								params: { count: activeTradeCount, value: formatVxp(activeTradeValue) }
							})}
						</span>
						<span class="del-row-sub">
							{t({ locale: $localeStore, key: 'settings.delete.happens_trades_sub' })}
						</span>
					</li>
				{/if}

				{#if ownedLeagueCount > 0}
					<li class="del-row is-warn">
						<span class="del-row-label">
							{t({
								locale: $localeStore,
								key: 'settings.delete.happens_leagues_label',
								params: { count: ownedLeagueCount }
							})}
						</span>
						<span class="del-row-sub">
							{t({ locale: $localeStore, key: 'settings.delete.happens_leagues_sub' })}
						</span>
					</li>
				{/if}
			</ul>

			<div class="del-actions">
				<Button onclick={() => (step = 'reason')} variant="ghost">
					{t({ locale: $localeStore, key: 'settings.delete.back' })}
				</Button>
				<Button onclick={advanceFromDisclosure} variant="danger">
					{t({ locale: $localeStore, key: 'settings.delete.understand' })}
				</Button>
			</div>
		</div>
	{:else if step === 'leagues'}
		<div class="del">
			<h2 class="del-title">
				{t({ locale: $localeStore, key: 'settings.delete.leagues_heading' })}
			</h2>
			<p class="del-body">{t({ locale: $localeStore, key: 'settings.delete.leagues_body' })}</p>

			<div class="del-leagues">
				{#each ownedLeagues as league (league.id)}
					{@const draft = resolutions[league.id]}
					<div class="del-league" class:is-resolved={isLeagueResolved(league.id)}>
						<div class="del-league-head">
							<span class="del-league-name">{league.name}</span>
							{#if isLeagueResolved(league.id)}
								<span class="del-league-tick" aria-hidden="true">
									<Check size={14} strokeWidth={2.2} />
								</span>
							{/if}
						</div>

						<div class="del-league-modes">
							<button
								class="del-league-mode"
								class:is-active={draft?.action === 'transfer'}
								aria-pressed={draft?.action === 'transfer'}
								disabled={transferCandidates(league.id).length === 0}
								onclick={() =>
									(resolutions = {
										...resolutions,
										[league.id]: { ...draft, action: 'transfer', deleteConfirmed: false }
									})}
								type="button"
							>
								{t({ locale: $localeStore, key: 'settings.delete.leagues_transfer' })}
							</button>
							<button
								class="del-league-mode"
								class:is-active={draft?.action === 'delete'}
								aria-pressed={draft?.action === 'delete'}
								onclick={() =>
									(resolutions = {
										...resolutions,
										[league.id]: {
											...draft,
											action: 'delete',
											transferTo: null,
											deleteConfirmed: false
										}
									})}
								type="button"
							>
								{t({ locale: $localeStore, key: 'settings.delete.leagues_delete' })}
							</button>
						</div>

						{#if draft?.action === 'transfer'}
							{#if transferCandidates(league.id).length === 0}
								<p class="del-league-empty">
									{t({ locale: $localeStore, key: 'settings.delete.leagues_no_members' })}
								</p>
							{:else}
								<label class="del-league-select-wrap">
									<span class="del-league-select-label">
										{t({ locale: $localeStore, key: 'settings.delete.leagues_transfer_to' })}
									</span>
									<select
										class="del-league-select"
										onchange={(e) =>
											(resolutions = {
												...resolutions,
												[league.id]: {
													...draft,
													transferTo: e.currentTarget.value || null
												}
											})}
										value={draft.transferTo ?? ''}
									>
										<option value="">
											{t({ locale: $localeStore, key: 'settings.delete.leagues_select_member' })}
										</option>
										{#each transferCandidates(league.id) as member (member.member)}
											<option value={member.member}>{memberHandle(member.member)}</option>
										{/each}
									</select>
								</label>
							{/if}
						{:else if draft?.action === 'delete'}
							<button
								class="del-league-delete-confirm"
								class:is-armed={draft.deleteConfirmed}
								onclick={() =>
									(resolutions = {
										...resolutions,
										[league.id]: { ...draft, deleteConfirmed: !draft.deleteConfirmed }
									})}
								type="button"
							>
								{draft.deleteConfirmed
									? t({ locale: $localeStore, key: 'settings.delete.leagues_delete_armed' })
									: t({
											locale: $localeStore,
											key: 'settings.delete.leagues_delete_confirm',
											params: { count: league.memberCount }
										})}
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<div class="del-actions">
				<Button onclick={() => (step = 'what-happens')} variant="ghost">
					{t({ locale: $localeStore, key: 'settings.delete.back' })}
				</Button>
				<Button
					onclick={enterConfirm}
					status={allLeaguesResolved ? 'enabled' : 'disabled'}
					variant="danger"
				>
					{t({ locale: $localeStore, key: 'settings.delete.continue' })}
					<ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} />
				</Button>
			</div>
		</div>
	{:else if step === 'confirm'}
		<div class="del">
			<h2 class="del-title">
				{t({ locale: $localeStore, key: 'settings.delete.confirm_heading' })}
			</h2>
			<p class="del-body">{t({ locale: $localeStore, key: 'settings.delete.confirm' })}</p>

			<label class="del-confirm-wrap">
				<span class="del-confirm-label">
					{t({
						locale: $localeStore,
						key: 'settings.delete.confirm_type',
						params: { handle: nickname }
					})}
				</span>
				<div class="del-confirm-field" class:is-matched={handleMatches}>
					<input
						bind:this={confirmInputEl}
						class="del-confirm-input num"
						autocapitalize="off"
						autocomplete="off"
						autocorrect="off"
						disabled={inFlight}
						placeholder={nickname}
						spellcheck="false"
						type="text"
						bind:value={typedHandle}
					/>
					{#if handleMatches}
						<span class="del-confirm-tick" aria-hidden="true">
							<Check size={16} strokeWidth={2.2} />
						</span>
					{/if}
				</div>
			</label>

			{#if typedHandle.trim().length > 0 && !handleMatches}
				<p class="del-error" role="alert">
					{t({ locale: $localeStore, key: 'settings.delete.confirm_mismatch' })}
				</p>
			{/if}

			{#if errorKey !== null}
				<p class="del-error" role="alert">
					{t({ locale: $localeStore, key: errorKey, params: errorParams })}
				</p>
			{/if}

			<div class="del-actions">
				<Button
					onclick={() => (step = ownedLeagueCount > 0 ? 'leagues' : 'what-happens')}
					status={inFlight ? 'disabled' : 'enabled'}
					variant="ghost"
				>
					{t({ locale: $localeStore, key: 'settings.delete.back' })}
				</Button>
				<Button
					onclick={runDelete}
					status={handleMatches ? deleteStatus : 'disabled'}
					variant="danger"
				>
					{#snippet busyLabel()}
						{t({ locale: $localeStore, key: 'settings.delete.deleting' })}
					{/snippet}
					{#if errorKey !== null}
						{t({ locale: $localeStore, key: 'settings.delete.try_again' })}
					{:else}
						{t({ locale: $localeStore, key: 'settings.delete.forever' })}
					{/if}
				</Button>
			</div>
		</div>
	{:else}
		<div class="del del-gone">
			<h2 class="del-gone-title">
				{t({ locale: $localeStore, key: 'settings.delete.gone_heading' })}
			</h2>
			<p class="del-body">{t({ locale: $localeStore, key: 'settings.delete.gone_body' })}</p>
			<p class="del-body">{t({ locale: $localeStore, key: 'settings.delete.gone_recover' })}</p>

			<div class="del-actions del-actions-single">
				<Button onclick={finish} variant="primary">
					{t({
						locale: $localeStore,
						key: 'settings.delete.gone_return',
						params: { seconds: countdown }
					})}
				</Button>
			</div>
		</div>
	{/if}
</BottomSheet>

<style lang="postcss">
	.del {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.25rem 0.1rem 0.4rem;
	}

	.del-title {
		margin: 0;
		font-size: var(--t-18);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
	}

	.del-body {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.5;
		color: var(--text-muted);
	}

	/* Reason picker — 2-col grid of soft-square chips. Active state
	   adopts the danger tone so the destructive intent reads early. */
	.del-reasons {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.del-reason {
		padding: 0.6rem 0.65rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		color: var(--text-base);
		font-size: var(--t-12);
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.del-reason.is-active {
		border-color: var(--color-destructive);
		background: color-mix(in srgb, var(--color-destructive) 10%, var(--bg-surface));
		color: var(--color-destructive);
	}

	.del-note {
		width: 100%;
		min-height: 4rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		color: var(--text-base);
		font-family: inherit;
		font-size: var(--t-12);
		resize: vertical;
	}

	/* Retention off-ramp — dashed laurel-tinted card, sits above the
	   footer so the "stay" path is offered before the user commits. */
	.del-retain {
		padding: 0.65rem 0.7rem;
		border: 1px dashed var(--border-base);
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.del-retain-head {
		margin: 0 0 0.25rem;
		font-family: var(--font-serif, serif);
		font-size: var(--t-14);
		font-style: italic;
		font-weight: 600;
		color: var(--text-base);
	}

	.del-retain-body {
		margin: 0 0 0.6rem;
		font-size: var(--t-12);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.del-retain-actions {
		display: flex;
		gap: 0.4rem;
	}

	.del-retain-btn {
		flex: 1;
		padding: 0.5rem 0.55rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: transparent;
		color: var(--text-base);
		font-size: var(--t-12);
		font-weight: 600;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici);
	}

	.del-retain-btn:hover {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	/* Disclosure rows — neutral by default, warn tone for the rows the
	   user can't make reversible (active trades, owned leagues). */
	.del-rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.del-row {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
	}

	.del-row.is-warn {
		border-color: color-mix(in srgb, var(--color-destructive) 35%, var(--border-base));
		background: color-mix(in srgb, var(--color-destructive) 6%, var(--bg-surface));
	}

	.del-row-label {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
	}

	.del-row-sub {
		font-size: var(--t-12);
		line-height: 1.45;
		color: var(--text-muted);
	}

	/* Leagues resolution ---------------------------------------------- */
	.del-leagues {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.del-league {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.7rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
	}

	.del-league.is-resolved {
		border-color: color-mix(in srgb, var(--yes) 45%, var(--border-base));
	}

	.del-league-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.del-league-name {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
	}

	.del-league-tick {
		display: inline-flex;
		color: var(--yes);
	}

	.del-league-modes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.del-league-mode {
		padding: 0.5rem 0.55rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-popover);
		color: var(--text-base);
		font-size: var(--t-12);
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici);
	}

	.del-league-mode.is-active {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-popover));
		color: var(--color-primary);
	}

	.del-league-select-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.del-league-select-label {
		font-size: var(--t-11);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.del-league-select {
		width: 100%;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-popover);
		color: var(--text-base);
		font-family: inherit;
		font-size: var(--t-12);
	}

	.del-league-empty {
		margin: 0;
		font-size: var(--t-12);
		color: var(--color-destructive);
	}

	.del-league-delete-confirm {
		padding: 0.5rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--color-destructive) 40%, var(--border-base));
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--color-destructive) 8%, transparent);
		color: var(--color-destructive);
		font-size: var(--t-12);
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici);
	}

	.del-league-delete-confirm.is-armed {
		border-color: var(--color-destructive);
		background: color-mix(in srgb, var(--color-destructive) 16%, transparent);
	}

	/* Confirm ---------------------------------------------------------- */
	.del-confirm-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.del-confirm-label {
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.del-confirm-field {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.65rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		transition: border-color var(--d-hover) var(--ease-vici);
	}

	.del-confirm-field.is-matched {
		border-color: var(--yes);
	}

	.del-confirm-input {
		flex: 1;
		min-width: 0;
		padding: 0.6rem 0;
		border: 0;
		background: transparent;
		color: var(--text-base);
		font-size: var(--t-14);
	}

	.del-confirm-input:focus {
		outline: none;
	}

	.del-confirm-tick {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--yes);
	}

	.del-error {
		margin: 0;
		font-size: var(--t-12);
		color: var(--color-destructive);
	}

	/* Footer actions --------------------------------------------------- */
	.del-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.15rem;
	}

	.del-actions :global(button) {
		flex: 1;
	}

	.del-actions-single :global(button) {
		flex: 1;
	}

	/* Gone ------------------------------------------------------------- */
	.del-gone {
		align-items: center;
		text-align: center;
		padding-top: 0.75rem;
	}

	.del-gone-title {
		margin: 0;
		font-family: var(--font-serif, serif);
		font-size: var(--t-24);
		font-style: italic;
		font-weight: 600;
		color: var(--text-base);
	}

	.del-actions-single {
		width: 100%;
	}
</style>
