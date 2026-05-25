import type { InfoDoc } from '$lib/types/info-doc';

/**
 * Public information documents — Terms, Privacy, Resolution Rules,
 * FAQ, Contact, "How resolution works".
 *
 * **PLACEHOLDER COPY.** Sourced verbatim from the design prototype
 * (`screens.jsx` § INFO_DOCS). Legal sign-off is required before
 * launch; the `InfoPage` renderer surfaces a banner to that effect
 * for any doc marked `placeholder: true`. The structure (blocks,
 * eyebrow + title, slug paths) is production-shaped — only the words
 * need to flow through legal.
 *
 * Translation: blocks are stored as canonical English literals here so
 * UI can render them via interpolation without tripping the
 * `no-bare-svelte-text` lint rule. A future i18n pass will key each
 * block by `${doc.slug}.${index}` and let translators replace the body
 * per locale.
 */

export const INFO_DOC_PLACEHOLDER_TAG = 'placeholder' as const;

const TERMS: InfoDoc = {
	slug: 'terms',
	title: 'Terms of service',
	eyebrow: 'Legal · Effective May 1, 2026',
	blocks: [
		{
			kind: 'lede',
			text: 'By using VICI you agree to the terms below. They are written in plain language. The legally binding version is the one you are reading now.'
		},
		{ kind: 'h', text: '1. The service' },
		{
			kind: 'p',
			text: 'VICI is a free predictions app. We provide markets that resolve on public sources. We do not facilitate any wagering of money.'
		},
		{ kind: 'h', text: '2. Your account' },
		{
			kind: 'p',
			text: 'You agree to provide accurate information and to use one account only. Multiple accounts created to manipulate leaderboards or bouts will be removed without notice.'
		},
		{ kind: 'h', text: '3. Your predictions' },
		{
			kind: 'p',
			text: 'You retain ownership of your account history. We retain the right to display aggregated and anonymised statistics derived from it.'
		},
		{ kind: 'h', text: '4. VXP' },
		{
			kind: 'p',
			text: 'VXP is an in-app credit with no monetary value. It cannot be redeemed, transferred outside the app, or exchanged for currency.'
		},
		{ kind: 'h', text: '5. Acceptable conduct' },
		{
			kind: 'p',
			text: 'No automation. No coordinated voting. No impersonation. No content prohibited by applicable law.'
		},
		{ kind: 'h', text: '6. Termination' },
		{
			kind: 'p',
			text: 'You may delete your account at any time from Settings. We may suspend an account that violates these terms. We will tell you why.'
		},
		{ kind: 'h', text: '7. Changes' },
		{
			kind: 'p',
			text: 'Material changes are announced in-app at least seven days before they take effect. Continued use after that date is agreement.'
		}
	]
};

const PRIVACY: InfoDoc = {
	slug: 'privacy',
	title: 'Privacy policy',
	eyebrow: 'Legal · Effective May 1, 2026',
	blocks: [
		{
			kind: 'lede',
			text: 'What we collect, why we collect it, who we share it with. Short version: we collect as little as we can.'
		},
		{ kind: 'h', text: 'What we collect' },
		{
			kind: 'list',
			items: [
				'Account: your handle, email, language and appearance preference',
				'Predictions: every call you make, when you made it, the outcome',
				'Device: a session token in localStorage; no advertising IDs',
				'Affiliation: the school you self-select for Worlds (locked for 90 days after change)'
			]
		},
		{ kind: 'h', text: 'How we use it' },
		{
			kind: 'list',
			items: [
				'To compute your accuracy, streak, rank, and VXP',
				'To display your handle on leaderboards you opt into',
				'To answer support requests'
			]
		},
		{ kind: 'h', text: 'Who we share with' },
		{
			kind: 'p',
			text: 'No third-party advertising. No data brokers. Aggregated, anonymised statistics may appear in editorial content (e.g. “64% of users called YES”). Your individual calls are visible to leagues you join.'
		},
		{ kind: 'h', text: 'Where it lives' },
		{
			kind: 'p',
			text: 'Servers in the European Union. Data is encrypted at rest and in transit.'
		},
		{ kind: 'h', text: 'Your rights' },
		{
			kind: 'p',
			text: 'Access, export, correction, and deletion of your data are available on request to privacy@vici.markets. We respond within thirty days.'
		},
		{ kind: 'h', text: 'Cookies' },
		{ kind: 'p', text: 'We store one session token. We do not use tracking cookies.' }
	]
};

