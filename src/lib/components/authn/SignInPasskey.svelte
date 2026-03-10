<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconPasskey from '$lib/components/icons/IconPasskey.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { ButtonState } from '$lib/types/components';

	interface Props {
		state?: ButtonState;
		onSuccess?: () => void;
	}

	let { state = $bindable('enabled'), onSuccess }: Props = $props();

	const signInWithPassKey = async () => {
		state = 'pending';

		try {
			await signIn({
				webauthn: {}
			});

			onSuccess?.();
		} catch (e: unknown) {
			console.error('Passkey sign-in failed', e);
		} finally {
			state = 'enabled';
		}
	};
</script>

<Button onclick={signInWithPassKey} {state}>
	<IconPasskey size="20px" />
	<span>Sign in with Passkey</span>
</Button>
