import { SUPPORT_EMAIL } from '$lib/constants/contact.constants';
import type { InfoDoc } from '$lib/types/info-doc';

/**
 * Full controlling legal documents — Terms of Service (Privacy and the
 * other long-form legal docs follow the same shape).
 *
 * Legal bodies are stored as literal English text, NOT i18n keys. The
 * live locale catalogs must mirror `en.ts` exactly and only the English
 * controlling version exists for these documents, so the full bodies are
 * kept out of the i18n catalogs by design and carried here as literal
 * `text` / `items` blocks (and literal `title` / `eyebrow`). Localized
 * help docs (FAQ, Contact, How resolution works, Resolution rules) stay
 * keyed in `info-docs.constants`.
 *
 * Contact addresses are real identifiers, not translatable copy: they
 * come from `contact.constants`. Where an address stands alone as a
 * contact line it is a dedicated `mail` block; where it is embedded
 * mid-sentence it is interpolated inline from the constant.
 */

export const TERMS: InfoDoc = {
	slug: 'terms',
	title: 'Terms of Service',
	eyebrow: 'Legal · Effective 10 June 2026',
	blocks: [
		{ kind: 'p', text: 'Last updated: 10 June 2026' },
		{ kind: 'h', text: '1. Who we are and what these Terms cover' },
		{
			kind: 'lede',
			text: 'Vici ("Vici", "we", "us", "our") is operated by Wholesome Capital Limited, a private company limited by shares incorporated in Hong Kong SAR (Business Registration Number 2391347).'
		},
		{
			kind: 'p',
			text: 'These Terms of Service ("Terms") govern your access to and use of Vici at vici.market and our applications (together, the "Service"). By accessing or using the Service, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Service.'
		},
		{ kind: 'h', text: '2. Eligibility' },
		{
			kind: 'p',
			text: 'You must be at least 18 years old to use the Service, and you confirm that you are when you use it. The Service is offered only where it is lawful. It is void where prohibited, and you are responsible for ensuring that your use of the Service is legal in your location.'
		},
		{ kind: 'h', text: '3. Your account' },
		{
			kind: 'p',
			text: 'To use most features you create an account. You agree to provide accurate information, to keep your credentials secure, and to be responsible for activity under your account. You may hold only one account unless we agree otherwise. We may suspend or close accounts that breach these Terms or that we reasonably believe are being used for fraud, manipulation or abuse.'
		},
		{ kind: 'h', text: '4. Nature of the Service — please read' },
		{
			kind: 'p',
			text: 'The Service is a free-to-play prediction game for entertainment only. This Section is fundamental to these Terms.'
		},
		{
			kind: 'list',
			items: [
				'No monetary value. "VXP" and any other points, currencies, badges or items within the Service (together, "Virtual Items") have no monetary value. They are not money, credit, cryptocurrency, securities or property.',
				'No purchase, no payout. Virtual Items cannot be purchased, sold, traded, transferred, gifted, withdrawn, redeemed or exchanged for money, cryptocurrency, goods, prizes or anything of value, whether on the Service or elsewhere. There is nothing to buy in order to play.',
				'No gambling. The Service does not offer real-money wagering, betting or gambling of any kind. Because no consideration is staked and no prize of value is awarded, the Service is not gambling.',
				'Not a regulated market. The Service is not a securities exchange, a commodities or derivatives market, a real-money prediction market, or any other regulated financial venue, and is not supervised as one.',
				'Not advice. Predictions, odds, scores and any information shown in the Service are for entertainment only and are not financial, investment, legal, betting or other professional advice. Do not rely on them.'
			]
		},
		{ kind: 'h', text: '5. Virtual Items (VXP)' },
		{
			kind: 'p',
			text: 'Virtual Items are licensed, not sold or owned. We grant you a limited, personal, non-transferable, revocable licence to use Virtual Items within the Service for entertainment. You acquire no property, ownership or monetary right in them.'
		},
		{
			kind: 'p',
			text: 'We may create, manage, adjust, reset, reduce, expire or remove Virtual Items, and may change how they work or discontinue them, at any time, without liability and without owing you any payment or compensation, subject to applicable mandatory law. Virtual Items you hold confer no entitlement against us.'
		},
		{ kind: 'h', text: '6. Acceptable use' },
		{ kind: 'p', text: 'You agree not to:' },
		{
			kind: 'list',
			items: [
				'cheat, manipulate outcomes or leaderboards, exploit bugs, or use bots, scripts or automated means to interact with the Service;',
				"operate multiple or fake accounts, or interfere with other users' fair use;",
				'reverse engineer, scrape, copy, resell or commercially exploit the Service except as allowed by law;',
				'upload unlawful, infringing, harmful, deceptive or abusive content; or',
				'use the Service in violation of any applicable law, including your local law (Section 2).'
			]
		},
		{
			kind: 'p',
			text: 'We may remove content, and suspend or terminate access, for breach of this Section.'
		},
		{ kind: 'h', text: '7. Your content' },
		{
			kind: 'p',
			text: 'You may submit content such as predictions, a display name and profile details ("Your Content"). You keep any rights you have in Your Content. You grant us a worldwide, non-exclusive, royalty-free licence to host, store, display and use Your Content to operate and promote the Service. You are responsible for Your Content and confirm you have the right to submit it. We may moderate, remove or refuse content at our discretion, consistent with applicable law.'
		},
		{ kind: 'h', text: '8. Intellectual property' },
		{
			kind: 'p',
			text: 'The Service, including its software, prediction cards, designs, text, graphics, the Vici name and brand, and the badge/character system, is owned by us or our licensors and protected by intellectual property laws. We grant you a limited, personal, non-transferable, revocable licence to use the Service for its intended purpose. You may not use our brand or content without our prior written permission, except as permitted by law.'
		},
		{ kind: 'h', text: '9. Advertising and third parties' },
		{
			kind: 'p',
			text: 'The Service is supported in part by advertising and may contain links to or content from third parties. Third-party services are governed by their own terms and privacy practices, and we are not responsible for them. How advertising data is handled is described in the Privacy Policy (Sections 6 and 13), including consent controls for users in the EU/EEA and UK.'
		},
		{ kind: 'h', text: '10. Infrastructure and availability' },
		{
			kind: 'p',
			text: 'The Service runs on the Internet Computer Protocol, a decentralised public network (see Privacy Policy Section 5). We aim to keep the Service available but do not guarantee uninterrupted or error-free operation, and availability may depend on networks and infrastructure outside our control. We may modify, suspend or discontinue any part of the Service at any time.'
		},
		{ kind: 'h', text: '11. Disclaimers' },
		{
			kind: 'p',
			text: 'To the maximum extent permitted by law, the Service is provided "as is" and "as available", without warranties of any kind, whether express or implied, including fitness for a particular purpose, accuracy, and non-infringement. We do not warrant that the Service will be uninterrupted, secure, or error-free, or that outcomes, scores or information shown are accurate or timely. Nothing in these Terms excludes any warranty or right that cannot be excluded under applicable mandatory law.'
		},
		{ kind: 'h', text: '12. Limitation of liability' },
		{
			kind: 'p',
			text: 'To the maximum extent permitted by law, we will not be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of data, profits or goodwill, arising from or related to your use of the Service. Because the Service is free and Virtual Items have no monetary value, our total aggregate liability to you for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim, which is normally zero. Nothing here limits liability that cannot be limited under applicable mandatory law, including, where applicable, consumer rights.'
		},
		{ kind: 'h', text: '13. Indemnity' },
		{
			kind: 'p',
			text: 'To the extent permitted by law, you agree to indemnify us against claims, losses and costs arising from your breach of these Terms, your misuse of the Service, or Your Content.'
		},
		{ kind: 'h', text: '14. Suspension and termination' },
		{
			kind: 'p',
			text: 'You may stop using the Service at any time. We may suspend or terminate your access if you breach these Terms or where we reasonably need to for legal, security or operational reasons. Sections that by their nature should survive termination (including Sections 4, 5, 8, 11, 12, 13 and 16) survive.'
		},
		{ kind: 'h', text: '15. Changes' },
		{
			kind: 'p',
			text: 'We may update the Service and these Terms from time to time. For material changes to the Terms we will take reasonable steps to notify you and will update the "Last updated" date. Continued use after changes take effect means you accept the updated Terms, except where applicable law requires fresh consent.'
		},
		{ kind: 'h', text: '16. Governing law and disputes' },
		{
			kind: 'p',
			text: 'These Terms are governed by the laws of Hong Kong SAR, and the courts of Hong Kong have jurisdiction, except that this does not deprive you of the protection of mandatory consumer-protection rules, or the right to bring proceedings, that apply in your country of residence and cannot be contracted out of.'
		},
		{ kind: 'h', text: '17. General' },
		{
			kind: 'p',
			text: 'If any provision is held unenforceable, the rest remains in effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms; we may assign them to an affiliate or successor. These Terms and the Privacy Policy are the entire agreement between you and us regarding the Service.'
		},
		{ kind: 'h', text: '18. Contact' },
		{
			kind: 'p',
			text: `Wholesome Capital Limited Unit 2505, 25/F., Billion Plaza, 8 Cheung Yue Street, Lai Chi Kok, Kowloon, Hong Kong Email: ${SUPPORT_EMAIL}`
		},
		{ kind: 'h', text: 'Schedule A — United States' },
		{
			kind: 'p',
			text: 'For users in the United States: the Service is a free-to-play game with no monetary value (Sections 4 and 5). It offers no real-money play, no purchase, and no payout, and is not a licensed gambling operator, a sweepstakes, or a regulated prediction or derivatives market. The Service is void where prohibited; you are responsible for compliance with the law of your state.'
		}
	]
};