const RESOLUTION_RULES: InfoDoc = {
	slug: 'resolution-rules',
	title: 'Resolution rules',
	eyebrow: 'Legal · The full procedure',
	blocks: [
		{
			kind: 'lede',
			text: 'The exact procedure by which every market on VICI is resolved. Authoritative source: this document.'
		},
		{ kind: 'h', text: 'Pre-listing' },
		{
			kind: 'p',
			text: 'Before a market opens for predictions, two facts are fixed and published on the back of the market card: the resolution criterion (the YES condition in plain language) and the source (the named public data feed that will decide).'
		},
		{ kind: 'h', text: 'Trading window' },
		{
			kind: 'p',
			text: 'Predictions are accepted from open until the displayed trading close. After close, calls are locked. The market enters the resolution window.'
		},
		{ kind: 'h', text: 'Resolution window' },
		{
			kind: 'p',
			text: 'The named source must publish within the resolution window (typically seven calendar days after trading close, longer for sources that publish on a fixed schedule).'
		},
		{ kind: 'h', text: 'Outcome recording' },
		{
			kind: 'p',
			text: 'Within twenty-four hours of source publication, the outcome is recorded against every call. Wins and losses appear on your Dash immediately.'
		},
		{ kind: 'h', text: 'Edge cases' },
		{
			kind: 'list',
			items: [
				'Ambiguous outcome → Vici editorial reviews against the criterion. Decision and reasoning are posted publicly.',
				'Source fails to publish → market voided, stakes returned, no accuracy effect either way.',
				'Source changes its methodology mid-window → market voided unless the change is immaterial.'
			]
		},
		{ kind: 'h', text: 'Disputes' },
		{
			kind: 'p',
			text: 'Any caller may file a resolution dispute within seventy-two hours by emailing resolution@vici.markets with their handle, the market id, and the basis for the dispute. Disputes are reviewed by editorial and answered within twenty-four hours.'
		}
	]
};

const HOW_RESOLUTION_WORKS: InfoDoc = {
	slug: 'how-resolution-works',
	title: 'How resolution works',
	eyebrow: 'Help · Resolution',
	blocks: [
		{
			kind: 'lede',
			text: 'Every market on VICI resolves on a single, named public source. No moderation panel. No debate. The source decides.'
		},
		{ kind: 'h', text: 'The principle' },
		{
			kind: 'p',
			text: 'A prediction market only works if both sides know the rules at the moment they make a call. Before any market goes live, we publish the exact public source that will decide it — a regulator filing, a federation result, a recognised data provider.'
		},
		{ kind: 'h', text: 'What you see on each card' },
		{
			kind: 'list',
			items: [
				'Resolution criterion · the precise YES condition, written in plain language',
				'Source · the publication or feed that decides',
				'Settles · the calendar date the source publishes the outcome'
			]
		},
		{ kind: 'h', text: 'When the source publishes' },
		{
			kind: 'p',
			text: 'The market freezes at trading close on the settles date. The published outcome is recorded against every call made on the market. Winners earn VXP at the rate displayed when they made the call. Losers earn nothing.'
		},
		{ kind: 'h', text: 'If a source fails to publish' },
		{
			kind: 'p',
			text: 'Rare but documented. The market is voided. Every caller receives their stake back in full. No accuracy points are awarded either way.'
		},
		{ kind: 'h', text: 'If a source publishes ambiguously' },
		{
			kind: 'p',
			text: 'Vici editorial reviews against the published criterion. Decisions and reasoning are posted publicly on the market’s back-of-card resolution panel.'
		}
	]
};

