<script lang="ts">
	import { ArrowRight, Target, Wallet, Zap } from 'lucide-svelte/icons';
	import LandingSectionHeader from '$lib/components/landing/LandingSectionHeader.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	const LOOP_CARDS = [
		{
			id: 'flow',
			eyebrowKey: 'loop.flow_eyebrow',
			nameKey: 'loop.flow_name',
			italicKey: 'loop.flow_italic',
			bodyKey: 'loop.flow_body'
		},
		{
			id: 'market',
			eyebrowKey: 'loop.market_eyebrow',
			nameKey: 'loop.market_name',
			italicKey: 'loop.market_italic',
			bodyKey: 'loop.market_body'
		},
		{
			id: 'portfolio',
			eyebrowKey: 'loop.port_eyebrow',
			nameKey: 'loop.port_name',
			italicKey: 'loop.port_italic',
			bodyKey: 'loop.port_body'
		}
	] as const satisfies readonly {
		id: 'flow' | 'market' | 'portfolio';
		eyebrowKey: MessageKey;
		nameKey: MessageKey;
		italicKey: MessageKey;
		bodyKey: MessageKey;
	}[];
</script>

<div class="welcome-section-inner">
	<LandingSectionHeader
		eyebrow={t({ locale: $localeStore, key: 'loop.eyebrow' })}
		sub={t({ locale: $localeStore, key: 'loop.sub' })}
		title={t({ locale: $localeStore, key: 'loop.title_a' })}
		titleAccent={t({ locale: $localeStore, key: 'loop.title_b' })}
	/>

	<div class="welcome-loop-grid">
		{#each LOOP_CARDS as card, index (card.id)}
			<article class="welcome-loop-card">
				{#if index < LOOP_CARDS.length - 1}
					<span class="welcome-loop-arrow" aria-hidden="true">
						<ArrowRight aria-hidden="true" size={18} strokeWidth={1.8} />
					</span>
				{/if}

				<div class="welcome-loop-icon" aria-hidden="true">
					{#if card.id === 'flow'}
						<Zap aria-hidden="true" size={26} strokeWidth={1.5} />
					{:else if card.id === 'market'}
						<Target aria-hidden="true" size={26} strokeWidth={1.5} />
					{:else}
						<Wallet aria-hidden="true" size={26} strokeWidth={1.5} />
					{/if}
				</div>

				<p class="eyebrow welcome-loop-eyebrow">
					{t({ locale: $localeStore, key: card.eyebrowKey })}
				</p>

				<h3 class="welcome-loop-title">
					<span>{t({ locale: $localeStore, key: card.nameKey })}</span>
					<span class="serif-italic acc">{t({ locale: $localeStore, key: card.italicKey })}</span>
				</h3>

				<p class="welcome-loop-body">
					{t({ locale: $localeStore, key: card.bodyKey })}
				</p>
			</article>
		{/each}

		<div class="welcome-loop-return" aria-hidden="true">
			<svg preserveAspectRatio="none" viewBox="0 0 1000 60">
				<path
					d="M 980 5 Q 980 50 500 50 Q 20 50 20 5"
					fill="none"
					stroke="currentColor"
					stroke-dasharray="2 6"
					stroke-width="1"
				/>
				<path d="M 28 5 l -8 -4 m 8 4 l -8 4" fill="none" stroke="currentColor" stroke-width="1" />
			</svg>
		</div>
	</div>
</div>

<style lang="postcss">
	.welcome-section-inner {
		max-width: 80rem;
		margin: 0 auto;
	}

	.welcome-loop-grid {
		position: relative;
		display: grid;
		gap: 2.75rem;
		margin-top: 3.5rem;
	}

	.welcome-loop-card {
		position: relative;
		display: flex;
		min-height: 13.75rem;
		flex-direction: column;
		padding: clamp(1.35rem, 3vw, 1.75rem);
		border: 1px solid var(--border);
		border-radius: 18px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--foreground) 3%, transparent),
				transparent 52%
			),
			var(--card);
		box-shadow:
			var(--shadow-card),
			inset 0 1px 0 color-mix(in srgb, var(--background) 65%, transparent);
	}

	.welcome-loop-icon {
		display: inline-flex;
		width: fit-content;
		color: var(--laurel);
	}

	.welcome-loop-eyebrow {
		margin: 1.5rem 0 0;
		color: var(--muted-foreground);
	}

	.welcome-loop-title {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0.5rem 0 0;
		color: var(--foreground);
		font-size: clamp(1.35rem, 3vw, 1.625rem);
		font-weight: 700;
		line-height: 1.12;
		letter-spacing: -0.02em;
	}

	.welcome-loop-title .serif-italic {
		font-size: 0.86em;
		font-weight: 400;
		letter-spacing: 0;
	}

	.welcome-loop-body {
		margin: 0.75rem 0 0;
		color: var(--muted-foreground);
		font-size: var(--t-14);
		line-height: 1.55;
	}

	.welcome-loop-arrow {
		position: absolute;
		right: 50%;
		bottom: -2.5rem;
		z-index: 5;
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--background);
		color: var(--laurel);
		opacity: 0.78;
		transform: translateX(50%) rotate(90deg);
	}

	.welcome-loop-return {
		display: none;
	}

	@media (min-width: 61.25rem) {
		.welcome-loop-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 0.875rem;
			padding-bottom: 3.5rem;
		}

		.welcome-loop-arrow {
			top: 50%;
			right: -1.5625rem;
			bottom: auto;
			transform: translateY(-50%);
		}

		.welcome-loop-return {
			position: absolute;
			right: 0;
			bottom: 0.25rem;
			left: 0;
			display: block;
			height: 2.25rem;
			color: color-mix(in srgb, var(--laurel) 62%, transparent);
			pointer-events: none;
		}

		.welcome-loop-return svg {
			width: 100%;
			height: 100%;
		}
	}
</style>
