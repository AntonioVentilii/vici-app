<script lang="ts">
	import { Share2 } from 'lucide-svelte/icons';
	import { browser } from '$app/environment';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		title: string;
	}

	const { title }: Props = $props();

	const share = async () => {
		if (!browser) {
			return;
		}

		const url = window.location.href;

		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({ title, url });

				return;
			}

			if (navigator.clipboard !== undefined) {
				await navigator.clipboard.writeText(url);
				notificationsStore.add({
					title: t({ locale: $localeStore, key: 'market.detail.share.copied_title' }),
					message: t({ locale: $localeStore, key: 'market.detail.share.copied' }),
					type: 'success'
				});
			}
		} catch (err) {
			// User-cancelled native share sheets reject — treat as silent no-op.
			if (err instanceof DOMException && err.name === 'AbortError') {
				return;
			}

			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'market.detail.share.failed_title' }),
				message: t({ locale: $localeStore, key: 'market.detail.share.failed' }),
				type: 'error'
			});
		}
	};
</script>

<!-- Share button on the Market detail appbar — prefers the native Web
     Share sheet (mobile), falls back to clipboard copy on desktop with a
     toast acknowledgement. Visually mirrors the prototype's ghost icon
     button next to the back chevron. -->
<button
	class="market-detail-share"
	aria-label={t({ locale: $localeStore, key: 'market.detail.share.label' })}
	onclick={share}
	type="button"
>
	<Share2 aria-hidden="true" size={16} strokeWidth={1.8} />
</button>

<style lang="postcss">
	.market-detail-share {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.market-detail-share:hover {
		border-color: var(--border-strong);
		background: var(--bg-popover);
		color: var(--text-base);
	}
</style>
