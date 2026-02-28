<script lang="ts">
	import type { Snippet } from 'svelte';
	import SignInModal from '$lib/components/auth/SignInModal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
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

	let showSignInModal = $state(false);

	// eslint-disable-next-line require-await
	const openSignInModal = async () => {
		showSignInModal = true;
	};
</script>

{#if $userSignedIn}
	{@render children()}
{:else}
	<div class="flex flex-col items-center justify-center py-20 text-center">
		<div class="mb-12 max-w-md">
			<h2 class="text-4xl font-black text-slate-950">{title}</h2>
			<p class="mt-4 text-lg text-slate-600">
				{description}
			</p>
		</div>

		<div class="rounded-3xl border border-slate-100 bg-white p-12 shadow-2xl">
			<div class="flex flex-col items-center gap-6">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white shadow-xl"
				>
					V
				</div>
				<Button onclick={openSignInModal}>Sign in to Continue</Button>
			</div>
		</div>
	</div>

	<SignInModal bind:show={showSignInModal} />
{/if}
