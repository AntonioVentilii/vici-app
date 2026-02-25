import { writable, derived } from 'svelte/store';
import {
	AuthClient,
	type AuthClientCreateOptions,
	type AuthClientLoginOptions
} from '@dfinity/auth-client';
import type { Identity } from '@icp-sdk/core/agent';
import { DelegationIdentity, isDelegationValid } from '@icp-sdk/core/identity';
import { loadConfig } from '../config';

export type Status = 'initializing' | 'idle' | 'logging-in' | 'success' | 'loginError';

const ONE_HOUR_IN_NANOSECONDS = BigInt(3_600_000_000_000);
const DEFAULT_IDENTITY_PROVIDER = process.env.II_URL;

function createAuthStore() {
	const { subscribe, set, update } = writable<{
		authClient?: AuthClient;
		identity?: Identity;
		loginStatus: Status;
		loginError?: Error;
	}>({
		loginStatus: 'initializing'
	});

	async function init(createOptions?: AuthClientCreateOptions) {
		try {
			update((s) => ({ ...s, loginStatus: 'initializing' }));
			const config = await loadConfig();
			const options: AuthClientCreateOptions = {
				idleOptions: {
					disableDefaultIdleCallback: true,
					disableIdle: true,
					...createOptions?.idleOptions
				},
				loginOptions: {
					derivationOrigin: config.ii_derivation_origin
				},
				...createOptions
			};
			const authClient = await AuthClient.create(options);
			const isAuthenticated = await authClient.isAuthenticated();
			let identity: Identity | undefined;
			if (isAuthenticated) {
				identity = authClient.getIdentity();
			}
			set({
				authClient,
				identity,
				loginStatus: 'idle'
			});
		} catch (error) {
			set({
				loginStatus: 'loginError',
				loginError: error instanceof Error ? error : new Error('Initialization failed')
			});
		}
	}

	async function login() {
		update((s) => {
			if (!s.authClient) {
				return {
					...s,
					loginStatus: 'loginError',
					loginError: new Error('AuthClient not initialized')
				};
			}

			const currentIdentity = s.authClient.getIdentity();
			if (
				!currentIdentity.getPrincipal().isAnonymous() &&
				currentIdentity instanceof DelegationIdentity &&
				isDelegationValid(currentIdentity.getDelegation())
			) {
				return {
					...s,
					loginStatus: 'loginError',
					loginError: new Error('User is already authenticated')
				};
			}

			const options: AuthClientLoginOptions = {
				identityProvider: DEFAULT_IDENTITY_PROVIDER,
				onSuccess: () => {
					const latestIdentity = s.authClient?.getIdentity();
					update((state) => ({
						...state,
						identity: latestIdentity,
						loginStatus: 'success'
					}));
				},
				onError: (err) => {
					update((state) => ({
						...state,
						loginStatus: 'loginError',
						loginError: new Error(err ?? 'Login failed')
					}));
				},
				maxTimeToLive: ONE_HOUR_IN_NANOSECONDS * BigInt(24 * 30) // 30 days
			};

			s.authClient.login(options);
			return { ...s, loginStatus: 'logging-in' };
		});
	}

	async function clear() {
		update((s) => {
			if (s.authClient) {
				s.authClient.logout().then(() => {
					set({
						authClient: s.authClient,
						identity: undefined,
						loginStatus: 'idle'
					});
				});
			}
			return s;
		});
	}

	return {
		subscribe,
		init,
		login,
		clear
	};
}

export const auth = createAuthStore();

export const identity = derived(auth, ($auth) => $auth.identity);
export const loginStatus = derived(auth, ($auth) => $auth.loginStatus);
export const isInitializing = derived(auth, ($auth) => $auth.loginStatus === 'initializing');
export const isLoggingIn = derived(auth, ($auth) => $auth.loginStatus === 'logging-in');
export const isAuthenticated = derived(
	identity,
	($identity) => !!$identity && !$identity.getPrincipal().isAnonymous()
);
