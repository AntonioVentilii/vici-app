<script lang="ts">
	import { ChevronDown } from 'lucide-svelte/icons';
	import LandingSectionHeader from '$lib/components/landing/LandingSectionHeader.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Six visitor-stage questions. Uses native `<details>` / `<summary>`
	 * for built-in accessibility + zero-JS expand behaviour. First item
	 * opens by default so the section reads as content rather than a
	 * closed list.
	 */
	const FAQ_ITEM_KEYS = [
		{ q: 'welcome.faq.q1', a: 'welcome.faq.a1' },
		{ q: 'welcome.faq.q2', a: 'welcome.faq.a2' },
		{ q: 'welcome.faq.q3', a: 'welcome.faq.a3' },
		{ q: 'welcome.faq.q4', a: 'welcome.faq.a4' },
		{ q: 'welcome.faq.q5', a: 'welcome.faq.a5' },
		{ q: 'welcome.faq.q6', a: 'welcome.faq.a6' }
	] as const;

	const SUPPORT_EMAIL = 'support@vici.markets';
</script>

<div class="welcome-faq-inner">
	<LandingSectionHeader
		eyebrow={t({ locale: $localeStore, key: 'welcome.faq.eyebrow' })}
		sub={t({ locale: $localeStore, key: 'welcome.faq.sub' })}
		title={t({ locale: $localeStore, key: 'welcome.faq.title_a' })}
		titleAccent={t({ locale: $localeStore, key: 'welcome.faq.title_b' })}
	/>

	<div class="welcome-faq-list">
		{#each FAQ_ITEM_KEYS as item, idx (item.q)}
			<details class="welcome-faq-item" open={idx === 0}>
				<summary class="welcome-faq-q">
					<span class="welcome-faq-q-text">
						{t({ locale: $localeStore, key: item.q })}
					</span>
					<span class="welcome-faq-q-chev" aria-hidden="true">
						<ChevronDown size={18} strokeWidth={1.8} />
					</span>
				</summary>
				<div class="welcome-faq-a">
					{t({ locale: $localeStore, key: item.a })}
				</div>
			</details>
		{/each}
	</div>

	<p class="welcome-faq-contact">
		{t({ locale: $localeStore, key: 'welcome.faq.contact_prefix' })}
		<a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
		{t({ locale: $localeStore, key: 'welcome.faq.contact_suffix' })}
	</p>
</div>

<style lang="postcss">
	.welcome-faq-inner {
		max-width: 80rem;
		margin: 0 auto;
	}

	.welcome-faq-list {
		display: flex;
		flex-direction: column;
		margin-top: 3rem;
		max-width: 47.5rem;
		margin-left: auto;
		margin-right: auto;
		border-top: 1px solid var(--border);
	}

	.welcome-faq-item {
		border-bottom: 1px solid var(--border);
	}

	.welcome-faq-q {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem 0.25rem;
		cursor: pointer;
		color: var(--foreground);
		font-size: var(--t-18);
		font-weight: 600;
		line-height: 1.3;
		list-style: none;
	}

	.welcome-faq-q::-webkit-details-marker {
		display: none;
	}

	.welcome-faq-item[open] .welcome-faq-q {
		color: var(--color-accent);
	}

	.welcome-faq-q-text {
		text-wrap: balance;
	}

	.welcome-faq-q-chev {
		flex-shrink: 0;
		display: inline-flex;
		color: var(--muted-foreground);
		transition: transform 200ms cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.welcome-faq-item[open] .welcome-faq-q-chev {
		transform: rotate(180deg);
	}

	.welcome-faq-a {
		padding: 0 0.25rem 1.4rem;
		line-height: 1.6;
		max-width: 64ch;
		color: var(--muted-foreground);
		text-wrap: pretty;
	}

	.welcome-faq-contact {
		margin: 1.75rem auto 0;
		max-width: 32.5rem;
		text-align: center;
		font-size: var(--t-13);
		color: var(--muted-foreground);
	}

	.welcome-faq-contact a {
		color: var(--color-accent);
		font-weight: 600;
	}
</style>
