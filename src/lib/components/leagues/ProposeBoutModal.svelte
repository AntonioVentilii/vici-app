<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import { lookupLeagueByInvite, proposeBout } from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { BoutDoc } from '$lib/types/bout';
	import { LEAGUE_INVITE_CODE_REGEX, type LeagueDoc } from '$lib/types/league';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Phase 10 FE-3b — propose-bout modal.
	 *
	 * The user (league owner) types the opponent league's 6-char
	 * invite code, picks a kickoff + settle date, and submits. The
	 * satellite assert binds the proposer to the caller and to
	 * sideA's league owner — so only owners can propose.
	 */
	interface Props {
		isOpen: boolean;
		// Our league (the league this modal was opened from).
		ourLeagueId: string;
		onClose: () => void;
		onProposed: (bout: BoutDoc) => void;
	}

	const { isOpen, ourLeagueId, onClose, onProposed }: Props = $props();

	let code = $state('');
	let kickoffDate = $state(''); // ISO yyyy-mm-dd
	let settleDate = $state('');
	let resolved: LeagueDoc | undefined = $state();
	let resolving = $state(false);
	let submitting = $state(false);
	let lookupError: MessageKey | null = $state(null);
	let submitError: MessageKey | string | null = $state(null);

	const normalisedCode = $derived(code.trim().toUpperCase());
	const codeIsValid = $derived(LEAGUE_INVITE_CODE_REGEX.test(normalisedCode));

	const canSubmit = $derived(
		!submitting &&
			!resolving &&
			resolved !== undefined &&
			resolved.id !== ourLeagueId &&
			kickoffDate.length > 0 &&
			settleDate.length > 0 &&
			Date.parse(kickoffDate) < Date.parse(settleDate)
	);

	// Default kickoff/settle to "tomorrow → next week" so the form
	// isn't empty on first open. Uses local YYYY-MM-DD format so the
	// `<input type="date">` accepts it.
	$effect(() => {
		if (isOpen && kickoffDate === '' && settleDate === '') {
			const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
			const nextWeek = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
			kickoffDate = tomorrow.toISOString().slice(0, 10);
			settleDate = nextWeek.toISOString().slice(0, 10);
		}
	});

	const reset = () => {
		code = '';
		kickoffDate = '';
		settleDate = '';
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

			if (found.id === ourLeagueId) {
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
			const bout = await proposeBout({
				sideA: ourLeagueId,
				sideB: resolved.id,
				kickoffMs: Date.parse(kickoffDate),
				settleMs: Date.parse(settleDate)
			});
			onProposed(bout);
			reset();
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			submitting = false;
		}
	};
</script>

<Modal {isOpen} onClose={handleClose}>
	<form class="bout-form" onsubmit={handleSubmit}>
		<header class="bout-form-head">
			<h2>{t({ locale: $localeStore, key: 'leagues.bout.propose.title' })}</h2>
			<p>{t({ locale: $localeStore, key: 'leagues.bout.propose.sub' })}</p>
		</header>

		<label class="bout-field">
			<span class="bout-field-label allcaps">
				{t({ locale: $localeStore, key: 'leagues.bout.propose.label_opponent' })}
			</span>
			<div class="bout-code-row">
				<input
					class="bout-field-input is-code num"
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
					class="bout-resolve-btn"
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
			<p class="bout-form-error" role="alert">
				{t({ locale: $localeStore, key: lookupError })}
			</p>
		{:else if resolved}
			<div class="bout-resolved" aria-live="polite">
				<span class="allcaps bout-resolved-eyebrow">
					{t({ locale: $localeStore, key: 'leagues.bout.propose.opponent_resolved' })}
				</span>
				<span class="bout-resolved-name">{resolved.name}</span>
			</div>
		{/if}

		<div class="bout-date-row">
			<label class="bout-field">
				<span class="bout-field-label allcaps">
					{t({ locale: $localeStore, key: 'leagues.bout.propose.label_kickoff' })}
				</span>
				<input class="bout-field-input num" required type="date" bind:value={kickoffDate} />
			</label>
			<label class="bout-field">
				<span class="bout-field-label allcaps">
					{t({ locale: $localeStore, key: 'leagues.bout.propose.label_settle' })}
				</span>
				<input class="bout-field-input num" required type="date" bind:value={settleDate} />
			</label>
		</div>

		{#if submitError !== null}
			<p class="bout-form-error" role="alert">
				{typeof submitError === 'string' && !submitError.includes('.')
					? submitError
					: t({ locale: $localeStore, key: submitError as MessageKey })}
			</p>
		{/if}

		<div class="bout-form-actions">
			<button class="bout-btn is-ghost" onclick={handleClose} type="button">
				{t({ locale: $localeStore, key: 'leagues.bout.propose.cancel' })}
			</button>
			<button class="bout-btn is-primary" disabled={!canSubmit} type="submit">
				{t({
					locale: $localeStore,
					key: submitting ? 'leagues.bout.propose.submitting' : 'leagues.bout.propose.cta'
				})}
			</button>
		</div>
	</form>
</Modal>

<style lang="postcss">
	.bout-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.bout-form-head h2 {
		margin: 0 0 0.25rem;
		font-family: var(--font-display);
		font-size: var(--t-18, 1.1rem);
		color: var(--text-base);
	}

	.bout-form-head p {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.bout-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	.bout-field-label {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.bout-field-input {
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

	.bout-field-input.is-code {
		font-size: var(--t-18, 1.1rem);
		font-weight: 700;
		letter-spacing: 0.16em;
		text-align: center;
		text-transform: uppercase;
	}

	.bout-code-row {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}

	.bout-code-row .bout-field-input {
		flex: 1 1 auto;
	}

	.bout-resolve-btn {
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

	.bout-resolve-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.bout-resolved {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.55rem 0.75rem;
		background: color-mix(in srgb, var(--laurel) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--laurel) 25%, var(--border-base));
		border-radius: var(--r-12);
	}

	.bout-resolved-eyebrow {
		font-size: var(--t-10, 0.65rem);
		color: var(--text-muted);
		letter-spacing: var(--tracking-allcaps);
	}

	.bout-resolved-name {
		font-family: var(--font-display);
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--text-base);
	}

	.bout-date-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}

	.bout-form-error {
		margin: 0;
		font-size: var(--t-12);
		color: var(--no);
	}

	.bout-form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}

	.bout-btn {
		appearance: none;
		padding: 0.65rem 1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		border-radius: var(--r-12);
		cursor: pointer;
	}

	.bout-btn.is-ghost {
		color: var(--text-muted);
		background: none;
		border: 1px solid var(--border-base);
	}

	.bout-btn.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.bout-btn.is-primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
