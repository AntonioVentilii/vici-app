<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconIc from '$lib/components/icons/IconIC.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { ButtonState } from '$lib/types/components';

	interface Props {
		state?: ButtonState;
		onSuccess?: () => void;
	}

	let { state = $bindable('enabled'), onSuccess }: Props = $props();

	const signInWithII = async () => {
		state = 'pending';

		try {
			await signIn({
				internet_identity: {}
			});

			onSuccess?.();
		} catch (e: unknown) {
			console.error('Internet Identity sign-in failed', e);
		} finally {
			state = 'enabled';
		}
	};
</script>

<Button onclick={signInWithII} {state}>
	<IconIc size="20px" />
	<span>Sign in with Internet Identity</span>
</Button>
