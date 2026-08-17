// Validated environment. In production DATABASE_URL and SESSION_SECRET are
// required and the process refuses to boot without them; everything else is
// optional. In dev every var carries a local default so `bun dev` works with
// just the docker-compose Postgres.
//
// Optional integrations added by later phases (email, object storage, chain
// adapters) follow a two-mode degrade: when unconfigured they log or stub
// (email prints to the console, storage falls back to local disk in dev)
// instead of crashing, each exposed via an `enabled` getter on its own group.
// See backend/README.md for the full table.

export type EnvSource = Record<string, string | undefined>;

export interface Env {
	isProd: boolean;
	port: number;
	databaseUrl: string;
	publicAppUrl: string;
	apiBaseUrl: string;
	sessionSecret: string;
	logLevel: string;
	workerPollIntervalMs: number;
}

/** Build a validated env object from a raw source. Exported separately from
 * the singleton so tests can exercise the validation rules directly. */
export const loadEnv = (source: EnvSource): Env => {
	const isProd = source.NODE_ENV === 'production';

	const optional = (name: string, fallback: string): string => {
		const value = source[name] ?? '';

		return value === '' ? fallback : value;
	};

	/** Required in production (fail fast at boot); dev falls back. */
	const requiredInProd = (name: string, devFallback: string): string => {
		const value = source[name] ?? '';

		if (value !== '') {
			return value;
		}

		if (isProd) {
			throw new Error(`Missing required env var: ${name}`);
		}

		return devFallback;
	};

	const positiveInt = (name: string, fallback: string): number => {
		const value = Number(optional(name, fallback));

		if (!Number.isInteger(value) || value <= 0) {
			throw new Error(`Invalid env var ${name}: expected a positive integer`);
		}

		return value;
	};

	const port = positiveInt('PORT', '8787');

	return {
		isProd,
		port,
		databaseUrl: requiredInProd('DATABASE_URL', 'postgres://vici:vici@localhost:5432/vici'),
		// The public origin of the SPA: drives the credentialed CORS allowlist
		// (and, in later phases, OAuth redirects). Defaults to the Vite dev server.
		publicAppUrl: optional('PUBLIC_APP_URL', 'http://localhost:5173'),
		// Where THIS server is reachable, for building absolute callback URLs.
		apiBaseUrl: optional('API_BASE_URL', `http://localhost:${port}`),
		sessionSecret: requiredInProd('SESSION_SECRET', 'dev-secret-do-not-use-in-prod'),
		logLevel: optional('LOG_LEVEL', 'info'),
		workerPollIntervalMs: positiveInt('WORKER_POLL_INTERVAL_MS', '60000')
	};
};

export const env = loadEnv(process.env);
