<script lang="ts">
	import type { Icon as LucideIcon } from 'lucide-svelte';

	interface Props {
		label: string;
		sub?: string;
		icon?: typeof LucideIcon;
		checked: boolean;
		onchange: (value: boolean) => void;
		disabled?: boolean;
	}

	const {
		label,
		sub = undefined,
		icon: IconComponent = undefined,
		checked,
		onchange,
		disabled = false
	}: Props = $props();

	const toggle = () => {
		if (disabled) {
			return;
		}

		onchange(!checked);
	};
</script>

<div class="set-toggle" class:is-disabled={disabled}>
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
		aria-disabled={disabled}
		aria-label={label}
		{disabled}
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
		padding: 0.875rem;
		background: var(--bg-surface);
	}

	.set-toggle-icon {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
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
		font-weight: 600;
		color: var(--text-base);
	}

	.set-toggle-sub {
		font-size: 0.6875rem;
		color: var(--text-muted);
	}

	.set-switch {
		position: relative;
		flex-shrink: 0;
		width: 2.75rem;
		height: 1.5rem;
		border: none;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-base) 14%, transparent);
		cursor: pointer;
		transition: background-color var(--d-hover) var(--ease-vici);
	}

	.set-switch.is-on {
		background: var(--color-primary);
	}

	.set-switch-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
		transition: transform var(--d-hover) var(--ease-vici);
	}

	.set-switch.is-on .set-switch-thumb {
		transform: translateX(1.25rem);
	}

	.set-toggle.is-disabled .set-switch,
	.set-toggle.is-disabled .set-toggle-icon {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.set-toggle.is-disabled .set-toggle-label {
		color: var(--text-muted);
	}
</style>
