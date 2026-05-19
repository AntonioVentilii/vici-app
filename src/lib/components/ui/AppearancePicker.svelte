<script lang="ts">
	import { Check } from 'lucide-svelte/icons';
	import { theme, type Theme } from '$lib/stores/theme.store';

	interface ThemeOption {
		id: Theme;
		label: string;
		description: string;
		swatches: readonly string[];
	}

	const options: readonly ThemeOption[] = [
		{
			id: 'dark',
			label: 'Dark',
			description: 'Trading floor at 2am.',
			swatches: ['#0E0D0B', '#16140F', '#E2B842']
		},
		{
			id: 'light',
			label: 'Light',
			description: 'Parchment, ink, daylight.',
			swatches: ['#F2ECDC', '#FAF6EA', '#B68B1F']
		},
		{
			id: 'peach',
			label: 'Peach',
			description: 'Warm blush, deeper laurel.',
			swatches: ['#FAE0CC', '#FFEAD9', '#B68B1F']
		}
	] as const;

	const setTheme = (value: Theme) => {
		theme.set(value);
	};
</script>

<div class="appearance-picker" aria-label="Appearance">
	{#each options as option (option.id)}
		<button
			class="appearance-option"
			class:is-active={$theme === option.id}
			aria-pressed={$theme === option.id}
			onclick={() => setTheme(option.id)}
			type="button"
		>
			<span class="appearance-swatches" aria-hidden="true">
				{#each option.swatches as colour (colour)}
					<span style:background={colour}></span>
				{/each}
			</span>
			<span class="appearance-copy">
				<span>{option.label}</span>
				<small>{option.description}</small>
			</span>
			{#if $theme === option.id}
				<span class="appearance-check">
					<Check size={16} strokeWidth={2.4} />
				</span>
			{/if}
		</button>
	{/each}
</div>

<style lang="postcss">
	.appearance-picker {
		display: grid;
		gap: 0.5rem;
	}

	.appearance-option {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.625rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici),
			transform var(--d-hover) var(--ease-vici);
	}

	.appearance-option:hover {
		border-color: var(--border-strong);
		background: var(--bg-popover);
	}

	.appearance-option:active {
		transform: scale(0.985);
	}

	.appearance-option.is-active {
		border-color: var(--laurel-deep);
		box-shadow: 0 0 0 1px var(--laurel-glow);
	}

	.appearance-swatches {
		display: flex;
		overflow: hidden;
		width: 2.75rem;
		height: 1.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-4);
	}

	.appearance-swatches span {
		flex: 1;
	}

	.appearance-copy {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 0.1rem;
		font-weight: 600;
	}

	.appearance-copy small {
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: var(--leading-snug);
	}

	.appearance-check {
		display: inline-flex;
		color: var(--laurel-deep);
	}
</style>
