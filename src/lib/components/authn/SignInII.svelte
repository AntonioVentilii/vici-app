<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconIc from '$lib/components/icons/IconIC.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { TestId } from '$lib/constants/test-ids.constants';
	import type { ButtonStatus } from '$lib/types/components';

	interface Props {
		status?: ButtonStatus;
		onSuccess?: () => void;
	}

	let { status = $bindable('enabled'), onSuccess }: Props = $props();

	const signInWithII = async () => {
		status = 'pending';

		try {
			await signIn({
				internet_identity: {}
			});

			onSuccess?.();
		} catch (e: unknown) {
			console.error('Internet Identity sign-in failed', e);
		} finally {
			status = 'enabled';
		}
	};
</script>

<Button onclick={signInWithII} {status} testId={TestId.SignInII}>
	<IconIc size="20px" />
	<span>Sign in with Internet Identity</span>
</Button>
