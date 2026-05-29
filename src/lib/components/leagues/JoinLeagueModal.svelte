<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { joinLeagueByInvite } from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { LEAGUE_INVITE_CODE_REGEX, type LeagueDoc } from '$lib/types/league';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onJoined: (league: LeagueDoc) => void;
	}

	const { isOpen, onClose, onJoined }: Props = $props();

	let code = $state('');
	let submitting = $state(false);
	let submitError: MessageKey | string | null = $state(null);

	const normalisedCode = $derived(code.trim().toUpperCase());
	const codeIsValid = $derived(LEAGUE_INVITE_CODE_REGEX.test(normalisedCode));
	const canSubmit = $derived(!submitting && codeIsValid);

	const reset = () => {
		code = '';
		submitting = false;
		submitError = null;
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	const handleSubmit = async (event: Event) => {
		event.preventDefault();

		if (!canSubmit) {
			return;
		}

		submitting = true;
		submitError = null;

		try {
			const league = await joinLeagueByInvite({ inviteCode: normalisedCode });
			onJoined(league);
			reset();
		} catch (err) {
			const message = err instanceof Error ? err.message : '';

			// Map known error strings to localised keys; fall back to the
			// generic message for anything else (raw error logged below).
			if (message === 'No league found for that invite code.') {
				submitError = 'leagues.join.error_not_found';
			} else if (message === 'Already a member of this league.') {
				submitError = 'leagues.join.error_already_member';
			} else {
				console.error('JoinLeagueModal: joinLeagueByInvite failed', err);
				submitError = 'common.error.generic';
			}
		} finally {
			submitting = false;
		}
	};
</script>

<BottomSheet {isOpen} onClose={handleClose}>
	<form class="league-form" onsubmit={handleSubmit}>
		<header class="league-form-head">
			<h2>{t({ locale: $localeStore, key: 'leagues.join.title' })}</h2>
			<p>{t({ locale: $localeStore, key: 'leagues.join.sub' })}</p>
		</header>

		<label class="league-field">
			<span class="league-field-label allcaps">
				{t({ locale: $localeStore, key: 'leagues.join.label_code' })}
			</span>
			<input
				class="league-field-input is-code num"
				autocapitalize="characters"
				autocomplete="off"
				maxlength="6"
				minlength="6"
				placeholder="ABC123"
				required
				spellcheck="false"
				type="text"
				bind:value={code}
			/>
		</label>

		{#if submitError !== null}
			<p class="league-form-error" role="alert">
				{typeof submitError === 'string' && !submitError.includes('.')
					? submitError
					: t({ locale: $localeStore, key: submitError as MessageKey })}
			</p>
		{/if}

		<div class="league-form-actions">
			<button class="league-btn is-ghost" onclick={handleClose} type="button">
				{t({ locale: $localeStore, key: 'leagues.join.cancel' })}
			</button>
			<button class="league-btn is-primary" disabled={!canSubmit} type="submit">
				{t({
					locale: $localeStore,
					key: submitting ? 'leagues.join.submitting' : 'leagues.join.cta'
				})}
			</button>
		</div>
	</form>
</BottomSheet>

<style lang="postcss">
	.league-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.league-form-head h2 {
		margin: 0 0 0.25rem;
		font-family: var(--font-display);
		font-size: var(--t-18, 1.1rem);
		color: var(--text-base);
	}

	.league-form-head p {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.league-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.league-field-label {
		font-size: var(--t-11);
		color: var(--text-muted);
	}

	.league-field-input {
		appearance: none;
		padding: 0.7rem 0.85rem;
		font: inherit;
		font-size: var(--t-14);
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.league-field-input:focus {
		outline: 2px solid color-mix(in srgb, var(--laurel) 55%, transparent);
		outline-offset: 0;
	}

	.league-field-input.is-code {
		font-size: var(--t-20, 1.25rem);
		font-weight: 700;
		letter-spacing: 0.18em;
		text-align: center;
		text-transform: uppercase;
	}

	.league-form-error {
		margin: 0;
		font-size: var(--t-12);
		color: var(--no);
	}

	/* Two-column grid so the buttons split the sheet width evenly and
	   never crowd the right edge on narrow viewports. */
	.league-form-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}

	.league-btn {
		appearance: none;
		padding: 0.75rem 1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		border-radius: var(--r-12);
		cursor: pointer;
		text-align: center;
		transition:
			background 140ms ease,
			color 140ms ease,
			border-color 140ms ease;
	}

	.league-btn.is-ghost {
		color: var(--text-muted);
		background: none;
		border: 1px solid var(--border-base);
	}

	.league-btn.is-ghost:hover {
		color: var(--text-base);
		border-color: var(--border-strong);
	}

	.league-btn.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.league-btn.is-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.league-btn.is-primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
