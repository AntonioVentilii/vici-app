<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import { resolveBout } from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { BoutDoc } from '$lib/types/bout';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * resolve-bout modal.
	 *
	 * Both sides' scores are entered manually. Winner is derived from
	 * the arithmetic and previewed in real time so the user sees the
	 * outcome before submitting. The satellite assert (BE-6) rejects
	 * any winner that doesn't match the score math.
	 *
	 * Side A / side B labels are oriented from the caller's
	 * perspective — "us" + "them" — so the form reads naturally
	 * regardless of which side the league is.
	 */
	interface Props {
		isOpen: boolean;
		bout: BoutDoc | null;
		ourLeagueId: string;
		onClose: () => void;
		onResolved: (bout: BoutDoc) => void;
	}

	const { isOpen, bout, ourLeagueId, onClose, onResolved }: Props = $props();

	let scoreA = $state('');
	let scoreB = $state('');
	let submitting = $state(false);
	let submitError: string | null = $state(null);

	const parsedA = $derived(scoreA === '' ? Number.NaN : Number(scoreA));
	const parsedB = $derived(scoreB === '' ? Number.NaN : Number(scoreB));
	const inputsValid = $derived(
		Number.isFinite(parsedA) &&
			Number.isFinite(parsedB) &&
			Number.isInteger(parsedA) &&
			Number.isInteger(parsedB) &&
			parsedA >= 0 &&
			parsedB >= 0
	);
	const canSubmit = $derived(!submitting && bout !== null && inputsValid);

	// Winner preview. Returns one of three i18n keys for the live
	// outcome banner. `null` when inputs aren't both numbers yet.
	const winnerKey: MessageKey | null = $derived.by(() => {
		if (!bout || !inputsValid) {
			return null;
		}

		// "Us" perspective — the bout's `sideA` is "us" if our league
		// is sideA, otherwise "them".
		const usIsSideA = bout.sideA === ourLeagueId;
		const usScore = usIsSideA ? parsedA : parsedB;
		const themScore = usIsSideA ? parsedB : parsedA;

		if (usScore > themScore) {
			return 'leagues.bout.resolve.preview_us';
		}

		if (usScore < themScore) {
			return 'leagues.bout.resolve.preview_them';
		}

		return 'leagues.bout.resolve.preview_draw';
	});

	const reset = () => {
		scoreA = '';
		scoreB = '';
		submitting = false;
		submitError = null;
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	const handleSubmit = async (event: Event) => {
		event.preventDefault();

		if (!canSubmit || !bout) {
			return;
		}

		submitting = true;
		submitError = null;

		try {
			const resolved = await resolveBout({
				bout,
				scoreA: parsedA,
				scoreB: parsedB
			});
			onResolved(resolved);
			reset();
		} catch (err) {
			console.error('ResolveBoutModal: resolveBout failed', err);
			submitError = t({ locale: $localeStore, key: 'common.error.generic' });
		} finally {
			submitting = false;
		}
	};
</script>

<Modal {isOpen} onClose={handleClose}>
	<form class="resolve-form" onsubmit={handleSubmit}>
		<header class="resolve-form-head">
			<h2>{t({ locale: $localeStore, key: 'leagues.bout.resolve.title' })}</h2>
			<p>{t({ locale: $localeStore, key: 'leagues.bout.resolve.sub' })}</p>
		</header>

		{#if bout}
			<div class="resolve-scores">
				<label class="resolve-score">
					<span class="resolve-score-label allcaps">
						{#if bout.sideA === ourLeagueId}
							{t({ locale: $localeStore, key: 'leagues.bout.resolve.label_us' })}
						{:else}
							{t({ locale: $localeStore, key: 'leagues.bout.resolve.label_them' })}
						{/if}
					</span>
					<input
						class="resolve-score-input num"
						inputmode="numeric"
						min="0"
						placeholder="0"
						required
						type="number"
						bind:value={scoreA}
					/>
				</label>
				<span class="resolve-divider" aria-hidden="true">–</span>
				<label class="resolve-score">
					<span class="resolve-score-label allcaps">
						{#if bout.sideB === ourLeagueId}
							{t({ locale: $localeStore, key: 'leagues.bout.resolve.label_us' })}
						{:else}
							{t({ locale: $localeStore, key: 'leagues.bout.resolve.label_them' })}
						{/if}
					</span>
					<input
						class="resolve-score-input num"
						inputmode="numeric"
						min="0"
						placeholder="0"
						required
						type="number"
						bind:value={scoreB}
					/>
				</label>
			</div>

			{#if winnerKey}
				<p class="resolve-preview allcaps" aria-live="polite">
					{t({ locale: $localeStore, key: winnerKey })}
				</p>
			{/if}
		{/if}

		{#if submitError}
			<p class="resolve-form-error" role="alert">{submitError}</p>
		{/if}

		<div class="resolve-form-actions">
			<button class="resolve-btn is-ghost" onclick={handleClose} type="button">
				{t({ locale: $localeStore, key: 'leagues.bout.resolve.cancel' })}
			</button>
			<button class="resolve-btn is-primary" disabled={!canSubmit} type="submit">
				{t({
					locale: $localeStore,
					key: submitting ? 'leagues.bout.resolve.submitting' : 'leagues.bout.resolve.cta'
				})}
			</button>
		</div>
	</form>
</Modal>

<style lang="postcss">
	.resolve-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.resolve-form-head h2 {
		margin: 0 0 0.25rem;
		font-family: var(--font-display);
		font-size: var(--t-18, 1.1rem);
		color: var(--text-base);
	}

	.resolve-form-head p {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.resolve-scores {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: end;
		gap: 0.6rem;
	}

	.resolve-score {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	.resolve-score-label {
		font-size: var(--t-11);
		color: var(--text-muted);
	}

	.resolve-score-input {
		appearance: none;
		padding: 0.75rem 0.85rem;
		font: inherit;
		font-size: var(--t-20, 1.25rem);
		font-weight: 700;
		text-align: center;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		min-width: 0;
	}

	.resolve-divider {
		padding-bottom: 0.85rem;
		font-family: var(--font-display);
		font-size: var(--t-22, 1.4rem);
		color: var(--text-muted);
	}

	.resolve-preview {
		margin: 0;
		font-size: var(--t-12);
		letter-spacing: var(--tracking-allcaps);
		color: var(--laurel);
		text-align: center;
	}

	.resolve-form-error {
		margin: 0;
		font-size: var(--t-12);
		color: var(--no);
	}

	.resolve-form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}

	.resolve-btn {
		appearance: none;
		padding: 0.65rem 1rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		border-radius: var(--r-12);
		cursor: pointer;
	}

	.resolve-btn.is-ghost {
		color: var(--text-muted);
		background: none;
		border: 1px solid var(--border-base);
	}

	.resolve-btn.is-primary {
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
	}

	.resolve-btn.is-primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
