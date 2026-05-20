<script lang="ts">
	import type { Icon as LucideIcon } from 'lucide-svelte';

	interface Props {
		label: string;
		sub?: string;
		icon?: typeof LucideIcon;
		checked: boolean;
		onchange: (value: boolean) => void;
	}

	const {
		label,
		sub = undefined,
		icon: IconComponent = undefined,
		checked,
		onchange
	}: Props = $props();

	const toggle = () => onchange(!checked);
</script>

<div class="set-toggle">
	{#if IconComponent}
		<span class="set-toggle-icon" aria-hidden="true">
			<IconComponent size={18} strokeWidth={1.6} />
		</span>
	{/if}
	<div class="set-toggle-copy">
		<span class="set-toggle-label">{label}</span>
		{#if sub}
			<span class="set-toggle-sub">{sub}</span>
		{/if}
	</div>
	<button
		class="set-switch"
		class:is-on={checked}
		aria-checked={checked}
		aria-label={label}
		onclick={toggle}
		role="switch"
		type="button"
	>
		<span class="set-switch-thumb" aria-hidden="true"></span>
	</button>
</div>

<style lang="postcss">
	.set-toggle {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0.875rem;
		background: var(--bg-surface);
	}

	.set-toggle-icon {
		display: flex;
		flex-shrink: 0;
		color: var(--parchment-dim);
	}

	.set-toggle-copy {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.set-toggle-label {
		font-size: var(--t-14);
		font-weight: 500;
		color: var(--parchment);
	}

	.set-toggle-sub {
		font-size: var(--t-11);
		color: var(--parchment-mute);
	}

	.set-switch {
		position: relative;
		flex-shrink: 0;
		width: 2.25rem;
		height: 1.25rem;
		border: none;
		border-radius: var(--r-pill);
		background: var(--ink-line);
		cursor: pointer;
		transition: background-color var(--d-hover) var(--ease-vici);
	}

	.set-switch.is-on {
		background: var(--laurel);
	}

	.set-switch-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: var(--parchment);
		transition: transform var(--d-hover) var(--ease-vici);
	}

	.set-switch.is-on .set-switch-thumb {
		transform: translateX(1rem);
	}
</style>
