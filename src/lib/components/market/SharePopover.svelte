<script lang="ts">
	import { browser } from '$app/environment';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	/**
	 * SharePopover — capability-aware share menu anchored above the
	 * card. On mobile the native share sheet is the primary CTA; on
	 * desktop the channel grid (WhatsApp / Telegram / X / Email /
	 * Reddit / LinkedIn / Copy link) takes its place. A live preview
	 * shows exactly the text + URL that goes out. Footer surfaces the
	 * 500-VXP referral incentive.
	 *
	 * Prototype source: `VICI WebApp Beta V1.2/flow.jsx:228-361`.
	 */
	interface PriorCallLite {
		side: 'YES' | 'NO';
	}

	interface Props {
		market: Market;
		priorCall?: PriorCallLite | null;
		onClose?: () => void;
		onCopied?: () => void;
	}

	const { market, priorCall = null, onClose, onCopied }: Props = $props();

	const yesPct = $derived(Math.round((market.yesProbability ?? 0.5) * 100));

	const inviterHandle = $derived(
		($userStore.profile?.nickname ?? 'predictor').replace(/[^a-z0-9]/gi, '') || 'predictor'
	);
	const url = $derived(`https://vici.markets/m/${market.id}?ref=${inviterHandle}`);
	const text = $derived(
		priorCall !== null && priorCall !== undefined
			? t({
					locale: $localeStore,
					key: 'flow.share.text_post',
					params: { side: priorCall.side, title: market.title }
				})
			: t({
					locale: $localeStore,
					key: 'flow.share.text_pre',
					params: { title: market.title, yes: yesPct }
				})
	);

	// Native share sheet detection — Safari (iOS) and Chrome (Android)
	// expose `navigator.share`. Desktop browsers don't, so we fall back
	// to the expanded channel grid.
	const hasNativeShare = $derived(
		browser && typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	);

	interface Channel {
		key: string;
		labelKey: MessageKey;
		tint: string;
		href: string;
		desktopOnly?: boolean;
	}

	const enc = encodeURIComponent;

	const channels = $derived<Channel[]>([
		{
			key: 'whatsapp',
			labelKey: 'flow.share.whatsapp',
			tint: '#25D366',
			href: `https://wa.me/?text=${enc(`${text} ${url}`)}`
		},
		{
			key: 'telegram',
			labelKey: 'flow.share.telegram',
			tint: '#229ED9',
			href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`
		},
		{
			key: 'twitter',
			labelKey: 'flow.share.twitter',
			tint: 'var(--fg)',
			href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`
		},
		{
			key: 'email',
			labelKey: 'flow.share.email',
			tint: '#A9A39A',
			href: `mailto:?subject=${enc(t({ locale: $localeStore, key: 'flow.share.email_subject' }))}&body=${enc(`${text}\n\n${url}`)}`,
			desktopOnly: true
		},
		{
			key: 'reddit',
			labelKey: 'flow.share.reddit',
			tint: '#FF4500',
			href: `https://reddit.com/submit?url=${enc(url)}&title=${enc(market.title)}`,
			desktopOnly: true
		},
		{
			key: 'linkedin',
			labelKey: 'flow.share.linkedin',
			tint: '#0A66C2',
			href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
			desktopOnly: true
		}
	]);

	const visible = $derived(channels.filter((c) => !c.desktopOnly || !hasNativeShare));

	const copyLink = async () => {
		if (!browser) {
			onClose?.();

			return;
		}

		try {
			if (navigator.clipboard?.writeText !== undefined) {
				await navigator.clipboard.writeText(url);
			} else {
				const ta = document.createElement('textarea');
				ta.value = url;
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
			}

			onCopied?.();
		} catch {
			onCopied?.();
		}

		onClose?.();
	};

	const triggerNative = async () => {
		if (!browser) {
			return;
		}

		try {
			await navigator.share({ title: 'VICI', text, url });
			onClose?.();
		} catch (e) {
			// User-cancelled native share sheets reject with AbortError —
			// silent close. Other errors also close (the popover is the
			// fallback channel grid for next attempt).
			if (e instanceof DOMException && e.name === 'AbortError') {
				return;
			}

			onClose?.();
		}
	};

	const stop = (event: MouseEvent) => {
		event.stopPropagation();
	};
</script>

