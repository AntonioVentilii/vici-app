<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { lookupLeagueByInvite, proposeBout } from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { BoutDoc } from '$lib/types/bout';
	import { LEAGUE_INVITE_CODE_REGEX, type LeagueDoc } from '$lib/types/league';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Challenge another league to a bout — opener for owners.
	 *
	 * We don't expose a public league directory yet, so the picker
	 * is invite-code driven: the caller pastes the opponent's 6-char
	 * code, we resolve it, then pick a duration (7 / 14 / 30 days)
	 * and propose the bout.
	 *
	 * Wraps `lookupLeagueByInvite` + `proposeBout` — the same
	 * services `ProposeBoutModal` uses — so the satellite contract
	 * is identical.
	 */
	interface Props {
		isOpen: boolean;
		/** Our league (the one we're challenging from). */
		fromLeague: LeagueDoc;
		onClose: () => void;
		onProposed: (bout: BoutDoc) => void;
	}

	const { isOpen, fromLeague, onClose, onProposed }: Props = $props();

	const DURATIONS = [7, 14, 30] as const;
	type Duration = (typeof DURATIONS)[number];

	let code = $state('');
	let duration = $state<Duration>(7);
	let resolved: LeagueDoc | undefined = $state();
	let resolving = $state(false);
	let submitting = $state(false);
	let lookupError: MessageKey | null = $state(null);
	let submitError: MessageKey | null = $state(null);

	const normalisedCode = $derived(code.trim().toUpperCase());
	const codeIsValid = $derived(LEAGUE_INVITE_CODE_REGEX.test(normalisedCode));

	const canSubmit = $derived(
		!submitting && !resolving && resolved !== undefined && resolved.id !== fromLeague.id
	);

	const reset = () => {
		code = '';
		duration = 7;
		resolved = undefined;
		resolving = false;
		submitting = false;
		lookupError = null;
		submitError = null;
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	const handleLookup = async () => {
		if (!codeIsValid || resolving) {
			return;
		}

		resolving = true;
		lookupError = null;
		resolved = undefined;

		try {
			const found = await lookupLeagueByInvite({ inviteCode: normalisedCode });

			if (!found) {
				lookupError = 'leagues.bout.propose.error_not_found';

				return;
			}

			if (found.id === fromLeague.id) {
				lookupError = 'leagues.bout.propose.error_same_league';

				return;
			}

			resolved = found;
		} catch {
			lookupError = 'leagues.bout.propose.error_lookup';
		} finally {
			resolving = false;
		}
	};

	const handleSubmit = async (event: Event) => {
		event.preventDefault();

		if (!canSubmit || !resolved) {
			return;
		}

		submitting = true;
		submitError = null;

		try {
			const kickoffMs = Date.now() + DAY_IN_MS;
			const settleMs = kickoffMs + duration * DAY_IN_MS;

			const bout = await proposeBout({
				sideA: fromLeague.id,
				sideB: resolved.id,
				kickoffMs,
				settleMs
			});

			onProposed(bout);
			reset();
		} catch (err) {
			console.error('ChallengeLeagueModal: proposeBout failed', err);
			submitError = 'common.error.generic';
		} finally {
			submitting = false;
		}
	};
</script>

<BottomSheet {isOpen} onClose={handleClose}>
	<form class="challenge-form" onsubmit={handleSubmit}>
		<header class="challenge-form-head">
			<h2>{t({ locale: $localeStore, key: 'leagues.challenge.title' })}</h2>
			<p class="serif-italic">
				{t({
					locale: $localeStore,
					key: 'leagues.challenge.sub',
					params: { name: fromLeague.name }
				})}
			</p>
		</header>

		<label class="challenge-field">
			<span class="challenge-field-label allcaps">
				{t({ locale: $localeStore, key: 'leagues.challenge.label_opponent' })}
			</span>
			<div class="challenge-code-row">
				<input
					class="challenge-field-input is-code num"
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
					class="challenge-resolve-btn"
					disabled={!codeIsValid || resolving}
					onclick={handleLookup}
					type="button"
				>
					{resolving
						? t({ locale: $localeStore, key: 'leagues.bout.propose.resolving' })
						: t({ locale: $localeStore, key: 'leagues.bout.propose.resolve' })}
				</button>
			</div>
		</label>

		{#if lookupError}
			<p class="challenge-form-error" role="alert">
				{t({ locale: $localeStore, key: lookupError })}
			</p>
		{:else if resolved}
			<div class="challenge-resolved" aria-live="polite">
				<span class="allcaps challenge-resolved-eyebrow">
					{t({ locale: $localeStore, key: 'leagues.bout.propose.opponent_resolved' })}
				</span>
				<span class="challenge-resolved-name">{resolved.name}</span>
			</div>
		{/if}

		<fieldset class="challenge-duration">
			<legend class="allcaps challenge-field-label">
				{t({ locale: $localeStore, key: 'leagues.challenge.label_duration' })}
			</legend>
			<div class="challenge-duration-row">
				{#each DURATIONS as days (days)}
					<button
						class="challenge-duration-btn"
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
			<p class="challenge-form-error" role="alert">
				{t({ locale: $localeStore, key: submitError })}
			</p>
		{/if}

		<div class="challenge-form-actions">
			<button class="challenge-btn is-ghost" onclick={handleClose} type="button">
				{t({ locale: $localeStore, key: 'leagues.bout.propose.cancel' })}
			</button>
			<button class="challenge-btn is-primary" disabled={!canSubmit} type="submit">
				{t({
					locale: $localeStore,
					key: submitting ? 'leagues.bout.propose.submitting' : 'leagues.challenge.cta_send'
				})}
			</button>
		</div>
	</form>
</BottomSheet>

<style lang="postcss">
	.challenge-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.challenge-form-head h2 {
		margin: 0 0 0.25rem;
		font-family: var(--font-display);
		font-size: var(--t-18, 1.1rem);
		color: var(--text-base);
	}

	.challenge-form-head p {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
		line-height: 1.45;
	}

	.challenge-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	.challenge-field-label {
		font-size: var(--t-11);
		color: var(--text-muted);
	}

	.challenge-field-input {
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

	.challenge-field-input.is-code {
		font-size: var(--t-18, 1.1rem);
		font-weight: 700;
		letter-spacing: 0.16em;
		text-align: center;
		text-transform: uppercase;
	}

	.challenge-code-row {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}

	.challenge-code-row .challenge-field-input {
		flex: 1 1 auto;
	}

	.challenge-resolve-btn {
		appearance: none;
		padding: 0 0.85rem;
		font: inherit;
		font-size: var(--t-12);
		font-weight: 700;
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 35%, var(--border-base));
		border-radius: var(--r-12);
		cursor: pointer;
		flex: 0 0 auto;
	}

	.challenge-resolve-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.challenge-resolved {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.55rem 0.75rem;
		background: color-mix(in srgb, var(--laurel) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 25%, var(--border-base));
		border-radius: var(--r-12);
	}

	.challenge-resolved-eyebrow {
		font-size: var(--t-10);
		color: var(--text-muted);
		letter-spacing: var(--tracking-allcaps);
	}

	.challenge-resolved-name {
		font-family: var(--font-display);
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--text-base);
	}

	.challenge-duration {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}

	.challenge-duration-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.4rem;
	}

	.challenge-duration-btn {
		appearance: none;
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

	.challenge-duration-btn.is-active {
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		border-color: color-mix(in srgb, var(--laurel) 45%, var(--border-base));
	}

	.challenge-form-error {
		margin: 0;
		font-size: var(--t-12);
		color: var(--no);
	}

	.challenge-form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}

	.challenge-btn {
		appearance: none;
		padding: 0.65rem 1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		border-radius: var(--r-12);
		cursor: pointer;
	}

	.challenge-btn.is-ghost {
		color: var(--text-muted);
		background: none;
		border: 1px solid var(--border-base);
	}

	.challenge-btn.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.challenge-btn.is-primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
