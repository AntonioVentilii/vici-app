import type { RegistryDid } from '$declarations';
import { isDev } from '$lib/env/app.env';
import { toNullable, type Nullable } from '@dfinity/utils';

export const REPLICA_HOST = isDev() ? window.location.origin : 'https://icp-api.io';

// eslint-disable-next-line no-restricted-syntax -- This is the definition
export const ZERO = 0n;

// Vici uses Binary outcomes (no strike needed)
export const PAYOFF_TYPE: RegistryDid.PayoffType = { Binary: null };
export const STRIKE: Nullable<bigint> = toNullable();

// Oracles
export const VICI_ORACLE_V1 = 'VICI_ORACLE_V1';

export const NANO_SECONDS_IN_MILLISECOND = 1_000_000n;
