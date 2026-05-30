<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding · step tracker.
	 *
	 * Three progress dots plus the brand's own three-act arc as the
	 * step label — "Veni · 1 of 3", "Vidi · 2 of 3", "Vici · 3 of 3".
	 * The Latin words are brand-fixed and identical in every locale; only
	 * the " · N of 3" tail is localized.
	 *
	 * Shared across every onboarding beat (1.a / 1.b / 2 / 3) so the
	 * tracker renders once, consistently, instead of being inlined per
	 * beat. `step` is 1-based and maps to the active word + filled dots.
	 */
	interface Props {
		// 1-based step index (1, 2, or 3).
		step: 1 | 2 | 3;
	}

	const { step }: Props = $props();

	// Brand-fixed Latin arc — never translated.
	const STEP_WORDS = ['Veni', 'Vidi', 'Vici'] as const;

	const dots = [1, 2, 3] as const;
	const word = $derived(STEP_WORDS[step - 1]);
</script>

<div class="ob2-header">
	<span class="ob2-progress">
		{#each dots as n (n)}
			<span class="ob2-progress-dot" class:filled={n <= step}></span>
		{/each}
	</span>
	<span class="ob2-step-label">
		{word}
		{t({ locale: $localeStore, key: 'onboarding.step_of', params: { current: step, total: 3 } })}
	</span>
</div>
