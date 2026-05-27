<script lang="ts">
	/**
	 * Verbatim port of the prototype's `Loop`
	 * (`landing.jsx:1192-1221`). Three cards (Flow / Market /
	 * Portfolio) connected by arrows + return-arc SVG at the bottom.
	 */
	import { Wallet, Zap, TrendingUp } from 'lucide-svelte/icons';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface LoopCard {
		eyebrow: MessageKey;
		name: MessageKey;
		italic: MessageKey;
		body: MessageKey;
		Icon: typeof Zap;
	}

	const cards: readonly LoopCard[] = [
		{
			eyebrow: 'loop.flow_eyebrow',
			name: 'loop.flow_name',
			italic: 'loop.flow_italic',
			body: 'loop.flow_body',
			Icon: Zap
		},
		{
			eyebrow: 'loop.market_eyebrow',
			name: 'loop.market_name',
			italic: 'loop.market_italic',
			body: 'loop.market_body',
			Icon: TrendingUp
		},
		{
			eyebrow: 'loop.port_eyebrow',
			name: 'loop.port_name',
			italic: 'loop.port_italic',
			body: 'loop.port_body',
			Icon: Wallet
		}
	];
</script>

<section class="lp-section lp-root">
	<div class="lp-section-inner">
		<div style="gap:14px; max-width:680px;" class="col">
			<span class="eyebrow acc">{t({ locale: $localeStore, key: 'loop.eyebrow' })}</span>
			<h2 class="lp-h2">
				{t({ locale: $localeStore, key: 'loop.title_a' })}
				<span class="serif-italic acc">
					{t({ locale: $localeStore, key: 'loop.title_b' })}
				</span>
			</h2>
			<p style="color:var(--fg-dim);" class="lp-lede">
				{t({ locale: $localeStore, key: 'loop.sub' })}
			</p>
		</div>

		<div class="lp-loop-grid">
			{#each cards as s, i (s.name)}
				{@const { Icon } = s}
				<div class="card-elevated lp-loop-card">
					{#if i < 2}
						<div class="lp-loop-arrow" aria-hidden="true">→</div>
					{/if}
					<Icon style="color: var(--accent);" size={26} strokeWidth={1.5} />
					<div style="margin-top:24px;" class="eyebrow mute">
						{t({ locale: $localeStore, key: s.eyebrow })}
					</div>
					<h3 style="margin-top:8px;" class="lp-h3">
						<span style="display:block;">{t({ locale: $localeStore, key: s.name })}</span>
						<span
							style="font-weight:400; font-size:0.86em; display:block; margin-top:4px;"
							class="serif-italic acc"
						>
							{t({ locale: $localeStore, key: s.italic })}
						</span>
					</h3>
					<p style="margin-top:12px; line-height:1.55;" class="dim t-body">
						{t({ locale: $localeStore, key: s.body })}
					</p>
				</div>
			{/each}

			<div class="lp-loop-return" aria-hidden="true">
				<svg preserveAspectRatio="none" viewBox="0 0 1000 60">
					<path
						d="M 980 5 Q 980 50 500 50 Q 20 50 20 5"
						fill="none"
						opacity="0.45"
						stroke="var(--accent)"
						stroke-dasharray="2 6"
						stroke-width="1"
					/>
					<path
						d="M 28 5 l -8 -4 m 8 4 l -8 4"
						fill="none"
						opacity="0.7"
						stroke="var(--accent)"
						stroke-width="1"
					/>
				</svg>
			</div>
		</div>
	</div>
</section>
