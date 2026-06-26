<script lang="ts">
	import { Gift } from '@lucide/svelte/icons';
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import SignInProviderStack from '$lib/components/authn/SignInProviderStack.svelte';
	import { HANDLE_POOL } from '$lib/constants/handle-pool.constants';
	import {
		MAX_NICKNAME_LENGTH,
		MIN_NICKNAME_LENGTH,
		NICKNAME_PATTERN,
		RESERVED_HANDLES,
		sanitizeNickname
	} from '$lib/constants/profile.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { newUserVxpAmountMilestone1BaseUnits } from '$lib/constants/vxp-onboarding.constants';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { track } from '$lib/services/analytics.services';
	import { checkNicknameAvailability } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';

	/**
	 * One-screen onboarding — claim a handle and sign up on a single
	 * surface. Replaces the multi-beat flow: brand wordmark → hero →
	 * handle field (live availability + pool-suggested placeholder) →
	 * reward chip → auth provider stack → escapes → legal fine print.
	 *
	 * Handle behaviour (live probe, monotonic cancel token, session-taken
	 * cache, offline-tolerant `failed`, claim-time TOCTOU re-check) is the
	 * same machinery the multi-beat handle picker uses, recomposed here.
	 * Team selection is dropped — it moves to the post-signup Profile — so
	 * `participantId` / `side` are always `null` in the emitted handoff and
	 * the persist-across-providers stash/drain is reused unchanged.
	 *
	 * Emits the same handoff shape the signup page already consumes, so its
	 * pre-auth stash and authenticated direct-write need no signature change.
	 */
	interface Props {
		// Fires after the provider stack resolves in-page (non-redirect).
		onComplete: (result: {
			participantId: string | null;
			side: 'YES' | 'NO' | null;
			handle: string | null;
		}) => void;
		// Fires once an available handle is claimed, BEFORE any provider runs
		// — so a full-page redirect provider (Google) carries the handle
		// through. Mirrors the multi-beat flow's auth-gate stash.
		onPicksReady?: (result: {
			participantId: string | null;
			side: 'YES' | 'NO' | null;
			handle: string | null;
		}) => void;
		// "Already a member? Sign in".
		onSignIn: () => void;
		// "Skip — preview first, sign up later". Carries the selected handle so
		// the guest session (and the later conversion) keeps the chosen name.
		onSkip: (handle: string | null) => void;
		// True when the user is already signed in (post-signin onboarding path).
		authenticated?: boolean;
	}

	const { onComplete, onPicksReady, onSignIn, onSkip, authenticated = false }: Props = $props();

	const event = $derived($featuredEvent);

	// Starter-pack VXP — sourced from the real registration milestone grant
	// rather than a hardcoded literal, so the chip stays in lock-step with
	// the economy config.
	const starterVxp = $derived(formatVxpBalance({ value: newUserVxpAmountMilestone1BaseUnits() }));
	const eventTitle = $derived(event.brandedTitle ?? event.shortTitle ?? event.title);

	// A pool-derived suggestion shown as the empty-field placeholder. Picked
	// once at init; selecting it (tabbing away / submitting an empty field)
	// claims it. Pool entries already satisfy the handle validator.
	const suggestion = HANDLE_POOL[Math.floor(Math.random() * HANDLE_POOL.length)];

	let custom = $state('');

	// Sanitised view of the input — lowercased, out-of-charset characters
	// stripped. The input renders this cleaned value, and it is what gets
	// probed and claimed. An empty field falls back to the pool suggestion.
	const cleaned = $derived(sanitizeNickname(custom));
	const selectedName = $derived(cleaned.length > 0 ? cleaned : suggestion);
	// Whether the active selection is the pool placeholder (empty input). The
	// suggestion is pre-validated and not user-typed, so it never fires a
	// `handle_checked` event.
	const usingSuggestion = $derived(cleaned.length === 0);

	type LiveAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'failed';
	let liveAvailability = $state<LiveAvailability>('idle');
	let checkToken = 0;
	let checkTimer: ReturnType<typeof setTimeout> | undefined;
	const CHECK_DEBOUNCE_MS = 350;

	// Handles the satellite confirmed taken this session — sourced from the
	// live probe and the claim-time re-check, so a retry doesn't re-query.
	const sessionTaken = new SvelteSet<string>();
	let isClaiming = $state(false);
	// Set when the claim-time re-check finds the handle was taken between
	// display and submit. Cleared on the next input change.
	let claimError = $state<'taken' | null>(null);

	const onInput = (e: Event) => {
		if (e.currentTarget instanceof HTMLInputElement) {
			custom = e.currentTarget.value;
		}
	};

	// Clear the claim-time error whenever the typed handle changes.
	$effect(() => {
		void cleaned;
		untrack(() => {
			claimError = null;
		});
	});

	// Local format checks the live probe must clear before hitting the
	// satellite. Only the typed handle is probed — the placeholder is
	// pre-validated.
	const formatValid = $derived(
		!usingSuggestion &&
			selectedName.length >= MIN_NICKNAME_LENGTH &&
			selectedName.length <= MAX_NICKNAME_LENGTH &&
			NICKNAME_PATTERN.test(selectedName) &&
			!RESERVED_HANDLES.has(selectedName.toLowerCase())
	);

	// Debounced live probe. A monotonic token cancels the in-flight check on
	// each keystroke so stale results drop. Offline-tolerant: a failure
	// surfaces as `failed` but never blocks the claim — the claim-time
	// re-check and the satellite assertion are the authority. Fires
	// `handle_checked` once a typed-handle probe completes.
	$effect(() => {
		const candidate = selectedName;
		const probe = formatValid;

		if (checkTimer) {
			clearTimeout(checkTimer);
		}

		checkToken += 1;
		const token = checkToken;

		if (!probe) {
			liveAvailability = 'idle';

			return;
		}

		if (sessionTaken.has(candidate)) {
			liveAvailability = 'taken';
			track({ name: 'handle_checked', source: 'onboarding', label: 'v3', ok: false });

			return;
		}

		liveAvailability = 'checking';

		checkTimer = setTimeout(() => {
			void (async () => {
				try {
					const res = await checkNicknameAvailability({ nickname: candidate });

					if (token !== checkToken) {
						return;
					}

					if (res.available) {
						liveAvailability = 'available';
					} else {
						sessionTaken.add(candidate);
						liveAvailability = 'taken';
					}

					track({
						name: 'handle_checked',
						source: 'onboarding',
						label: 'v3',
						ok: res.available
					});
				} catch (err) {
					if (token !== checkToken) {
						return;
					}

					console.warn(`Live availability check failed for "${candidate}":`, err);
					liveAvailability = 'failed';
				}
			})();
		}, CHECK_DEBOUNCE_MS);

		return () => {
			if (checkTimer) {
				clearTimeout(checkTimer);
			}
		};
	});

	interface Availability {
		// Whether the handle can be claimed.
		ok: boolean;
		// How to render the hint: confirmed-available (green), a hard error
		// (red), or a neutral in-between (probing / couldn't verify / the
		// pre-validated placeholder).
		tone: 'ok' | 'neutral' | 'error';
		reasonKey?: MessageKey;
	}

	const availability: Availability = $derived.by(() => {
		const name = selectedName;

		// The empty-field placeholder is a pre-validated pool pick — claimable,
		// shown neutral (it isn't a confirmed-available probe result).
		if (usingSuggestion) {
			return { ok: true, tone: 'neutral' };
		}

		if (name.length < MIN_NICKNAME_LENGTH) {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.v3.avail.too_short' };
		}

		if (name.length > MAX_NICKNAME_LENGTH) {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.v3.avail.too_long' };
		}

		if (!NICKNAME_PATTERN.test(name)) {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.v3.avail.invalid' };
		}

		if (RESERVED_HANDLES.has(name.toLowerCase())) {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.v3.avail.reserved' };
		}

		if (claimError === 'taken' || sessionTaken.has(name)) {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.v3.avail.taken' };
		}

		if (liveAvailability === 'idle' || liveAvailability === 'checking') {
			return { ok: false, tone: 'neutral', reasonKey: 'onboarding.v3.avail.checking' };
		}

		if (liveAvailability === 'taken') {
			return { ok: false, tone: 'error', reasonKey: 'onboarding.v3.avail.taken' };
		}

		// Probe failed — claimable but neutral; never the green "Available",
		// since it wasn't confirmed. The claim-time re-check is the gate.
		if (liveAvailability === 'failed') {
			return { ok: true, tone: 'neutral', reasonKey: 'onboarding.v3.avail.check_failed' };
		}

		return { ok: true, tone: 'ok' };
	});

	const canClaim = $derived(availability.ok && !isClaiming);

	// Hand the claimed handle to the pre-auth stash before the provider
	// stack runs. Runs the claim-time TOCTOU re-check first so a handle
	// taken between display and submit surfaces inline rather than failing
	// at the satellite assertion. Team/side are always null for this flow.
	const stashHandle = async (): Promise<boolean> => {
		if (!availability.ok || !selectedName || isClaiming) {
			return false;
		}

		isClaiming = true;

		try {
			const res = await checkNicknameAvailability({ nickname: selectedName });

			if (!res.available) {
				sessionTaken.add(selectedName);
				claimError = 'taken';

				return false;
			}
		} catch (err) {
			// Fall through to stash — the satellite-side assertion is the
			// ultimate authority, and blocking on a transient probe failure
			// would strand the user.
			console.warn('Claim-time availability re-check failed:', err);
		} finally {
			isClaiming = false;
		}

		onPicksReady?.({ participantId: null, side: null, handle: selectedName });

		return true;
	};

	// Wrap the provider stack's success so the picks are stashed before
	// `onComplete` lands. For redirect providers the stash already happened
	// on focus-out / interaction below; this covers in-page providers.
	const onAuthSuccess = () => {
		onComplete({ participantId: null, side: null, handle: selectedName });
	};

	// Stash the handle as soon as the user commits an available one (blur or
	// the auth surface gaining interaction), so a Google redirect carries it
	// through even though `onComplete` never fires for that provider.
	const onCommitHandle = () => {
		void stashHandle();
	};

	const lockKey = $derived<MessageKey>(
		canClaim ? 'onboarding.v3.lock_ready' : 'onboarding.v3.lock_blocked'
	);

	// Skip into guest preview. Stash the claimed handle through the same
	// pre-auth pipeline a real sign-up uses, so a later conversion keeps the
	// chosen name, then hand the handle to the host to open the guest session.
	const onSkipPreview = () => {
		const handle = availability.ok ? selectedName : null;
		onCommitHandle();
		onSkip(handle);
	};

	onMount(() => {
		track({ name: 'onboarding_started', source: 'onboarding', label: 'v3' });
	});
