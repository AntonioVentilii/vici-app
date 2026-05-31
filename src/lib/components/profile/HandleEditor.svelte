<script lang="ts">
	import { X } from 'lucide-svelte/icons';
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import {
		cleanHandle,
		HANDLE_COOLDOWN_DAYS,
		HANDLE_LAST_CHANGE_STORAGE_KEY,
		MAX_HANDLE_LENGTH,
		MIN_HANDLE_LENGTH,
		RESERVED_HANDLES
	} from '$lib/constants/profile.constants';
	import { checkNicknameAvailability } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { haptic } from '$lib/utils/haptics.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * Editable-handle sheet. The handle is the public `@`-name (the same
	 * field as the profile nickname). Mirrors the identity-edit affordance:
	 * a single text input with an inline availability indicator, lowercase /
	 * `[a-z0-9_]` / 3–15-char client-side normalisation, a backend
	 * availability probe, and a once-every-{@link HANDLE_COOLDOWN_DAYS}-days
	 * change limit.
	 *
	 * The cooldown is enforced client-side via `localStorage` — the profile
	 * schema carries no "last handle change" timestamp, so a hard
	 * (server-side) limit would need a backend change. See
	 * {@link HANDLE_LAST_CHANGE_STORAGE_KEY}.
	 */
	interface Props {
		/** Current handle (without the leading `@`). */
		current: string;
		/** Owner principal — passed to the availability probe so the user is
		 *  never told their own current handle is taken. */
		owner: string;
		onClose: () => void;
		/** Called with the new (cleaned) handle once the save succeeds. */
		onSaved: (handle: string) => void;
	}

	const { current, owner, onClose, onSaved }: Props = $props();

	const readLastChange = (): number => {
		if (!browser) {
			return 0;
		}

		try {
			return Number.parseInt(localStorage.getItem(HANDLE_LAST_CHANGE_STORAGE_KEY) ?? '0', 10) || 0;
		} catch {
			return 0;
		}
	};

	const lastChange = readLastChange();
	const daysSince = lastChange ? Math.floor((Date.now() - lastChange) / DAY_IN_MS) : Infinity;
	const locked = daysSince < HANDLE_COOLDOWN_DAYS;
	const daysLeft = locked ? HANDLE_COOLDOWN_DAYS - daysSince : 0;

	// One-time seed from the current handle. The sheet is remounted on
	// every open (it's gated behind `{#if handleEditOpen}` in the parent),
	// so capturing the prop's initial value here is intentional — there's
	// no later `current` change to track within a single open.
	const initialHandle = untrack(() => current ?? '');
	let value = $state(initialHandle);
	const clean = $derived(cleanHandle(value));

	const currentLower = $derived(initialHandle.toLowerCase());
	const tooShort = $derived(clean.length < MIN_HANDLE_LENGTH);
	const unchanged = $derived(clean === currentLower);
	const reserved = $derived(RESERVED_HANDLES.has(clean));

	type ErrorKey = MessageKey | null;

	const errorKey = $derived.by<ErrorKey>(() => {
		if (tooShort) {
			// Empty input shows the neutral hint, not an error.
			return clean.length === 0 ? null : 'profile.handle.error_short';
		}

		if (reserved) {
			return 'profile.handle.error_reserved';
		}

		if (unchanged) {
			return 'profile.handle.error_unchanged';
		}

		return null;
	});

	const localValid = $derived(!tooShort && !unchanged && !reserved);

	// Backend availability probe — debounced; only runs once the candidate
	// clears the local checks.
	type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'failed';
	let availability = $state<Availability>('idle');
	let checkToken = 0;
	let checkTimer: ReturnType<typeof setTimeout> | undefined;
	const checkDebounce_ms = 350;

	let pending = $state(false);

	$effect(() => {
		// Re-run whenever the cleaned candidate changes.
		const candidate = clean;

		if (checkTimer) {
			clearTimeout(checkTimer);
		}

		checkToken += 1;
		const token = checkToken;

		if (!localValid) {
			availability = 'idle';

			return;
		}

		availability = 'checking';

		checkTimer = setTimeout(() => {
			void (async () => {
				try {
					const result = await checkNicknameAvailability({
						nickname: candidate,
						principal: owner
					});

					if (token !== checkToken) {
						return;
					}

					availability = result.available ? 'available' : 'taken';
				} catch {
					if (token !== checkToken) {
						return;
					}

					availability = 'failed';
				}
			})();
		}, checkDebounce_ms);

		return () => {
			if (checkTimer) {
				clearTimeout(checkTimer);
			}
		};
	});

	const showAvailable = $derived(localValid && availability === 'available');

	const hintKey = $derived.by<MessageKey>(() => {
		if (errorKey !== null) {
			return errorKey;
		}

		if (localValid && availability === 'taken') {
			return 'profile.handle.error_taken';
		}

		if (localValid && availability === 'failed') {
			return 'profile.handle.error_check_failed';
		}

		return 'profile.handle.hint';
	});

	const hintIsError = $derived(
		errorKey !== null || availability === 'taken' || availability === 'failed'
	);

	const canSave = $derived(!locked && localValid && availability === 'available' && !pending);

	const save = async () => {
		if (!canSave) {
			return;
		}

		pending = true;

		try {
			// Final guard against a race between the debounced probe and the
			// tap: re-check synchronously before committing.
			const result = await checkNicknameAvailability({ nickname: clean, principal: owner });

			if (!result.available) {
				availability = result.reason === 'taken' ? 'taken' : 'failed';

				return;
			}

			haptic('firm-tap');
			onSaved(clean);
		} catch {
			availability = 'failed';
		} finally {
			pending = false;
		}
	};

	const onInput = (event: Event) => {
		if (event.currentTarget instanceof HTMLInputElement) {
			const { value: next } = event.currentTarget;
			value = next;
		}
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			void save();
		}
	};
