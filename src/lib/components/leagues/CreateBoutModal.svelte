<script lang="ts">
	import { X } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import {
		listMyLeagues,
		lookupLeagueByInvite,
		proposeBattle,
		type LeagueWithRole
	} from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { BattleDoc } from '$lib/types/battle';
	import { LEAGUE_INVITE_CODE_REGEX, type LeagueDoc } from '$lib/types/league';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Create-a-battle wizard — the multi-step "start a battle" sheet
	 * reachable from the Battles surface.
	 *
	 * Steps (steps the caller sees collapse when the data is
	 * unambiguous):
	 *
	 *  1. Pick your league — only the leagues the caller owns can send a
	 *     challenge (the satellite assert hard-rejects non-owners). Auto-
	 *     skipped when the caller owns exactly one league; the empty
	 *     state routes to Leagues when they own none.
	 *  2. Opponent — resolved from the opponent league's 6-char invite
	 *     code. A public league directory (recommended + search) is a
	 *     known backend follow-up (B.5); until that endpoint exists the
	 *     code path is the only faithful, non-fabricated discovery route.
	 *  3. Duration — 7 / 14 / 30 days, mapped to the kickoff → settle
	 *     window the satellite stores.
	 *
	 * Scope (all / WC / macro), an optional VXP wager, and a trash-talk
	 * message are part of the locked design but have no home on the
	 * `BattleDoc` schema or the `proposeBattle` contract yet — those
	 * fields are a backend follow-up (B-track) and are intentionally
	 * omitted here rather than fabricated against local-only storage.
	 *
	 * Wraps the same `proposeBattle` service the league-detail Challenge
	 * action uses, so the satellite contract is identical regardless of
	 * entry point.
	 */
	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onProposed?: (battle: BattleDoc) => void;
	}

	const { isOpen, onClose, onProposed }: Props = $props();

	const DURATIONS = [7, 14, 30] as const;
	type Duration = (typeof DURATIONS)[number];

	// Start as 'loading' so the first open shows the spinner immediately
	// rather than briefly flashing the form before data arrives.
	let loadState: 'loading' | 'ready' | 'error' = $state('loading');
	let hasLoaded = $state(false);
	let ownedLeagues: LeagueWithRole[] = $state([]);

	let fromLeague: LeagueDoc | undefined = $state();
	let opponent: LeagueDoc | undefined = $state();
	let code = $state('');
	let duration = $state<Duration>(7);

	let resolving = $state(false);
	let submitting = $state(false);
	let lookupError: MessageKey | null = $state(null);
	let submitError: MessageKey | null = $state(null);

	const normalisedCode = $derived(code.trim().toUpperCase());
	const codeIsValid = $derived(LEAGUE_INVITE_CODE_REGEX.test(normalisedCode));

	const canSend = $derived(
		!submitting &&
			!resolving &&
			fromLeague !== undefined &&
			opponent !== undefined &&
			opponent.id !== fromLeague.id
	);

	const load = async () => {
		loadState = 'loading';

		try {
			const mine = await listMyLeagues();
			ownedLeagues = mine.filter((m) => m.role === 'owner');

			// Auto-select when the caller owns exactly one league — the
			// pick-your-league step collapses.
			fromLeague = ownedLeagues.length === 1 ? ownedLeagues[0].league : undefined;
			loadState = 'ready';
		} catch (err) {
			console.error('CreateBoutModal: listMyLeagues failed', err);
			loadState = 'error';
		}
	};

	// Defer the league fetch until the sheet actually opens; guard with
	// `hasLoaded` so reopening the sheet does not re-fire the request.
	$effect(() => {
		if (isOpen && !hasLoaded) {
			hasLoaded = true;
			void load();
		}
	});

	const reset = () => {
		fromLeague = ownedLeagues.length === 1 ? ownedLeagues[0].league : undefined;
		opponent = undefined;
		code = '';
		duration = 7;
		resolving = false;
		submitting = false;
		lookupError = null;
		submitError = null;
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	const goToLeagues = () => {
		handleClose();
		void goto(`${resolve(AppPath.Arena)}/leagues`);
	};

	const selectLeague = (league: LeagueDoc) => {
		fromLeague = league;
		// Clear any opponent picked under a previous "from" league so the
		// same-league guard can't be stale.
		opponent = undefined;
		code = '';
		lookupError = null;
	};

	const handleLookup = async () => {
		if (!codeIsValid || resolving || fromLeague === undefined) {
			return;
		}

		resolving = true;
		lookupError = null;
		opponent = undefined;

		try {
			const found = await lookupLeagueByInvite({ inviteCode: normalisedCode });

			if (!found) {
				lookupError = 'leagues.battle.propose.error_not_found';

				return;
			}

			if (found.id === fromLeague.id) {
				lookupError = 'leagues.battle.propose.error_same_league';

				return;
			}

			opponent = found;
		} catch {
			lookupError = 'leagues.battle.propose.error_lookup';
		} finally {
			resolving = false;
		}
	};

	const clearOpponent = () => {
		opponent = undefined;
		code = '';
		lookupError = null;
	};

	const handleSubmit = async (event: Event) => {
		event.preventDefault();

		if (!canSend || fromLeague === undefined || opponent === undefined) {
			return;
		}

		submitting = true;
		submitError = null;

		try {
			const kickoffMs = Date.now() + DAY_IN_MS;
			const settleMs = kickoffMs + duration * DAY_IN_MS;

			const battle = await proposeBattle({
				sideA: fromLeague.id,
				sideB: opponent.id,
				kickoffMs,
				settleMs
			});

			onProposed?.(battle);
			handleClose();
		} catch (err) {
			console.error('CreateBoutModal: proposeBattle failed', err);
			submitError = 'common.error.generic';
		} finally {
			submitting = false;
		}
	};
</script>

<BottomSheet {isOpen} onClose={handleClose}>
	<div class="create-bout">
		<header class="create-bout-head">
			<h2>{t({ locale: $localeStore, key: 'battles.create.title' })}</h2>
			<button
				class="create-bout-close"
				aria-label={t({ locale: $localeStore, key: 'a11y.close' })}
				onclick={handleClose}
				type="button"
			>
				<X aria-hidden="true" size={16} strokeWidth={1.8} />
			</button>
		</header>

		{#if loadState === 'loading'}
			<p class="create-bout-status" aria-busy="true">
				{t({ locale: $localeStore, key: 'battles.create.loading' })}
			</p>
		{:else if loadState === 'error'}
			<p class="create-bout-error" role="alert">
				{t({ locale: $localeStore, key: 'common.error.generic' })}
			</p>
		{:else if ownedLeagues.length === 0}
			<!-- No owned leagues — you must admin a league to challenge. -->
			<p class="serif-italic create-bout-lede">
				{t({ locale: $localeStore, key: 'battles.create.empty_lede' })}
			</p>
			<p class="create-bout-body">
				{t({ locale: $localeStore, key: 'battles.create.empty_body' })}
			</p>
			<button class="create-bout-btn is-primary" onclick={goToLeagues} type="button">
				{t({ locale: $localeStore, key: 'battles.create.empty_cta' })} →
			</button>
			<button class="create-bout-btn is-ghost" onclick={handleClose} type="button">
				{t({ locale: $localeStore, key: 'battles.create.cancel' })}
			</button>
		{:else}
			<form class="create-bout-form" onsubmit={handleSubmit}>
				<!-- Step 1 · Pick your league (only when owning more than one) -->
				{#if ownedLeagues.length > 1}
					<fieldset class="create-bout-field">
						<legend class="allcaps create-bout-label">
							{t({ locale: $localeStore, key: 'battles.create.label_your_league' })}
						</legend>
						<div class="create-bout-league-row">
							{#each ownedLeagues as owned (owned.league.id)}
								<button
									class="create-bout-pill"
									class:is-active={fromLeague?.id === owned.league.id}
									onclick={() => selectLeague(owned.league)}
									type="button"
								>
									{owned.league.name}
								</button>
							{/each}
						</div>
					</fieldset>
				{/if}

				{#if fromLeague}
					<!-- Step 2 · Opponent -->
					<div class="create-bout-field">
						<span class="allcaps create-bout-label">
							{t({ locale: $localeStore, key: 'battles.create.label_opponent' })}
						</span>

						{#if !opponent}
							<div class="create-bout-code-row">
								<input
									class="create-bout-input is-code num"
									autocapitalize="characters"
									autocomplete="off"
									maxlength="6"
									minlength="6"
									placeholder="ABC123"
									spellcheck="false"
									type="text"
									bind:value={code}
								/>
								<button
									class="create-bout-resolve"
									disabled={!codeIsValid || resolving}
									onclick={handleLookup}
									type="button"
								>
									{resolving
										? t({ locale: $localeStore, key: 'leagues.battle.propose.resolving' })
										: t({ locale: $localeStore, key: 'leagues.battle.propose.resolve' })}
								</button>
							</div>
							<p class="create-bout-hint">
								{t({ locale: $localeStore, key: 'battles.create.opponent_hint' })}
							</p>
						{:else}
							<div class="create-bout-resolved">
								<div class="create-bout-resolved-text">
									<span class="allcaps create-bout-resolved-eyebrow">
										{t({ locale: $localeStore, key: 'leagues.battle.propose.opponent_resolved' })}
									</span>
									<span class="create-bout-resolved-name">{opponent.name}</span>
								</div>
								<button class="create-bout-change" onclick={clearOpponent} type="button">
									{t({ locale: $localeStore, key: 'battles.create.change' })}
								</button>
							</div>
						{/if}

						{#if lookupError}
							<p class="create-bout-error" role="alert">
								{t({ locale: $localeStore, key: lookupError })}
							</p>
						{/if}
					</div>

					{#if opponent}
						<!-- Step 3 · Duration -->
						<fieldset class="create-bout-field">
							<legend class="allcaps create-bout-label">
								{t({ locale: $localeStore, key: 'battles.create.label_duration' })}
							</legend>
							<div class="create-bout-duration-row">
								{#each DURATIONS as days (days)}
									<button
										class="create-bout-pill"
										class:is-active={duration === days}
										onclick={() => (duration = days)}
										type="button"
									>
										{t({
											locale: $localeStore,
											key: 'leagues.challenge.duration_days',
											params: { count: days }
										})}
									</button>
								{/each}
							</div>
						</fieldset>

						{#if submitError !== null}
							<p class="create-bout-error" role="alert">
								{t({ locale: $localeStore, key: submitError })}
							</p>
						{/if}

						<button class="create-bout-btn is-primary" disabled={!canSend} type="submit">
							{submitting
								? t({ locale: $localeStore, key: 'leagues.battle.propose.submitting' })
								: `${t({
										locale: $localeStore,
										key: 'battles.create.send_to',
										params: { name: opponent.name }
									})} →`}
						</button>
					{/if}
				{/if}

				<button class="create-bout-btn is-ghost" onclick={handleClose} type="button">
					{t({ locale: $localeStore, key: 'battles.create.cancel' })}
				</button>
			</form>
		{/if}
	</div>
</BottomSheet>

<style lang="postcss">
	.create-bout {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.create-bout-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.create-bout-head h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-18, 1.1rem);
		color: var(--text-base);
	}

	.create-bout-close {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem;
		color: var(--text-muted);
		background: transparent;
		border: 0;
		cursor: pointer;
	}

	.create-bout-status,
	.create-bout-error {
		margin: 0;
		font-size: var(--t-13);
	}

	.create-bout-status {
		color: var(--text-muted);
	}

	.create-bout-error {
		color: var(--no);
	}

	.create-bout-lede {
		margin: 0;
		font-size: var(--t-15, 0.95rem);
		color: var(--laurel);
	}

	.create-bout-body {
		margin: 0;
		font-size: var(--t-13);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.create-bout-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.create-bout-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}

	.create-bout-label {
		font-size: var(--t-11);
		color: var(--text-muted);
	}

	.create-bout-league-row,
	.create-bout-duration-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.create-bout-duration-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
	}

	.create-bout-pill {
		appearance: none;
		flex: 1 1 auto;
		padding: 0.55rem 0.7rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 600;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease,
			color 140ms ease;
	}

	.create-bout-pill.is-active {
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		border-color: color-mix(in srgb, var(--laurel) 45%, var(--border-base));
	}

	.create-bout-code-row {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}

	.create-bout-input {
		appearance: none;
		padding: 0.7rem 0.85rem;
		font: inherit;
		font-size: var(--t-14);
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		min-width: 0;
	}

	.create-bout-input.is-code {
		flex: 1 1 auto;
		font-size: var(--t-18, 1.1rem);
		font-weight: 700;
		letter-spacing: 0.16em;
		text-align: center;
		text-transform: uppercase;
	}

	.create-bout-resolve {
		appearance: none;
		flex: 0 0 auto;
		padding: 0 0.85rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 35%, var(--border-base));
		border-radius: var(--r-12);
		cursor: pointer;
	}

	.create-bout-resolve:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.create-bout-hint {
		margin: 0.1rem 0 0;
		font-size: var(--t-11);
		line-height: 1.4;
		color: var(--text-muted);
	}

	.create-bout-resolved {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.55rem 0.75rem;
		background: color-mix(in srgb, var(--laurel) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 25%, var(--border-base));
		border-radius: var(--r-12);
	}

	.create-bout-resolved-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.create-bout-resolved-eyebrow {
		font-size: var(--t-10);
		color: var(--text-muted);
		letter-spacing: var(--tracking-allcaps);
	}

	.create-bout-resolved-name {
		font-family: var(--font-display);
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--text-base);
	}

	.create-bout-change {
		appearance: none;
		flex-shrink: 0;
		padding: 0;
		font: inherit;
		font-size: var(--t-12);
		color: var(--text-muted);
		background: none;
		border: 0;
		cursor: pointer;
		text-decoration: underline;
	}

	.create-bout-btn {
		appearance: none;
		padding: 0.8rem 1.1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		border-radius: var(--r-pill);
		cursor: pointer;
		text-align: center;
	}

	.create-bout-btn.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.create-bout-btn.is-primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.create-bout-btn.is-ghost {
		color: var(--text-muted);
		background: none;
		border: 1px solid var(--border-base);
	}
</style>
