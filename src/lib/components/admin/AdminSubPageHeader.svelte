<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		title: string;
		description: string;
	}

	const { title, description }: Props = $props();

	const backLabel = $derived(t({ locale: $localeStore, key: 'admin.hub.back' }));
</script>

<header class="space-y-4">
	<button
		class="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
		aria-label={backLabel}
		onclick={() => goto(resolve(AppPath.Admin))}
		type="button"
	>
		<ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
		{backLabel}
	</button>

	<div class="space-y-2">
		<h1 class="font-display text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
			{title}
		</h1>
		<p class="text-muted-foreground max-w-2xl text-lg">{description}</p>
	</div>
</header>
