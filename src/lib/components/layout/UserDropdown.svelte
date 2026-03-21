<script lang="ts">
	import { signOut } from '@junobuild/core';
	import { Sun, Moon, Palette } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import DomainSwitch from '$lib/components/layout/DomainSwitch.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import PopOver from '$lib/components/ui/PopOver.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { theme, type Theme } from '$lib/stores/theme.store';

	let open = $state(false);

	const goToProfile = () => {
		open = false;

		goto(AppPath.Profile);
	};

	const doSignOut = async () => {
		open = false;

		await signOut();
	};

	const setTheme = (val: Theme) => {
		theme.set(val);
	};
</script>

<PopOver bind:open>
	{#snippet trigger()}
		<BaseButton
			class="h-10 w-10 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 active:scale-95"
			aria-label="User profile"
		>
			<svg
				fill="none"
				height="20"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				viewBox="0 0 24 24"
				width="20"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		</BaseButton>
	{/snippet}

	{#snippet content()}
		<div class="w-48 py-1">
			<BaseButton
				class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
				onclick={goToProfile}
			>
				<svg
					fill="none"
					height="16"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					width="16"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
					<circle cx="12" cy="7" r="4" />
				</svg>
				Profile
			</BaseButton>

			<div class="border-border my-1 border-t"></div>

			<DomainSwitch />

			<div class="px-4 py-2">
				<div class="text-muted-foreground mb-2 text-[10px] font-bold tracking-widest uppercase">
					Theme
				</div>
				<div class="flex gap-1">
					<button
						class="flex flex-1 items-center justify-center rounded-md border p-2 transition-all {$theme ===
						'peach'
							? 'border-primary bg-primary/10 text-primary shadow-sm'
							: 'border-border text-muted-foreground hover:bg-muted'}"
						aria-label="Peach theme"
						onclick={() => setTheme('peach')}
					>
						<Palette size={16} />
					</button>
					<button
						class="flex flex-1 items-center justify-center rounded-md border p-2 transition-all {$theme ===
						'light'
							? 'border-primary bg-primary/10 text-primary shadow-sm'
							: 'border-border text-muted-foreground hover:bg-muted'}"
						aria-label="Light theme"
						onclick={() => setTheme('light')}
					>
						<Sun size={16} />
					</button>
					<button
						class="flex flex-1 items-center justify-center rounded-md border p-2 transition-all {$theme ===
						'dark'
							? 'border-primary bg-primary/10 text-primary shadow-sm'
							: 'border-border text-muted-foreground hover:bg-muted'}"
						aria-label="Dark theme"
						onclick={() => setTheme('dark')}
					>
						<Moon size={16} />
					</button>
				</div>
			</div>

			<div class="border-border my-1 border-t"></div>

			<BaseButton
				class="w-full gap-3 px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
				onclick={doSignOut}
			>
				<svg
					fill="none"
					height="16"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					width="16"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
					<polyline points="16 17 21 12 16 7" />
					<line x1="21" x2="9" y1="12" y2="12" />
				</svg>
				Log out
			</BaseButton>
		</div>
	{/snippet}
</PopOver>
