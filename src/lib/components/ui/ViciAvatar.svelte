<script lang="ts">
	/**
	 * Deterministic generated character face. A seed string maps to a
	 * stable set of traits (skin, hair, expression, optional accessory,
	 * background) and renders a flat-plane SVG portrait. The same seed
	 * always produces the same face — pure, client-only, no backend and
	 * no network. Used wherever a surface needs a recognisable stand-in
	 * face without exposing real user data.
	 */

	import { viciAvatarSvg } from '$lib/utils/vici-avatar.utils';

	interface Props {
		/** Seed string the face is derived from. */
		seed: string;
		/** Rendered diameter in pixels. */
		size?: number;
		/** Extra classes forwarded to the wrapper. */
		class?: string;
	}

	const { seed, size = 28, class: className = '' }: Props = $props();

	const svg = $derived(viciAvatarSvg({ seed, size }));
</script>

<!-- Decorative artwork; the {@html} payload is a self-generated SVG
	 string with no user-supplied markup. -->
<span
	style:width="{size}px"
	style:height="{size}px"
	class="vici-avatar {className}"
	aria-hidden="true"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html svg}
</span>

<style lang="postcss">
	.vici-avatar {
		display: inline-flex;
		line-height: 0;
		overflow: hidden;
	}

	.vici-avatar :global(svg) {
		display: block;
	}
</style>
