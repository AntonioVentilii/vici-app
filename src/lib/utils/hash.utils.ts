// Shared string-hash helpers. These are NOT cryptographic primitives;
// they exist to derive deterministic seeds (artwork PRNGs, avatar URLs,
// invite-code suffixes) from arbitrary input without taking a dependency
// on `crypto.subtle` and without sending the raw input to a third party.

/**
 * 32-bit FNV-1a hash. Fast, branch-free, allocation-free; the workhorse
 * seed for FlowArt's `mulberry32` PRNG and any time we need a stable
 * unsigned int from a string.
 */
export const fnv1a32 = (input: string): number => {
	let h = 0x811c9dc5;

	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) | 0;
	}

	return h >>> 0;
};

/**
 * 64-bit FNV-1a hash, returned as a zero-padded 16-char hex string.
 * Used to derive an opaque DiceBear seed from the user's principal so
 * the raw principal never leaves the client in avatar requests.
 */
export const fnv1a64Hex = (input: string): string => {
	const MASK = 0xffffffffffffffffn;
	const PRIME = 0x100000001b3n;
	let hash = 0xcbf29ce484222325n;

	for (let i = 0; i < input.length; i++) {
		hash ^= BigInt(input.charCodeAt(i));
		hash = (hash * PRIME) & MASK;
	}

	return hash.toString(16).padStart(16, '0');
};

/**
 * Classic djb2 hash. Returned as an unsigned 32-bit int; the
 * `invite-code` flow base36-encodes a 5-char prefix of this for a
 * compact, human-typable suffix.
 */
export const djb2 = (input: string): number => {
	let h = 5381;

	for (let i = 0; i < input.length; i++) {
		h = ((h << 5) + h + input.charCodeAt(i)) | 0;
	}

	return Math.abs(h);
};