</script>

<BottomSheet isOpen={true} {onClose}>
	<div class="handle-editor">
		<div class="handle-editor-head">
			<h3 class="handle-editor-title">
				{t({ locale: $localeStore, key: 'profile.handle.title' })}
			</h3>
			<button
				class="handle-editor-close"
				aria-label={t({ locale: $localeStore, key: 'profile.dashboard.close' })}
				onclick={onClose}
				type="button"
			>
				<X aria-hidden="true" size={18} strokeWidth={2} />
			</button>
		</div>

		<p class="handle-editor-blurb">
			{t({
				locale: $localeStore,
				key: 'profile.handle.blurb',
				params: { days: HANDLE_COOLDOWN_DAYS }
			})}
		</p>

		{#if locked}
			<div class="handle-editor-locked">
				<p>
					{t({
						locale: $localeStore,
						key: daysLeft === 1 ? 'profile.handle.locked_one' : 'profile.handle.locked',
						params: { days: daysLeft }
					})}
				</p>
			</div>
		{:else}
			<div class="handle-editor-field">
				<span class="num handle-editor-at" aria-hidden="true">@</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="handle-editor-input"
					aria-describedby="handle-editor-hint"
					aria-invalid={hintIsError}
					aria-label={t({ locale: $localeStore, key: 'profile.handle.title' })}
					autocapitalize="none"
					autocomplete="off"
					autocorrect="off"
					autofocus
					inputmode="text"
					oninput={onInput}
					onkeydown={onKeyDown}
					placeholder={t({ locale: $localeStore, key: 'profile.handle.placeholder' })}
					spellcheck="false"
					type="text"
					value={clean}
				/>
				<span class="num handle-editor-indicator" class:is-available={showAvailable}>
					{#if showAvailable}
						{t({ locale: $localeStore, key: 'profile.handle.available' })}
					{:else}
						{clean.length}/{MAX_HANDLE_LENGTH}
					{/if}
				</span>
			</div>

			<p
				id="handle-editor-hint"
				class="num handle-editor-hint"
				class:is-error={hintIsError}
				aria-live="polite"
			>
				{t({ locale: $localeStore, key: hintKey })}
			</p>

			<div class="handle-editor-actions">
				<button class="handle-editor-cancel" onclick={onClose} type="button">
					{t({ locale: $localeStore, key: 'profile.dashboard.cancel' })}
				</button>
				<button class="handle-editor-save" disabled={!canSave} onclick={save} type="button">
					{t({ locale: $localeStore, key: 'profile.handle.save' })}
				</button>
			</div>
		{/if}
	</div>
</BottomSheet>

<style lang="postcss">
	.handle-editor {
		display: flex;
		flex-direction: column;
	}

	.handle-editor-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.handle-editor-title {
		margin: 0;
		color: var(--text-base);
		font-family: var(--font-display);
		font-size: var(--t-18);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
	}

	.handle-editor-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem 0.5rem;
		border: 0;
		border-radius: var(--r-8);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.handle-editor-close:hover {
		color: var(--text-base);
	}

	.handle-editor-blurb {
		margin: 0 0 0.875rem;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-relaxed, 1.5);
	}

	.handle-editor-locked {
		margin-bottom: 0.25rem;
		padding: 0.85rem 0.95rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12, 0.75rem);
		background: var(--bg-surface);
	}

	.handle-editor-locked p {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: var(--leading-snug);
	}

	.handle-editor-locked :global(b) {
		color: var(--text-base);
	}

	.handle-editor-field {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 0 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-10, 0.625rem);
		background: var(--bg-surface);
	}

	.handle-editor-at {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 1rem;
	}

	.handle-editor-field input {
		min-width: 0;
		flex: 1;
		padding: 0.75rem 0.375rem;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--text-base);
		font-family: var(--font-mono);
		font-size: 1rem;
	}

	.handle-editor-indicator {
		color: var(--text-faint, var(--text-muted));
		font-family: var(--font-mono);
		font-size: 0.6875rem;
	}

	.handle-editor-indicator.is-available {
		color: var(--yes);
	}

	.handle-editor-hint {
		min-height: 1rem;
		margin: 0.5rem 0 0;
		color: var(--text-faint, var(--text-muted));
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		letter-spacing: 0.02em;
	}

	.handle-editor-hint.is-error {
		color: var(--no);
	}

	.handle-editor-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.handle-editor-cancel,
	.handle-editor-save {
		flex: 1;
		padding: 0.75rem;
		border-radius: var(--r-pill);
		font: inherit;
		font-weight: 700;
		font-size: var(--t-13);
		cursor: pointer;
	}

	.handle-editor-cancel {
		border: 1px solid var(--border-base);
		background: transparent;
		color: var(--text-base);
	}

	.handle-editor-save {
		border: 0;
		background: var(--color-primary);
		color: var(--bg-canvas, #0e0d0b);
	}

	.handle-editor-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
