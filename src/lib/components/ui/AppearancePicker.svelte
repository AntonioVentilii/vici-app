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
			description: 'Ink',
			swatches: ['#0E0D0B', '#16140F', '#E2B842']
		},
		{
			id: 'light',
			label: 'Light',
			description: 'Parchment',
			swatches: ['#F2ECDC', '#FAF6EA', '#B68B1F']
		},
		{
			id: 'peach',
			label: 'Peach',
			description: 'Blush',
			swatches: ['#FAE0CC', '#FFEAD9', '#B68B1F']
		}
	] as const;

	const setTheme = (value: Theme) => {
		theme.set(value);
	};
</script>

<div class="appearance-picker" aria-label="Appearance" role="group">
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
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.375rem;
	}

	.appearance-option {
		position: relative;
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		width: 100%;
		padding: 0.55rem 0.4rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		color: var(--text-base);
		text-align: center;
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
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-surface));
		box-shadow: var(--shadow-card);
	}

	.appearance-swatches {
		display: flex;
		overflow: hidden;
		width: 100%;
		max-width: 3.5rem;
		height: 1.4rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
	}

	.appearance-swatches span {
		flex: 1;
	}

	.appearance-copy {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 0.1rem;
		font-size: var(--t-12);
		font-weight: 700;
		line-height: var(--leading-snug);
	}

	.appearance-copy small {
		color: var(--text-muted);
		font-size: 0.625rem;
		line-height: var(--leading-snug);
	}

	.appearance-check {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		display: inline-flex;
		color: var(--color-primary);
	}
</style>
