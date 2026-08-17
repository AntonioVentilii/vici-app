import type { TrackEventInput } from '$lib/types/analytics-event';
import { web2ApiBaseUrl } from '$lib/web2/backend-mode';
import { isNullish } from '@dfinity/utils';

/**
 * Thin typed fetch client for the HTTP API (`/api/v1/...`).
 *
 * Sessions ride an HttpOnly cookie, so every request opts in to
 * credentials; the client itself holds no auth state. Error responses use
 * a stable `{ error: string }` envelope, surfaced as {@link Web2ApiError}
 * so callers can branch on `status` / `code` without parsing bodies.
 *
 * Add a typed wrapper here per endpoint a dual-mode service needs; keep
 * the wrappers thin (shape mapping only, no orchestration).
 */

export class Web2ApiError extends Error {
	readonly status: number;
	/** Stable machine-readable code from the `{ error }` envelope. */
	readonly code: string;

	constructor({ status, code }: { status: number; code: string }) {
		super(`Web2 API error (${status}): ${code}`);

		this.status = status;
		this.code = code;
	}
}

const errorCode = async (response: Response): Promise<string> => {
	try {
		const payload: unknown = await response.json();

		if (
			!isNullish(payload) &&
			typeof payload === 'object' &&
			'error' in payload &&
			typeof payload.error === 'string'
		) {
			return payload.error;
		}
	} catch {
		// Non-JSON error body (proxy error page, empty 502); the generic code below applies.
	}

	return 'unknown_error';
};

const request = async <T>({
	path,
	method,
	body
}: {
	path: string;
	method: 'GET' | 'POST';
	body?: Record<string, unknown>;
}): Promise<T> => {
	const response = await fetch(`${web2ApiBaseUrl()}${path}`, {
		method,
		credentials: 'include',
		...(isNullish(body)
			? {}
			: {
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				})
	});

	if (!response.ok) {
		throw new Web2ApiError({ status: response.status, code: await errorCode(response) });
	}

	return (await response.json()) as T;
};

export type Web2ProviderStatus = 'available' | 'coming_soon';

export interface Web2Providers {
	email: Web2ProviderStatus;
	google: Web2ProviderStatus;
	apple: Web2ProviderStatus;
}

export interface Web2Identity {
	provider: string;
	email: string | null;
}

export interface Web2LegacyPrincipal {
	principal: string;
	matchedVia: string;
}

export interface Web2Me {
	id: string;
	role: string;
	displayName: string | null;
	avatarUrl: string | null;
	createdAt: string;
	identities: Web2Identity[];
	legacyPrincipals: Web2LegacyPrincipal[];
}

export const getProviders = async (): Promise<Web2Providers> => {
	const { providers } = await request<{ providers: Web2Providers }>({
		path: '/api/v1/auth/providers',
		method: 'GET'
	});

	return providers;
};

export const getMe = async (): Promise<Web2Me> => {
	const { user } = await request<{ user: Web2Me }>({ path: '/api/v1/me', method: 'GET' });

	return user;
};

export const postEvents = async ({
	events
}: {
	events: TrackEventInput[];
}): Promise<{ accepted: number }> =>
	await request<{ accepted: number }>({
		path: '/api/v1/events',
		method: 'POST',
		body: { events }
	});

export const logout = async (): Promise<void> => {
	await request<{ ok: boolean }>({ path: '/api/v1/auth/logout', method: 'POST' });
};
