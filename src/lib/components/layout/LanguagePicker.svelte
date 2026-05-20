<script lang="ts">
	import { Languages } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import {
		LOCALE_STORAGE_KEY,
		SUPPORTED_LOCALES,
		type AppLocale
	} from '$lib/constants/locale.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	let open = $state(false);
	let rootEl = $state<HTMLDivElement | undefined>(undefined);

	const current = $derived(SUPPORTED_LOCALES.find((locale) => locale.id === $localeStore));

	const selectLocale = (id: AppLocale) => {
		localeStore.set({ key: LOCALE_STORAGE_KEY, value: id });
		open = false;
	};

	onMount(() => {
		const onDocClick = (event: MouseEvent) => {
			if (!open || !rootEl?.contains(event.target as Node)) {
				open = false;
			}
		};

		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				open = false;
			}
		};

		document.addEventListener('mousedown', onDocClick);
		window.addEventListener('keydown', onKey);

		return () => {
			document.removeEventListener('mousedown', onDocClick);
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

<div bind:this={rootEl} class="language-picker">
	<button
		class="language-picker-trigger"
		aria-expanded={open}
		aria-haspopup="listbox"
		aria-label={t({ locale: $localeStore, key: 'a11y.language' })}
		onclick={() => (open = !open)}
		type="button"
	>
		<Languages aria-hidden="true" size={14} />
		<span class="num">{current?.short ?? 'EN'}</span>
	</button>

	{#if open}
		<ul
			class="language-picker-menu"
			aria-label={t({ locale: $localeStore, key: 'a11y.language' })}
			role="listbox"
		>
			{#each SUPPORTED_LOCALES as locale (locale.id)}
				<li>
					<button
						class="language-picker-item"
						class:active={$localeStore === locale.id}
						aria-selected={$localeStore === locale.id}
						onclick={() => selectLocale(locale.id)}
						role="option"
						type="button"
					>
						<span class="num language-picker-short">{locale.short}</span>
						<span class="language-picker-label">{locale.label}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="postcss">
	.language-picker {
		position: relative;
	}

	.language-picker-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.55rem;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--parchment) 4%, transparent);
		color: var(--foreground);
		font-size: var(--t-12);
		font-weight: 600;
		transition: background 200ms var(--ease-vici);
	}

	.language-picker-trigger:hover {
		background: color-mix(in srgb, var(--parchment) 8%, transparent);
	}

	.language-picker-menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: var(--z-dropdown, 40);
		min-width: 10rem;
		margin: 0;
		padding: 0.25rem;
		list-style: none;
		border-radius: 12px;
		border: 1px solid var(--border);
		background: var(--card);
		box-shadow: var(--shadow-card);
	}

	.language-picker-item {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.55rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--foreground);
		font-size: var(--t-12);
		text-align: left;
		cursor: pointer;
	}

	.language-picker-item:hover,
	.language-picker-item.active {
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
	}

	.language-picker-short {
		width: 1.75rem;
		font-weight: 700;
	}

	.language-picker-label {
		color: var(--muted-foreground);
	}
</style>
