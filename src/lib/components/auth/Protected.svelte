<script lang="ts">
	import type { Snippet } from 'svelte';
	import SignIn from '$lib/components/auth/SignIn.svelte';
	import { userSignedIn } from '$lib/derived/user.derived';

	interface Props {
		children: Snippet;
		title?: string;
		description?: string;
	}

	const {
		children,
		title = 'Authentication Required',
		description = 'Please sign in to access this page.'
	}: Props = $props();
</script>

{#if $userSignedIn}
	{@render children()}
{:else}
	<div class="flex flex-col items-center justify-center py-20 text-center">
		<div class="mb-12 max-w-md">
			<h2 class="text-3xl font-black text-slate-950">{title}</h2>
			<p class="mt-4 text-slate-600">
				{description}
			</p>
		</div>

		<div class="rounded-3xl border border-slate-100 bg-white p-12 shadow-2xl">
			<SignIn />
		</div>
	</div>
{/if}
