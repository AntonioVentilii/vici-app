<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	const resolutionCondition = $derived(market.description?.trim() ?? '');
	let rulesOpen = $state(false);
</script>

{#if resolutionCondition.length > 0}
	<section class="flow-back-block flow-resolution">
		<p class="eyebrow flow-back-label">
			{t({ locale: $localeStore, key: 'card.back.resolves_if' })}
		</p>
		<p class="flow-back-copy">{resolutionCondition}</p>
		<div class="flow-res-foot">
			<span class="flow-res-source">
				{t({ locale: $localeStore, key: 'card.back.source_official' })}
			</span>
			<button
				class="flow-back-toggle"
				aria-expanded={rulesOpen}
				data-no-card-gesture="true"
				onclick={(e) => {
					e.stopPropagation();
					rulesOpen = !rulesOpen;
				}}
				type="button"
			>
				{rulesOpen
					? t({ locale: $localeStore, key: 'card.back.hide_rules' })
					: t({ locale: $localeStore, key: 'card.back.show_rules' })}
				<span class="flow-back-toggle-caret" class:is-open={rulesOpen} aria-hidden="true"> ▾ </span>
			</button>
		</div>
		{#if rulesOpen}
			<p class="flow-back-rules">
				{t({ locale: $localeStore, key: 'card.back.rules_body' })}
			</p>
		{/if}
	</section>
{/if}

<style lang="postcss">
	/* Shared block wrapper + section surface — duplicated here so the
	   extracted section keeps its spacing + surface under Svelte's
	   per-component style scoping. */
	.flow-back-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.flow-resolution {
		padding: 0.75rem 0.85rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		box-shadow: var(--inset-hi);
	}

	.flow-back-label {
		margin: 0;
		color: var(--text-muted);
	}

	.flow-back-copy,
	.flow-back-rules {
		margin: 0;
		font-size: var(--t-13);
		line-height: var(--leading-normal);
		color: var(--text-base);
	}
	.flow-back-rules {
		color: var(--text-muted);
		padding-top: 0.4rem;
		border-top: 1px dashed var(--border-base);
		margin-top: 0.4rem;
		animation: flowRulesReveal 220ms var(--ease-vici) both;
	}
	@keyframes flowRulesReveal {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.flow-back-rules {
			animation: none;
		}
	}

	/* Stacked footer — source line sits above the rules toggle, matching
	   the prototype (was a single space-between row). */
	.flow-res-foot {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
		margin-top: 0.35rem;
	}
	.flow-res-source {
		font-size: var(--t-12);
		color: var(--text-muted);
		opacity: 0.85;
	}

	.flow-back-toggle {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: none;
		background: none;
		padding: 0;
		font-size: var(--t-12);
		color: var(--laurel);
		cursor: pointer;
		text-decoration: none;
	}
	.flow-back-toggle-caret {
		font-size: var(--t-11);
		transition: transform 200ms ease;
	}
	.flow-back-toggle-caret.is-open {
		transform: rotate(180deg);
	}
</style>
