<script lang="ts">
	/**
	 * Condensed trust band — a single reassuring one-liner with a seal
	 * icon. Sits between the proof band and the closing section.
	 */
	import { ShieldCheck } from '@lucide/svelte/icons';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
</script>

<section id="trust" class="v2-trust">
	<div class="v2-wrap v2-trust-inner">
		<span class="seal"><ShieldCheck size={16} strokeWidth={1.8} /></span>
		<span class="txt">{t({ locale: $localeStore, key: 'welcome.v2.trust.band' })}</span>
	</div>
</section>