</script>

<div class="ob ob-v3" data-tid={TestId.OnboardingFlow}>
	<div class="ob-wrap">
		<div class="ob-body-wrap">
			<div class="ob2-beat ob-v3-beat">
				<span class="ob-v3-brand">{t({ locale: $localeStore, key: 'onboarding.v3.brand' })}</span>

				<h1 class="ob2-h1">
					{t({ locale: $localeStore, key: 'onboarding.v3.h1_pre' })}
					<span class="serif-italic acc">
						{t({ locale: $localeStore, key: 'onboarding.v3.h1_accent' })}
					</span>
				</h1>
				<p class="ob2-sub">{t({ locale: $localeStore, key: 'onboarding.v3.sub' })}</p>

				<div class="ob2-custom-input-wrap">
					<span class="ob2-at-large">@</span>
					<input
						class="ob2-custom-input"
						autocapitalize="off"
						autocomplete="off"
						maxlength={MAX_NICKNAME_LENGTH}
						onblur={onCommitHandle}
						oninput={onInput}
						placeholder={t({
							locale: $localeStore,
							key: 'onboarding.v3.handle_placeholder',
							params: { handle: suggestion }
						})}
						spellcheck="false"
						type="text"
						value={cleaned}
					/>
				</div>

				<div
					class="ob2-avail"
					class:checking={availability.tone === 'neutral'}
					class:no={availability.tone === 'error'}
					class:ok={availability.tone === 'ok'}
					aria-live="polite"
				>
					{#if availability.tone === 'ok'}
						{t({ locale: $localeStore, key: 'onboarding.v3.avail.available' })}
						<span class="serif-italic">@{selectedName}</span>
					{:else if availability.reasonKey}
						{t({ locale: $localeStore, key: availability.reasonKey })}
					{:else}
						{t({
							locale: $localeStore,
							key: 'onboarding.v3.handle_placeholder',
							params: { handle: selectedName }
						})}
					{/if}
				</div>

				<div class="ob2-summary ob2-summary-starter">
					<div class="ob2-summary-row">
						<span class="ob2-summary-flag ob2-summary-flag-starter">
							<Gift size={16} strokeWidth={1.7} />
						</span>
						<div>
							<div class="ob2-summary-q">
								{t({ locale: $localeStore, key: 'onboarding.v3.reward_title' })}
							</div>
							<div class="ob2-summary-meta">
								{t({
									locale: $localeStore,
									key: 'onboarding.v3.reward_sub',
									params: { event: eventTitle }
								})}
								· {starterVxp} VXP
							</div>
						</div>
					</div>
				</div>

				<div class="ob-v3-lock" class:ready={canClaim}>
					{t({
						locale: $localeStore,
						key: lockKey,
						params: { handle: selectedName }
					})}
				</div>

				<div class="ob2-auth-buttons">
					{#if authenticated}
						<button
							class="ob2-btn-primary"
							data-tid={TestId.OnboardingPrimary}
							disabled={!canClaim}
							onclick={() => {
								void stashHandle().then((ok) => {
									if (ok) {
										onComplete({ participantId: null, side: null, handle: selectedName });
									}
								});
							}}
							type="button"
						>
							{t({ locale: $localeStore, key: 'onboarding.beat3.finish_cta' })}
						</button>
					{:else}
						<div onpointerdowncapture={onCommitHandle}>
							<SignInProviderStack handle={selectedName} mode="signup" onSuccess={onAuthSuccess} />
						</div>
					{/if}
				</div>

				{#if !authenticated}
					<div class="ob2-tos">
						<div class="ob2-tos-play">
							{t({ locale: $localeStore, key: 'onboarding.beat3.tos.play_currency' })}
						</div>
						{t({ locale: $localeStore, key: 'onboarding.beat3.tos.prefix' })}
						<a href="/info/terms" rel="noopener" target="_blank">
							{t({ locale: $localeStore, key: 'onboarding.beat3.tos.terms' })}
						</a>
						{t({ locale: $localeStore, key: 'onboarding.beat3.tos.and' })}
						<a href="/info/privacy" rel="noopener" target="_blank">
							{t({ locale: $localeStore, key: 'onboarding.beat3.tos.privacy' })}
						</a>{t({ locale: $localeStore, key: 'onboarding.beat3.tos.suffix' })}
					</div>
				{/if}

				<button
					class="ob2-skip-link"
					data-tid={TestId.OnboardingHandleSkip}
					onclick={onSkipPreview}
					type="button"
				>
					{t({ locale: $localeStore, key: 'onboarding.v3.skip' })}
				</button>

				<div class="ob-v3-signin">
					{t({ locale: $localeStore, key: 'onboarding.v3.signin_prompt' })}
					<button class="ob-v3-signin-link" onclick={onSignIn} type="button">
						{t({ locale: $localeStore, key: 'onboarding.v3.signin_link' })}
					</button>
				</div>

				<div class="ob-v3-legal">
					<span>{t({ locale: $localeStore, key: 'onboarding.v3.legal_currency' })}</span>
					<span>{t({ locale: $localeStore, key: 'onboarding.v3.legal_resolution' })}</span>
				</div>
			</div>
		</div>
	</div>
</div>
