<script lang="ts">
	import { ArrowLeft, Mail } from 'lucide-svelte/icons';
	import { resolve } from '$app/paths';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { InfoDoc } from '$lib/types/info-doc';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		doc: InfoDoc;
	}

	let { doc }: Props = $props();

	const isLegalDoc = $derived(doc.eyebrow.toLowerCase().startsWith('legal'));
</script>

<svelte:head>
	<title>{doc.title} · VICI</title>
</svelte:head>

<div class="mx-auto flex max-w-[var(--reading-max,64ch)] flex-col gap-6 py-4 md:py-10">
	<a
		class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
		href={resolve(PublicPath.Welcome)}
	>
		<ArrowLeft aria-hidden="true" size={14} strokeWidth={1.8} />
		<span>{t({ locale: $localeStore, key: 'info.back' })}</span>
	</a>

	<header class="flex flex-col gap-2">
		<span class="allcaps">{doc.eyebrow}</span>
		<h1 class="display text-4xl md:text-5xl">{doc.title}</h1>
	</header>

	{#if isLegalDoc}
		<aside
			class="border-laurel-glow bg-laurel-glow/30 text-foreground/85 surface flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
			role="note"
		>
			<span class="text-laurel" aria-hidden="true">●</span>
			<span>{t({ locale: $localeStore, key: 'info.placeholder_legal_banner' })}</span>
		</aside>
	{/if}

	<article class="flex flex-col gap-4 leading-relaxed">
		{#each doc.blocks as block, i (i)}
			{#if block.kind === 'lede'}
				<p class="lede">{block.text}</p>
			{:else if block.kind === 'h'}
				<h2 class="mt-4 text-lg font-semibold">{block.text}</h2>
			{:else if block.kind === 'p'}
				<p class="text-foreground/85">{block.text}</p>
			{:else if block.kind === 'list'}
				<ul class="text-foreground/85 list-disc pl-5">
					{#each block.items as item, j (j)}
						<li class="py-0.5">{item}</li>
					{/each}
				</ul>
			{:else if block.kind === 'mail'}
				<a
					class="text-laurel hover:text-laurel-deep inline-flex items-center gap-1.5 text-sm"
					href="mailto:{block.text}"
				>
					<Mail aria-hidden="true" size={14} strokeWidth={1.8} />
					<span>{block.text}</span>
				</a>
			{/if}
		{/each}
	</article>
</div>
