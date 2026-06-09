<script lang="ts">
	/**
	 * Landing footer — brand block (wordmark + tagline + Latin motto)
	 * beside three link columns (Product / Help / Legal), then the FIFA
	 * registered-trademark line and the entertainment / 13+ / VXP-has-
	 * no-cash-value disclosure.
	 */
	import Logo from '$lib/components/layout/Logo.svelte';
	import { LATIN_MOTTO_LEAD, LATIN_MOTTO_TAIL } from '$lib/constants/brand.constants';
	import { INFO_EMAIL } from '$lib/constants/contact.constants';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface FooterLink {
		readonly label: MessageKey;
		readonly href: string;
	}

	interface FooterCol {
		readonly heading: MessageKey;
		readonly links: readonly FooterLink[];
	}

	const tt = (key: MessageKey) => t({ locale: $localeStore, key });

	const cols: readonly FooterCol[] = [
		{
			heading: 'footer.product',
			links: [
				{ label: 'footer.app', href: PublicPath.SignIn },
				{ label: 'footer.signin', href: PublicPath.SignIn },
				{ label: 'footer.leaderboard', href: '#status' }
			]
		},
		{
			heading: 'footer.help',
			links: [
				{ label: 'footer.faq', href: '#faq' },
				{ label: 'footer.trust', href: '#trust' },
				{ label: 'footer.contact', href: `mailto:${INFO_EMAIL}` }
			]
		},
		{
			heading: 'footer.legal',
			links: [
				{ label: 'footer.terms', href: `${PublicPath.Info}/terms` },
				{ label: 'footer.privacy', href: `${PublicPath.Info}/privacy` },
				{ label: 'footer.rules', href: `${PublicPath.Info}/resolution-rules` }
			]
		}
	];
</script>

<footer class="lpc-footer">
	<div class="lpc-wrap">
		<div class="lpc-footer-top">
			<div class="lpc-footer-brand">
				<Logo href={PublicPath.Welcome} />
				<p class="lpc-footer-tag">{tt('footer.tagline')}</p>
				<div class="lpc-footer-latin">
					{LATIN_MOTTO_LEAD}<span class="acc">{LATIN_MOTTO_TAIL}</span>
				</div>
			</div>
			<div class="lpc-footer-cols">
				{#each cols as col (col.heading)}
					<div class="lpc-footer-col">
						<span class="lpc-footer-h">{tt(col.heading)}</span>
						{#each col.links as link (link.label)}
							<a href={link.href}>{tt(link.label)}</a>
						{/each}
					</div>
				{/each}
			</div>
		</div>
		<p class="lpc-footer-fifa">{tt('footer.fifa')}</p>
		<p class="lpc-footer-disclosure">{tt('footer.disclosure')}</p>
	</div>
</footer>
