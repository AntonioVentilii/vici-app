<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import AtomicLoader from '$lib/components/loaders/AtomicLoader.svelte';
	import { getIdentity } from '$lib/services/identity.services';

	interface Props {
		onLoad: () => Promise<void>;
		fastInterval?: number;
		slowInterval?: number;
		runImmediately?: boolean;
	}

	const {
		onLoad,
		fastInterval = 1_000,
		slowInterval = 30_000,
		runImmediately = true
	}: Props = $props();

	const onShouldUseSlowInterval = async (): Promise<boolean> => {
		const identity = await getIdentity();

		return nonNullish(identity);
	};
</script>

<AtomicLoader {fastInterval} {onLoad} {onShouldUseSlowInterval} {runImmediately} {slowInterval} />
