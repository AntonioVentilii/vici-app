<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		yesPercent: number;
		noPercent: number;
	}

	const { yesPercent, noPercent }: Props = $props();
</script>

<!-- Probability hero: large YES percent on the left baseline-aligned
     with the "YES" eyebrow, mirrored on the right with a smaller NO
     percent. Below sits the split bar (the page's `ProbBar` equivalent —
     same shape as `forecast-split-bar` on the old card). Port of
     `screens.jsx:226-238`. -->
<div class="prob-hero">
	<div class="prob-hero-row">
		<div class="prob-hero-side prob-hero-yes">
			<span class="num prob-hero-yes-pct">{yesPercent}%</span>
			<span class="prob-hero-eyebrow">{t({ locale: $localeStore, key: 'outcome.yes' })}</span>
		</div>
		<div class="prob-hero-side prob-hero-no">
			<span class="prob-hero-eyebrow">{t({ locale: $localeStore, key: 'outcome.no' })}</span>
			<span class="num prob-hero-no-pct">{noPercent}%</span>
		</div>
	</div>

	<div class="prob-hero-bar" role="presentation">
		<span style:width={`${yesPercent}%`} class="prob-hero-bar-yes"></span>
		<span style:width={`${noPercent}%`} class="prob-hero-bar-no"></span>
	</div>
</div>

<style lang="postcss">
	.prob-hero {
		padding: 1.25rem 1.25rem 0.75rem;
	}

	.prob-hero-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.prob-hero-side {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		min-width: 0;
	}

	.prob-hero-eyebrow {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.prob-hero-yes .prob-hero-eyebrow {
		color: var(--yes);
	}

	.prob-hero-no .prob-hero-eyebrow {
		color: var(--no);
	}

	.prob-hero-yes-pct {
		color: var(--yes);
		font-size: 3rem;
		font-weight: 600;
		letter-spacing: -0.04em;
		line-height: 1;
	}

	.prob-hero-no-pct {
		color: var(--no);
		font-size: var(--t-24);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		line-height: 1;
	}

	.prob-hero-bar {
		display: flex;
		height: 0.5rem;
		margin-top: 0.625rem;
		overflow: hidden;
		border-radius: var(--r-pill);
		background: var(--bg-surface);
	}

	.prob-hero-bar-yes,
	.prob-hero-bar-no {
		display: block;
		height: 100%;
		transition: width var(--d-enter) var(--ease-vici);
	}

	.prob-hero-bar-yes {
		background: linear-gradient(90deg, var(--yes-deep), var(--yes));
	}

	.prob-hero-bar-no {
		background: var(--no);
	}
</style>
