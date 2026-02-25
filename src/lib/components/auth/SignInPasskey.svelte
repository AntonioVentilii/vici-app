<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconPasskey from '$lib/components/icons/IconPasskey.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	const signInWithPassKey = async () => {
		await signIn({
			webauthn: {}
		});
	};
</script>

<Button onclick={signInWithPassKey}>
	<IconPasskey size="20px" />
	<span>Sign in with Passkey</span>
</Button>
