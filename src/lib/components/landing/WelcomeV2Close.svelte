<script lang="ts">
	/**
	 * Closing section — the Latin motto, the closing headline, and the
	 * final sign-up CTA. The earned payoff of the page.
	 */
	import { ChevronRight } from '@lucide/svelte/icons';
	import { LATIN_MOTTO_LEAD, LATIN_MOTTO_TAIL } from '$lib/constants/brand.constants';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { splitHeadline } from '$lib/utils/landing-headline.utils';

	const tt = (key: MessageKey) => t({ locale: $localeStore, key });

	const headline = $derived(splitHeadline(tt('welcome.v2.close.headline')));
</script>

<section class="v2-section v2-close">
	<div class="v2-wrap">
		<div class="v2-close-latin">{LATIN_MOTTO_LEAD}<span class="acc">{LATIN_MOTTO_TAIL}</span></div>
		<h2 class="v2-h2">
			{headline.before}{#if headline.accent}<span class="acc">{headline.accent}</span
				>{/if}{headline.after}
		</h2>
		<div class="v2-close-cta">
			<a class="btn btn-primary btn-lg" href={PublicPath.SignUp}>
				{tt('welcome.v2.close.cta')}
				<ChevronRight size={16} strokeWidth={2.4} />
			</a>
		</div>
	</div>
</section>
