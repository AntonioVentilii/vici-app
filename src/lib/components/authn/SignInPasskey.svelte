<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconPasskey from '$lib/components/icons/IconPasskey.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface Props {
		onSuccess?: () => void;
	}

	const { onSuccess }: Props = $props();

	const signInWithPassKey = async () => {
		await signIn({
			webauthn: {}
		});

		onSuccess?.();
	};
</script>

<Button onclick={signInWithPassKey}>
	<IconPasskey size="20px" />
	<span>Sign in with Passkey</span>
</Button>
