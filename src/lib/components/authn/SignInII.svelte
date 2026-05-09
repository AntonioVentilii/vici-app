<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconIc from '$lib/components/icons/IconIC.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { II_MAX_TIME_TO_LIVE_NS } from '$lib/constants/app.constants';
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
				internet_identity: {
					options: {
						maxTimeToLiveInNanoseconds: II_MAX_TIME_TO_LIVE_NS
					}
				}
			});

			onSuccess?.();
		} catch (e: unknown) {
			console.error('Internet Identity sign-in failed', e);
		} finally {
			status = 'enabled';
		}
	};
</script>

<Button data-tid={TestId.SignInII} onclick={signInWithII} {status}>
	<IconIc size="20px" />
	<span>Sign in with Internet Identity</span>
</Button>
