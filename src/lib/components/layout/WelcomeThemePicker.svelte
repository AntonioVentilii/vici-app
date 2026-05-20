<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { theme, type Theme } from '$lib/stores/theme.store';
	import { t } from '$lib/utils/i18n.utils';

	const options: readonly { id: Theme; label: string; bg: string; dot: string }[] = [
		{ id: 'dark', label: 'Dark', bg: '#0E0D0B', dot: '#F2ECDC' },
		{ id: 'light', label: 'Light', bg: '#F2ECDC', dot: '#0E0D0B' },
		{ id: 'peach', label: 'Peach', bg: '#FAE0CC', dot: '#3D2419' }
	] as const;
</script>

<div
	class="welcome-theme-picker"
	aria-label={t({ locale: $localeStore, key: 'a11y.appearance' })}
	role="radiogroup"
>
	{#each options as option (option.id)}
		<button
			style={`--swatch-bg: ${option.bg}; --swatch-dot: ${option.dot}`}
			class="welcome-theme-dot"
			class:active={$theme === option.id}
			aria-checked={$theme === option.id}
			aria-label={option.label}
			onclick={() => theme.set(option.id)}
			role="radio"
			title={option.label}
			type="button"
		>
			<span class="welcome-theme-dot-inner"></span>
		</button>
	{/each}
</div>

<style lang="postcss">
	.welcome-theme-picker {
		display: inline-flex;
		gap: 0.35rem;
	}

	.welcome-theme-dot {
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border-radius: 999px;
		border: 2px solid transparent;
		background: var(--swatch-bg);
		cursor: pointer;
		transition: border-color 200ms var(--ease-vici);
	}

	.welcome-theme-dot.active {
		border-color: var(--primary);
	}

	.welcome-theme-dot-inner {
		display: block;
		width: 0.4rem;
		height: 0.4rem;
		margin: 0.4rem auto;
		border-radius: 999px;
		background: var(--swatch-dot);
	}
</style>
