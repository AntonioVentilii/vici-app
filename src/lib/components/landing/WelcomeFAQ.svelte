<script lang="ts">
	/**
	 * Six visitor-stage questions in an "only one open at a time"
	 * accordion, with the first question expanded by default. Uses
	 * local `$state` rather than native <details>/<summary> so we
	 * keep the single-expanded invariant.
	 */
	import { ChevronDown } from 'lucide-svelte/icons';

	interface FaqItem {
		q: string;
		a: string;
	}

	const FAQ_ITEMS: readonly FaqItem[] = [
		{
			q: 'Is VICI free?',
			a: 'Yes. The game mode is fully free — no card, no deposit, no subscription. VXP is a pure gameplay currency that tracks accuracy; it can’t be redeemed and isn’t money. Real-money markets, when introduced, will be optional and clearly labelled.'
		},
		{
			q: 'What can I predict on?',
			a: 'Hundreds of questions across macro, crypto, politics, tech, sports, and culture. Plus live tournament markets — the 2026 World Cup runs through July with per-team advancement, knockout, and final-winner markets. Every question resolves on a public source.'
		},
		{
			q: 'How is my accuracy ranked?',
			a: 'Resolved calls divided by total resolved calls. Open calls don’t count until a market settles. Accuracy is the unit of your reputation — across the global leaderboard, your private league, and any bouts you opt into.'
		},
		{
			q: 'Do you make money from my predictions?',
			a: 'Not in the game mode. VICI is free to use. The platform earns from real-money markets (when introduced), league sponsorships, and tournament partnerships. Your accuracy data is yours — we don’t sell it.'
		},
		{
			q: 'Where does my data live?',
			a: 'Servers in the European Union. Encrypted at rest and in transit. We store a session token; we don’t use tracking cookies. You can export or delete your data at any time — see the privacy policy for details.'
		},
		{
			q: 'What’s a bout?',
			a: 'A timed accuracy face-off between two leagues, or between universities in a tournament. Seven-day window, both sides need a minimum number of calls to qualify, the league with the higher average accuracy wins. The current Worlds Universities bout runs through the World Cup final.'
		}
	];

	let openIdx = $state(0);
</script>

<section id="faq" class="lp-section lp-root">
	<div class="lp-section-inner">
		<div style="gap:14px; max-width:680px;" class="col">
			<span class="eyebrow acc">FAQ</span>
			<h2 class="lp-h2">
				Questions <span class="serif-italic acc">worth asking.</span>
			</h2>
			<p style="color:var(--fg-dim);" class="lp-lede">
				What every new caller asks before their first prediction.
			</p>
		</div>

		<div
			style="
				margin-top:48px; max-width:760px; margin-left:auto; margin-right:auto;
				display:flex; flex-direction:column; gap:2px;
			"
		>
			{#each FAQ_ITEMS as item, i (item.q)}
				{@const isOpen = openIdx === i}
				<div
					style="
						border-bottom:1px solid var(--border);
						border-top:{i === 0 ? '1px solid var(--border)' : 'none'};
					"
				>
					<button
						style="
							appearance:none; background:transparent; border:0;
							width:100%; padding:20px 4px; text-align:left; cursor:pointer;
							display:flex; align-items:center; justify-content:space-between; gap:16px;
							color:var(--fg); font:inherit;
						"
						class="lp-faq-q"
						aria-expanded={isOpen}
						onclick={() => (openIdx = isOpen ? -1 : i)}
						type="button"
					>
						<span
							style="color:{isOpen ? 'var(--accent)' : 'var(--fg)'}; line-height:1.3;"
							class="t-h4 fw-600"
						>
							{item.q}
						</span>
						<span
							style="
								flex-shrink:0;
								transition:transform var(--d-state) var(--ease);
								transform:{isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
								color:var(--fg-mute); display:inline-flex;
							"
							aria-hidden="true"
						>
							<ChevronDown size={18} strokeWidth={1.8} />
						</span>
					</button>
					{#if isOpen}
						<div
							style="padding:0 4px 22px; line-height:1.6; max-width:64ch; text-wrap:pretty;"
							class="dim t-body"
						>
							{item.a}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<p
			style="margin-top:28px; text-align:center; max-width:520px; margin-left:auto; margin-right:auto;"
			class="dim t-body-sm"
		>
			More questions? Write to <a
				style="color:var(--accent); font-weight:600;"
				href="mailto:support@vici.markets">support@vici.markets</a
			> — we answer within two business days.
		</p>
	</div>
</section>