<!-- eslint-disable-next-line svelte/valid-compile -- the click is intentional;
     bubble-stop keeps an outer dismiss-on-click handler from firing. -->
<div class="share-pop" onclick={stop} role="dialog">
	<span class="eyebrow share-pop-eyebrow">
		{t({ locale: $localeStore, key: 'flow.share.eyebrow' })}
	</span>

	<!-- Live message preview — exactly what gets sent. -->
	<div class="share-pop-preview">
		<p class="share-preview-text">{text}</p>
		<span class="share-preview-url">{url}</span>
	</div>

	{#if hasNativeShare}
		<button class="share-native-btn" onclick={triggerNative} type="button">
			<span class="share-native-icon" aria-hidden="true">↑</span>
			{t({ locale: $localeStore, key: 'flow.share.native_cta' })}
		</button>

		<div class="share-or">
			<span>{t({ locale: $localeStore, key: 'flow.share.or_direct' })}</span>
		</div>
	{/if}

	<div class="share-pop-grid" class:compact={hasNativeShare} class:expanded={!hasNativeShare}>
		{#each visible as channel (channel.key)}
			<a
				class="share-chan"
				href={channel.href}
				onclick={() => onClose?.()}
				rel="noopener noreferrer"
				target="_blank"
			>
				<span style:color={channel.tint} class="share-chan-icon">
					{#if channel.key === 'whatsapp'}
						<svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
							<path
								d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.2-.5-2.3-1.4-.9-.7-1.5-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 .9-1 2.3 0 1.4 1 2.7 1.2 2.9.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4 0-.1-.3-.2-.6-.4z M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2z"
							/>
						</svg>
					{:else if channel.key === 'telegram'}
						<svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
							<path d="M22 4 2 11.5l5.5 2 1.5 6 3-3 5 4 5-16.5z M9.5 14 18 7l-7 7.5z" />
						</svg>
					{:else if channel.key === 'twitter'}
						<svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 24 24" width="16">
							<path
								d="M18.244 2H21l-6.52 7.45L22.5 22h-6.97l-5.46-7.13L3.6 22H.84l7-7.99L0 2h7.13l4.93 6.52L18.244 2z"
							/>
						</svg>
					{:else if channel.key === 'email'}
						<svg
							aria-hidden="true"
							fill="none"
							height="18"
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							viewBox="0 0 24 24"
							width="18"
						>
							<rect height="14" rx="2" width="18" x="3" y="5" />
							<path d="M3 7l9 6 9-6" />
						</svg>
					{:else if channel.key === 'reddit'}
						<svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
							<circle cx="12" cy="12" r="10" />
							<circle cx="8" cy="11.5" fill="var(--bg-elevated)" r="1.4" />
							<circle cx="16" cy="11.5" fill="var(--bg-elevated)" r="1.4" />
							<path
								d="M8 15c1.2 1 2.5 1.5 4 1.5s2.8-.5 4-1.5"
								fill="none"
								stroke="var(--bg-elevated)"
								stroke-linecap="round"
								stroke-width="1.5"
							/>
						</svg>
					{:else if channel.key === 'linkedin'}
						<svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 24 24" width="16">
							<path
								d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 1 1 8.25 6.5 1.75 1.75 0 0 1 6.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0 0 13 14.19a.66.66 0 0 0 0 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.36.86 3.36 3.66z"
							/>
						</svg>
					{/if}
				</span>
				<span class="share-chan-label">
					{t({ locale: $localeStore, key: channel.labelKey })}
				</span>
			</a>
		{/each}
		<button class="share-chan" onclick={copyLink} type="button">
			<span style:color="var(--accent)" class="share-chan-icon">
				<svg
					aria-hidden="true"
					fill="none"
					height="16"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					width="16"
				>
					<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
					<path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
				</svg>
			</span>
			<span class="share-chan-label">
				{t({ locale: $localeStore, key: 'flow.share.copy_link' })}
			</span>
		</button>
	</div>

	<div class="share-pop-referral">
		<span class="share-referral-icon" aria-hidden="true">✦</span>
		<span>
			<b>{t({ locale: $localeStore, key: 'flow.share.referral_amount' })}</b>
			{t({ locale: $localeStore, key: 'flow.share.referral_tail' })}
		</span>
	</div>
</div>
