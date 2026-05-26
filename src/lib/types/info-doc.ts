/**
 * Lightweight document model for the public `/info/[slug]` routes —
 * Terms, Privacy, Resolution Rules, FAQ, Contact, How resolution works.
 *
 * Block-based on purpose: legal / help copy iterates across sections of
 * heading + paragraph + list, and storing them as structured data (vs.
 * a raw HTML string) keeps each block trivially translatable and styles
 * the renderer applies consistently across documents.
 *
 * The current copy is **placeholder**.
 * Legal sign-off is required before launch — see the banner in
 * `InfoPage.svelte`.
 */

export type InfoDocBlock =
	| { kind: 'lede'; text: string }
	| { kind: 'h'; text: string }
	| { kind: 'p'; text: string }
	| { kind: 'list'; items: string[] }
	| { kind: 'mail'; text: string };

export interface InfoDoc {
	slug: string;
	/** Header title (also the page <title>). */
	title: string;
	/** Eyebrow line above the title, e.g. "Legal · Effective May 1, 2026". */
	eyebrow: string;
	/** Body content, rendered in order. */
	blocks: InfoDocBlock[];
}
