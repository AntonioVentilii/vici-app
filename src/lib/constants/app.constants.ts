import type { RegistryDid } from '$declarations';
import { isDev } from '$lib/env/app.env';
import { toNullable, type Nullable } from '@dfinity/utils';

export const REPLICA_HOST = isDev() ? window.location.origin : 'https://icp-api.io';

// eslint-disable-next-line no-restricted-syntax -- This is the definition
export const ZERO = 0n;

// Vici uses Binary outcomes (no strike needed)
export const PAYOFF_TYPE: RegistryDid.PayoffType = { Binary: null };
export const STRIKE: Nullable<RegistryDid.Price> = toNullable();
export const PRICE_DECIMALS = 2;
/** Must match `icdc-core` `shared::constants::USD_DECIMALS` (margin / equity use this scale). */
export const USD_DECIMALS = 4;

// Oracles
export const VICI_ORACLE_V1 = 'VICI_ORACLE_V1';

// Time
export const SECOND_IN_NANOSECONDS = 1_000_000_000n;
export const MILLISECOND_IN_NANOSECONDS = 1_000_000n;
export const MINUTE_IN_SECONDS = 60n;
export const HOUR_IN_SECONDS = 60n * MINUTE_IN_SECONDS;
export const DAY_IN_SECONDS = 24n * HOUR_IN_SECONDS;
export const WEEK_IN_SECONDS = 7n * DAY_IN_SECONDS;
export const MINUTE_IN_NANOSECONDS = MINUTE_IN_SECONDS * SECOND_IN_NANOSECONDS;
export const HOUR_IN_NANOSECONDS = HOUR_IN_SECONDS * SECOND_IN_NANOSECONDS;
export const DAY_IN_NANOSECONDS = DAY_IN_SECONDS * SECOND_IN_NANOSECONDS;
export const WEEK_IN_NANOSECONDS = WEEK_IN_SECONDS * SECOND_IN_NANOSECONDS;

// Internet Identity
export const II_MAX_TIME_TO_LIVE_NS = WEEK_IN_NANOSECONDS;

// Wallets
export const WALLET_PAGINATION = 10n;
