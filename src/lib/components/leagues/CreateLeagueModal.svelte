<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { createLeague, validateLeagueDraft } from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import {
		LEAGUE_DESCRIPTION_MAX_LENGTH,
		LEAGUE_NAME_MAX_LENGTH,
		LEAGUE_NAME_MIN_LENGTH,
		type LeagueDoc
	} from '$lib/types/league';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		// Fires after a successful create — parent re-fetches the list and
		// can navigate the user into the new league's detail page once it
		// lands.
		onCreated: (league: LeagueDoc) => void;
	}

	const { isOpen, onClose, onCreated }: Props = $props();

	let name = $state('');
	let description = $state('');
	let submitting = $state(false);
	let submitError: string | null = $state(null);

	const draftError: MessageKey | null = $derived.by(() => {
		// Don't show errors until the user has typed something, so the
		// empty initial state doesn't read as "field is invalid".
		if (name.length === 0 && description.length === 0) {
			return null;
		}

		const result = validateLeagueDraft({
			name: name.trim(),
			description: description.trim() || undefined
		});

		if (result.ok) {
			return null;
		}

		if (result.reason === 'name_too_short') {
			return 'leagues.create.invalid_name_too_short';
		}

		if (result.reason === 'name_too_long') {
			return 'leagues.create.invalid_name_too_long';
		}

		return 'leagues.create.invalid_description';
	});

	const canSubmit = $derived(
		!submitting &&
			validateLeagueDraft({
				name: name.trim(),
				description: description.trim() || undefined
			}).ok
	);

	const reset = () => {
		name = '';
		description = '';
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
			const league = await createLeague({
				name: name.trim(),
				description: description.trim() || undefined
			});
			onCreated(league);
			reset();
		} catch (err) {
			console.error('CreateLeagueModal: createLeague failed', err);
			submitError = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			submitting = false;
		}
	};
</script>

<BottomSheet {isOpen} onClose={handleClose}>
	<form class="league-form" onsubmit={handleSubmit}>
		<header class="league-form-head">
			<h2>{t({ locale: $localeStore, key: 'leagues.create.title' })}</h2>
			<p>{t({ locale: $localeStore, key: 'leagues.create.sub' })}</p>
		</header>

		<label class="league-field">
			<span class="league-field-label allcaps">
				{t({ locale: $localeStore, key: 'leagues.create.label_name' })}
			</span>
			<input
				class="league-field-input"
				autocomplete="off"
				maxlength={LEAGUE_NAME_MAX_LENGTH}
				minlength={LEAGUE_NAME_MIN_LENGTH}
				placeholder={t({ locale: $localeStore, key: 'leagues.create.placeholder_name' })}
				required
				type="text"
				bind:value={name}
			/>
		</label>

		<label class="league-field">
			<span class="league-field-label allcaps">
				{t({ locale: $localeStore, key: 'leagues.create.label_description' })}
			</span>
			<textarea
				class="league-field-input is-textarea"
				maxlength={LEAGUE_DESCRIPTION_MAX_LENGTH}
				placeholder={t({
					locale: $localeStore,
					key: 'leagues.create.placeholder_description'
				})}
				rows="3"
				bind:value={description}
			></textarea>
		</label>

		{#if draftError}
			<p class="league-form-error" role="alert">
				{t({ locale: $localeStore, key: draftError })}
			</p>
		{:else if submitError}
			<p class="league-form-error" role="alert">{submitError}</p>
		{/if}

		<div class="league-form-actions">
			<button class="league-btn is-ghost" onclick={handleClose} type="button">
				{t({ locale: $localeStore, key: 'leagues.create.cancel' })}
			</button>
			<button class="league-btn is-primary" disabled={!canSubmit} type="submit">
				{t({
					locale: $localeStore,
					key: submitting ? 'leagues.create.submitting' : 'leagues.create.cta'
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
		font-size: var(--t-11, 0.7rem);
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

	.league-field-input.is-textarea {
		resize: vertical;
		min-height: 4.5rem;
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
