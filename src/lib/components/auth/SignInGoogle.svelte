<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { signIn } from '@junobuild/core';
	import IconGoogle from '$lib/components/icons/IconGoogle.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	const GOOGLE_CLIENT_ID = undefined;

	const signInWithGoogle = async () => {
		await signIn({
			google: {}
		});
	};
</script>

{#if nonNullish(GOOGLE_CLIENT_ID)}
	<Button onclick={signInWithGoogle}>
		<IconGoogle size="20px" />
		<span>Sign in with Google</span>
	</Button>
{/if}
