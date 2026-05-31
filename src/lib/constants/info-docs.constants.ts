import {
	HELLO_EMAIL,
	PRIVACY_EMAIL,
	RESOLUTION_EMAIL,
	SUPPORT_EMAIL
} from '$lib/constants/contact.constants';
import type { InfoDoc } from '$lib/types/info-doc';

/**
 * Public information documents — Terms, Privacy, Resolution Rules,
 * FAQ, Contact, "How resolution works".
 *
 * **PLACEHOLDER COPY.** The `Legal · …` eyebrow lines mark documents
 * that must clear legal review before launch. The structure (blocks,
 * eyebrow + title, slug paths) is production-shaped — only the words
 * need to flow through legal.
 *
 * Copy is routed through i18n: every block references a `MessageKey`
 * (`info.doc.${slug}.${block}`) resolved per-locale at render time.
 * Email addresses are real contact identifiers, not translatable copy:
 * they come from `contact.constants` — `mail` blocks carry the constant
 * directly, and paragraphs that mention an address interpolate it via the
 * `{email}` param so the literal never duplicates across locales.
 */

const TERMS: InfoDoc = {
	slug: 'terms',
	titleKey: 'info.doc.terms.title',
	eyebrowKey: 'info.doc.terms.eyebrow',
	blocks: [
		{ kind: 'lede', key: 'info.doc.terms.b0' },
		{ kind: 'h', key: 'info.doc.terms.b1' },
		{ kind: 'p', key: 'info.doc.terms.b2' },
		{ kind: 'h', key: 'info.doc.terms.b3' },
		{ kind: 'p', key: 'info.doc.terms.b4' },
		{ kind: 'h', key: 'info.doc.terms.b5' },
		{ kind: 'p', key: 'info.doc.terms.b6' },
		{ kind: 'h', key: 'info.doc.terms.b7' },
		{ kind: 'p', key: 'info.doc.terms.b8' },
		{ kind: 'h', key: 'info.doc.terms.b9' },
		{ kind: 'p', key: 'info.doc.terms.b10' },
		{ kind: 'h', key: 'info.doc.terms.b11' },
		{ kind: 'p', key: 'info.doc.terms.b12' },
		{ kind: 'h', key: 'info.doc.terms.b13' },
		{ kind: 'p', key: 'info.doc.terms.b14' }
	]
};

const PRIVACY: InfoDoc = {
	slug: 'privacy',
	titleKey: 'info.doc.privacy.title',
	eyebrowKey: 'info.doc.privacy.eyebrow',
	blocks: [
		{ kind: 'lede', key: 'info.doc.privacy.b0' },
		{ kind: 'h', key: 'info.doc.privacy.b1' },
		{
			kind: 'list',
			itemKeys: [
				'info.doc.privacy.b2.i0',
				'info.doc.privacy.b2.i1',
				'info.doc.privacy.b2.i2',
				'info.doc.privacy.b2.i3'
			]
		},
		{ kind: 'h', key: 'info.doc.privacy.b3' },
		{
			kind: 'list',
			itemKeys: ['info.doc.privacy.b4.i0', 'info.doc.privacy.b4.i1', 'info.doc.privacy.b4.i2']
		},
		{ kind: 'h', key: 'info.doc.privacy.b5' },
		{ kind: 'p', key: 'info.doc.privacy.b6' },
		{ kind: 'h', key: 'info.doc.privacy.b7' },
		{ kind: 'p', key: 'info.doc.privacy.b8' },
		{ kind: 'h', key: 'info.doc.privacy.b9' },
		{ kind: 'p', key: 'info.doc.privacy.b10', params: { email: PRIVACY_EMAIL } },
		{ kind: 'h', key: 'info.doc.privacy.b11' },
		{ kind: 'p', key: 'info.doc.privacy.b12' }
	]
};

const RESOLUTION_RULES: InfoDoc = {
	slug: 'resolution-rules',
	titleKey: 'info.doc.resolution-rules.title',
	eyebrowKey: 'info.doc.resolution-rules.eyebrow',
	blocks: [
		{ kind: 'lede', key: 'info.doc.resolution-rules.b0' },
		{ kind: 'h', key: 'info.doc.resolution-rules.b1' },
		{ kind: 'p', key: 'info.doc.resolution-rules.b2' },
		{ kind: 'h', key: 'info.doc.resolution-rules.b3' },
		{ kind: 'p', key: 'info.doc.resolution-rules.b4' },
		{ kind: 'h', key: 'info.doc.resolution-rules.b5' },
		{ kind: 'p', key: 'info.doc.resolution-rules.b6' },
		{ kind: 'h', key: 'info.doc.resolution-rules.b7' },
		{ kind: 'p', key: 'info.doc.resolution-rules.b8' },
		{ kind: 'h', key: 'info.doc.resolution-rules.b9' },
		{
			kind: 'list',
			itemKeys: [
				'info.doc.resolution-rules.b10.i0',
				'info.doc.resolution-rules.b10.i1',
				'info.doc.resolution-rules.b10.i2'
			]
		},
		{ kind: 'h', key: 'info.doc.resolution-rules.b11' },
		{ kind: 'p', key: 'info.doc.resolution-rules.b12', params: { email: RESOLUTION_EMAIL } }
	]
};

