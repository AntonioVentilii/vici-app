import { nonNullish } from '@dfinity/utils';
import type { PrincipalText } from '@junobuild/schema';

const DICEBEAR_STYLE = 'notionists';
const DICEBEAR_VERSION = '9.x';

/**
 * 64-bit FNV-1a hash, returned as a zero-padded 16-char hex string.
 *
 * Used to derive a deterministic DiceBear seed from the user's principal
 * without ever sending the raw principal to `api.dicebear.com`. FNV-1a is
 * fast, dependency-free and sync, which matters because avatar URL
 * resolution runs on every render.
 *
 * This is **not** a cryptographic hash — it only needs to break the direct
 * `principal -> avatar URL` correlation that a third-party image host would
 * otherwise receive in plaintext.
 */
const fnv1a64Hex = (input: string): string => {
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
 * DiceBear URL for a given seed. Kept in one place so every surface in the app
 * renders the same default avatar artwork for the same user.
 */
export const dicebearAvatarUrl = (seed: string): string =>
	`https://api.dicebear.com/${DICEBEAR_VERSION}/${DICEBEAR_STYLE}/svg?seed=${encodeURIComponent(seed)}`;

/**
 * Derives an opaque DiceBear seed from a principal so the raw principal text
 * never leaves the client in avatar requests. Deterministic: the same
 * principal always maps to the same avatar.
 */
export const avatarSeedForPrincipal = (principal: PrincipalText): string =>
	`vici-${fnv1a64Hex(principal)}`;

/**
 * Returns the provided avatar URL when set, or a deterministic DiceBear avatar
 * derived from a non-reversible hash of the principal. This ensures first-time
 * users never render a broken `<img src="">` or an awkward principal initial,
 * and avoids leaking the raw principal to the DiceBear host.
 */
export const resolveAvatarUrl = ({
	avatar,
	owner
}: {
	avatar?: string | null;
	owner: PrincipalText;
}): string => {
	if (nonNullish(avatar) && avatar.trim().length > 0) {
		return avatar;
	}

	return dicebearAvatarUrl(avatarSeedForPrincipal(owner));
};
