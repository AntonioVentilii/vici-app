// The one interface every chain adapter implements. Routes and the deposit
// watcher talk ONLY to this surface, so a chain whose env is missing simply
// registers as disabled and every caller degrades to a clean 503 instead of
// crashing.

import type { Asset } from '../custody/assets';
import type { Chain } from '../lib/keys';

export interface DepositEvent {
	/** `tx` events carry one transaction's received amount, deduplicated by
	 * txRef. `balance` events carry the address's full on-chain balance; the
	 * crediting layer books only the positive difference over the internal
	 * balance plus in-flight withdrawals. */
	kind: 'tx' | 'balance';
	/** Chain-level transaction reference (tx hash / signature / txid), or a
	 * balance-state key for `balance` events. */
	txRef: string;
	/** The custodial address that received the funds. */
	address: string;
	/** Amount in the asset's base units. */
	amount: bigint;
	asset: Asset;
	confirmations: number;
}

export interface TransferParams {
	/** The sending user; the adapter derives the signing key. Omitted for
	 * treasury-side sends. */
	fromUserId?: string;
	to: string;
	amount: bigint;
	asset: Asset;
}

export interface ChainAdapter {
	chain: Chain;
	enabled: boolean;
	/** The user's custodial deposit address on this chain (pure derivation,
	 * no I/O). */
	deriveAddress(userId: string): string;
	/** On-chain balance of an address in the asset's base units. */
	getBalance(params: { address: string; asset: Asset }): Promise<bigint>;
	/** Sign and broadcast a transfer; resolves to the chain tx reference. */
	transfer(params: TransferParams): Promise<string>;
	/** One deposit-watch pass over the supplied custodial addresses; returns
	 * newly observed (sufficiently confirmed) deposits. Must be idempotent
	 * across ticks: re-reporting an already credited deposit is tolerated and
	 * deduplicated downstream, silently skipping one is not. */
	watchDeposits(params: { addresses: string[]; assets: Asset[] }): Promise<DepositEvent[]>;
}

export class ChainDisabledError extends Error {
	constructor(chain: Chain) {
		super(`chain adapter ${chain} is not configured`);
	}
}