const FAQ: InfoDoc = {
	slug: 'faq',
	title: 'Frequently asked',
	eyebrow: 'Help · FAQ',
	blocks: [
		{ kind: 'h', text: 'What is VXP?' },
		{
			kind: 'p',
			text: 'VXP is the in-app prediction credit. Make calls to earn it. It is not currency. It cannot be redeemed. It is the unit of your track record.'
		},
		{ kind: 'h', text: 'Is this real money?' },
		{
			kind: 'p',
			text: 'No. VICI is a free app for human judgment. There is no deposit, no withdrawal, no payout. Real-money markets are explored separately.'
		},
		{ kind: 'h', text: 'How is my accuracy calculated?' },
		{
			kind: 'p',
			text: 'Resolved calls divided by total resolved calls. Open calls do not count until the market settles.'
		},
		{ kind: 'h', text: 'Why did my streak reset?' },
		{
			kind: 'p',
			text: 'Streak counts consecutive days with at least one call. A blank day resets it. The streak flame shows your current run; longest is preserved.'
		},
		{ kind: 'h', text: 'Can I delete a call?' },
		{
			kind: 'p',
			text: 'No. Every call is permanent the moment you commit. This is the entire premise of building a record.'
		},
		{ kind: 'h', text: 'What is a contrarian win?' },
		{
			kind: 'p',
			text: 'A call you made against the consensus (<30% on your side at the time of the call) that subsequently resolved in your favor.'
		},
		{ kind: 'h', text: 'Who can see my predictions?' },
		{
			kind: 'p',
			text: 'Your handle and accuracy are public on global leaderboards, league standings, and Worlds bouts you opt into. Individual market calls are visible only to leagues you belong to.'
		},
		{ kind: 'h', text: 'How do bouts work?' },
		{
			kind: 'p',
			text: 'Bouts are time-bound competitions between leagues or universities. Average accuracy during the window determines the winner. A minimum number of calls is required to qualify.'
		}
	]
};

const CONTACT: InfoDoc = {
	slug: 'contact',
	title: 'Contact support',
	eyebrow: 'Help · Support',
	blocks: [
		{
			kind: 'lede',
			text: 'We are a small team. Most questions are answered in the FAQ. For anything else, write to us directly.'
		},
		{ kind: 'h', text: 'Email' },
		{ kind: 'mail', text: 'support@vici.markets' },
		{ kind: 'h', text: 'Response time' },
		{
			kind: 'p',
			text: 'Within two business days. Resolution disputes are prioritised and answered within twenty-four hours.'
		},
		{ kind: 'h', text: 'What to include' },
		{
			kind: 'list',
			items: [
				'Your handle (@example)',
				'The market or screen the question is about',
				'A screenshot if possible'
			]
		},
		{ kind: 'h', text: 'Press, partnerships, and league sponsorship' },
		{ kind: 'mail', text: 'hello@vici.markets' }
	]
};

/**
 * Full doc registry, keyed by slug. The frontmatter `eyebrow` lines that
 * read "Legal · …" mark documents that must clear legal review before
 * launch; the renderer surfaces a placeholder banner over those.
 */
export const INFO_DOCS: Readonly<Record<string, InfoDoc>> = Object.freeze({
	terms: TERMS,
	privacy: PRIVACY,
	'resolution-rules': RESOLUTION_RULES,
	'how-resolution-works': HOW_RESOLUTION_WORKS,
	faq: FAQ,
	contact: CONTACT
});

/** Order in which docs surface in any footer / index UI. */
export const INFO_DOC_ORDER: readonly string[] = [
	'faq',
	'how-resolution-works',
	'resolution-rules',
	'terms',
	'privacy',
	'contact'
] as const;
