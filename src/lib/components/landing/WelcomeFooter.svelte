<script lang="ts">
	/**
	 * Verbatim port of the prototype's `Footer`
	 * (`landing.jsx:1356-1394`). Wordmark + tagline + three columns
	 * (Product / Help / Legal) + disclosure line.
	 */
	import Logo from '$lib/components/layout/Logo.svelte';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
</script>

<footer class="lp-footer lp-root">
	<div class="lp-section-inner">
		<div style="flex-wrap:wrap; gap:24px;" class="row between">
			<div style="gap:10px; max-width:300px;" class="col">
				<Logo href={PublicPath.Welcome} />
				<p class="dim t-body">{t({ locale: $localeStore, key: 'footer.tagline' })}</p>
			</div>
			<div class="lp-footer-links">
				<div>
					<div class="eyebrow mute">{t({ locale: $localeStore, key: 'footer.product' })}</div>
					<a href={PublicPath.SignIn}>{t({ locale: $localeStore, key: 'footer.app' })}</a>
					<a href={PublicPath.SignIn}>{t({ locale: $localeStore, key: 'footer.signin' })}</a>
				</div>
				<div>
					<div class="eyebrow mute">{t({ locale: $localeStore, key: 'footer.help' })}</div>
					<a href="#faq">{t({ locale: $localeStore, key: 'footer.faq' })}</a>
					<a href="mailto:support@vici.markets">
						{t({ locale: $localeStore, key: 'footer.contact' })}
					</a>
				</div>
				<div>
					<div class="eyebrow mute">{t({ locale: $localeStore, key: 'footer.legal' })}</div>
					<a href="{PublicPath.Info}/terms">{t({ locale: $localeStore, key: 'footer.terms' })}</a>
					<a href="{PublicPath.Info}/privacy">
						{t({ locale: $localeStore, key: 'footer.privacy' })}
					</a>
					<a href="{PublicPath.Info}/resolution-rules">
						{t({ locale: $localeStore, key: 'footer.rules' })}
					</a>
				</div>
			</div>
		</div>
		<p class="dim lp-footer-disclosure">
			{t({ locale: $localeStore, key: 'footer.disclosure' })}
		</p>
	</div>
</footer>
