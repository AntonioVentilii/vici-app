<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconIc from '$lib/components/icons/IconIC.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { II_MAX_TIME_TO_LIVE_NS } from '$lib/constants/app.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { ButtonStatus } from '$lib/types/components';
	import { t } from '$lib/utils/i18n.utils';

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

<Button class="signin-provider-button w-full" onclick={signInWithII} {status}>
	<IconIc size="20px" />
	<span>{t({ locale: $localeStore, key: 'authn.signin_with.ii' })}</span>
</Button>
