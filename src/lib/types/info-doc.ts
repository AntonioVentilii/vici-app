import type { MessageKey } from '$lib/utils/i18n.utils';

/**
 * Lightweight document model for the public `/info/[slug]` routes —
 * Terms, Privacy, Resolution Rules, FAQ, Contact, How resolution works.
 *
 * Block-based on purpose: legal / help copy iterates across sections of
 * heading + paragraph + list, and storing them as structured data (vs.
 * a raw HTML string) keeps each block trivially translatable and styles
 * the renderer applies consistently across documents.
 *
 * Translatable copy is referenced by `MessageKey`, resolved per-locale
 * at render time via `t(...)`. The only literal carried inline is the
 * `mail` address — a contact identifier, not translatable copy.
 *
 * The current copy is **placeholder**. Legal sign-off is required before
 * launch — the `Legal · …` eyebrow lines flag the docs that need it.
 */

export type InfoDocBlock =
	| { kind: 'lede'; key: MessageKey }
	| { kind: 'h'; key: MessageKey }
	| { kind: 'p'; key: MessageKey }
	| { kind: 'list'; itemKeys: MessageKey[] }
	| { kind: 'mail'; text: string };

export interface InfoDoc {
	slug: string;
	/** i18n key for the header title (also the page `<title>`). */
	titleKey: MessageKey;
	/** i18n key for the eyebrow line above the title. */
	eyebrowKey: MessageKey;
	/** Body content, rendered in order. */
	blocks: InfoDocBlock[];
}
