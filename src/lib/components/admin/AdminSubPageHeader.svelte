<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/components/layout/ScreenHeader.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		title: string;
		description: string;
	}

	const { title, description }: Props = $props();

	const backLabel = $derived(t({ locale: $localeStore, key: 'admin.hub.back' }));

	const handleBack = () => {
		void goto(resolve(AppPath.Admin));
	};
</script>

<header class="admin-subpage-head">
	<ScreenHeader back={{ label: backLabel, onBack: handleBack }} {title} />
	<p class="text-muted-foreground max-w-2xl px-5 text-lg">{description}</p>
</header>