const HOW_RESOLUTION_WORKS: InfoDoc = {
	slug: 'how-resolution-works',
	titleKey: 'info.doc.how-resolution-works.title',
	eyebrowKey: 'info.doc.how-resolution-works.eyebrow',
	blocks: [
		{ kind: 'lede', key: 'info.doc.how-resolution-works.b0' },
		{ kind: 'h', key: 'info.doc.how-resolution-works.b1' },
		{ kind: 'p', key: 'info.doc.how-resolution-works.b2' },
		{ kind: 'h', key: 'info.doc.how-resolution-works.b3' },
		{
			kind: 'list',
			itemKeys: [
				'info.doc.how-resolution-works.b4.i0',
				'info.doc.how-resolution-works.b4.i1',
				'info.doc.how-resolution-works.b4.i2'
			]
		},
		{ kind: 'h', key: 'info.doc.how-resolution-works.b5' },
		{ kind: 'p', key: 'info.doc.how-resolution-works.b6' },
		{ kind: 'h', key: 'info.doc.how-resolution-works.b7' },
		{ kind: 'p', key: 'info.doc.how-resolution-works.b8' },
		{ kind: 'h', key: 'info.doc.how-resolution-works.b9' },
		{ kind: 'p', key: 'info.doc.how-resolution-works.b10' }
	]
};

const FAQ: InfoDoc = {
	slug: 'faq',
	titleKey: 'info.doc.faq.title',
	eyebrowKey: 'info.doc.faq.eyebrow',
	blocks: [
		{ kind: 'h', key: 'info.doc.faq.b0' },
		{ kind: 'p', key: 'info.doc.faq.b1' },
		{ kind: 'h', key: 'info.doc.faq.b2' },
		{ kind: 'p', key: 'info.doc.faq.b3' },
		{ kind: 'h', key: 'info.doc.faq.b4' },
		{ kind: 'p', key: 'info.doc.faq.b5' },
		{ kind: 'h', key: 'info.doc.faq.b6' },
		{ kind: 'p', key: 'info.doc.faq.b7' },
		{ kind: 'h', key: 'info.doc.faq.b8' },
		{ kind: 'p', key: 'info.doc.faq.b9' },
		{ kind: 'h', key: 'info.doc.faq.b10' },
		{ kind: 'p', key: 'info.doc.faq.b11' },
		{ kind: 'h', key: 'info.doc.faq.b12' },
		{ kind: 'p', key: 'info.doc.faq.b13' },
		{ kind: 'h', key: 'info.doc.faq.b14' },
		{ kind: 'p', key: 'info.doc.faq.b15' }
	]
};

const CONTACT: InfoDoc = {
	slug: 'contact',
	titleKey: 'info.doc.contact.title',
	eyebrowKey: 'info.doc.contact.eyebrow',
	blocks: [
		{ kind: 'lede', key: 'info.doc.contact.b0' },
		{ kind: 'h', key: 'info.doc.contact.b1' },
		{ kind: 'mail', text: SUPPORT_EMAIL },
		{ kind: 'h', key: 'info.doc.contact.b3' },
		{ kind: 'p', key: 'info.doc.contact.b4' },
		{ kind: 'h', key: 'info.doc.contact.b5' },
		{
			kind: 'list',
			itemKeys: ['info.doc.contact.b6.i0', 'info.doc.contact.b6.i1', 'info.doc.contact.b6.i2']
		},
		{ kind: 'h', key: 'info.doc.contact.b7' },
		{ kind: 'mail', text: HELLO_EMAIL }
	]
};

/**
 * Full doc registry, keyed by slug. The `Legal · …` eyebrow lines mark
 * documents that must clear legal review before launch.
 */
export const INFO_DOCS: Readonly<Record<string, InfoDoc>> = Object.freeze({
	terms: TERMS,
	privacy: PRIVACY,
	'resolution-rules': RESOLUTION_RULES,
	'how-resolution-works': HOW_RESOLUTION_WORKS,
	faq: FAQ,
	contact: CONTACT
});
