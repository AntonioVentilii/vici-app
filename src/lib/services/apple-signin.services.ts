import { II_MAX_TIME_TO_LIVE_NS } from '$lib/constants/app.constants';
import { isNullish, nonNullish } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';
import { getDoc, setDoc, type UserData } from '@junobuild/core';
import { AuthClient, IdbStorage } from 'icp-auth-openid/client';

// Juno's system collection holding one doc per authenticated principal.
const JUNO_USER_COLLECTION = '#user';

// Internet Identity 2.0 (`id.ai`) is the only II surface that runs the
// OpenID one-click flow: it performs the OIDC handshake with the chosen
// provider and returns a delegation indistinguishable from a passkey-based
// II sign-in. The local replica does not handle the `?openid=…` param, so
// this flow always targets the hosted endpoint — which also means it works
// from any origin, including local dev.
const INTERNET_IDENTITY_OPENID_URL = 'https://id.ai/authorize';

// `@icp-sdk/auth`'s ICRC-29 PostMessageTransport opens its signer popup
// under a fixed window name derived from the identity-provider origin
// (`<identityProvider-origin>-signer-window`). Pre-opening a window with
// the same name lets the SDK reuse it, giving us a handle to poll for a
// user-initiated close.
const buildSignerWindowName = (identityProvider: string): string =>
	`${new URL(identityProvider).origin}-signer-window`;

const SIGNER_WINDOW_CLOSED_POLL_MS = 500;

/**
 * Raised when the user dismisses the sign-in popup. The SDK only reports a
 * closed popup via a multi-second heartbeat timeout, so we surface this
 * synthetic signal and let callers treat it as a benign cancel (no error).
 */
export class AppleSignInCancelledError extends Error {}

/**
 * Mirror Juno's `initUser`: load-or-create the `#user` doc for the given
 * identity.
 *
 * This is the piece that makes Apple work end-to-end. Juno's boot-time
 * `loadAuth()` only *loads* an existing `#user` doc — it never creates one
 * (that happens inside Juno's interactive `signIn()`, which we bypass). So
 * without this, the next document load finds a valid delegation but no
 * user, and `loadAuth()` sets the auth store to `null` — the app reloads
 * straight back to the signed-out sign-in screen. Creating the doc here
 * (with the freshly acquired Apple delegation, since Juno's ambient
 * identity hasn't adopted it yet) lets `loadAuth()` resolve a user on the
 * next load. It's the same owner-scoped `#user` write Juno itself performs
 * for every other provider.
 */
const ensureJunoUserDoc = async (identity: Identity): Promise<void> => {
	const key = identity.getPrincipal().toText();
	const satellite = { identity };

	const existing = await getDoc({ collection: JUNO_USER_COLLECTION, key, satellite });

	if (nonNullish(existing)) {
		return;
	}

	await setDoc<UserData>({
		collection: JUNO_USER_COLLECTION,
		// `internet_identity`: the delegation is issued by Internet Identity
		// 2.0 (`id.ai`), Apple is just the OpenID method behind it.
		doc: { key, data: { provider: 'internet_identity' } },
		satellite
	});
};

/**
 * One-click "Continue with Apple" through Internet Identity 2.0's OpenID
 * flow.
 *
 * Juno's `signIn()` exposes no Apple provider (and no OpenID deep-link for
 * its Internet Identity provider), so this drives `@icp-sdk/auth` v6
 * directly — installed under the `icp-auth-openid` alias so Juno keeps its
 * own peer `@icp-sdk/auth` v5 untouched. On success the delegation is
 * persisted to the same IndexedDB store Juno reads (`auth-client-db`), and
 * the `#user` doc is created (see {@link ensureJunoUserDoc}), so a
 * subsequent full document load lets Juno's `initSatellite()` /
 * `loadAuth()` resolve the user and fire `onAuthStateChange`. See the
 * caller in {@link ../components/authn/SignInProviderStack.svelte}.
 *
 * Construction and the popup pre-open stay inside the user-gesture call
 * stack so Safari does not block the popup.
 */
export const signInWithApple = async (): Promise<void> => {
	const client = new AuthClient({
		// Default IdbStorage — the very `auth-client-db` store Juno's own
		// AuthClient reads on boot, so the delegation persisted here is
		// adopted on the next document load. v5 (Juno) and v6 (here) share
		// an identical storage contract: db `auth-client-db`, store
		// `ic-keyval`, ECDSA key under `identity`, delegation JSON under
		// `delegation`.
		storage: new IdbStorage(),
		// Match Juno's client: no idle timer (Juno disables idle on its own
		// client, and this short-lived instance is discarded on reload).
		idleOptions: { disableIdle: true, disableDefaultIdleCallback: true },
		identityProvider: INTERNET_IDENTITY_OPENID_URL,
		openIdProvider: 'apple'
	});

	// Pre-open the popup synchronously so the SDK reuses it (matching window
	// name) and we can detect a user-initiated close. A blocked/null window
	// just opts out of the poll — we fall back to the SDK's heartbeat.
	const signerWindow = window.open('', buildSignerWindowName(INTERNET_IDENTITY_OPENID_URL));

	let pollHandle: ReturnType<typeof setInterval> | undefined;

	const userInterrupt = new Promise<never>((_, reject) => {
		if (isNullish(signerWindow)) {
			return;
		}

		pollHandle = setInterval(() => {
			if (signerWindow.closed) {
				reject(new AppleSignInCancelledError('Sign-in popup closed'));
			}
		}, SIGNER_WINDOW_CLOSED_POLL_MS);
	});

	const signIn = client.signIn({ maxTimeToLive: II_MAX_TIME_TO_LIVE_NS });

	// When the interrupt wins the race the SDK promise only settles much
	// later via its heartbeat disconnect; swallow it so the runtime doesn't
	// flag an unhandled rejection.
	signIn.catch(() => undefined);

	try {
		const identity = await Promise.race([signIn, userInterrupt]);

		// Sign-in resolved: the popup has closed on its own, so stop polling
		// before the (now meaningless) close is observed, then make Juno able
		// to resolve this session on the next load.
		if (nonNullish(pollHandle)) {
			clearInterval(pollHandle);
			pollHandle = undefined;
		}

		await ensureJunoUserDoc(identity);
	} finally {
		if (nonNullish(pollHandle)) {
			clearInterval(pollHandle);
		}
	}
};
