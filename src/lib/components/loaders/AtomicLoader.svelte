<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';

	interface Props {
		onLoad: () => Promise<void>;
		onShouldUseSlowInterval: () => Promise<boolean>;
		fastInterval?: number;
		slowInterval?: number;
		runImmediately?: boolean;
	}

	const {
		onLoad,
		onShouldUseSlowInterval,
		fastInterval = 1_000,
		slowInterval = 30_000,
		runImmediately = true
	}: Props = $props();

	let timeout: NodeJS.Timeout | undefined = undefined;
	let destroyed = false;
	let running = false;

	const clearScheduled = () => {
		if (nonNullish(timeout)) {
			clearTimeout(timeout);

			timeout = undefined;
		}
	};

	const scheduleNext = async () => {
		if (destroyed) {
			return;
		}

		const useSlowInterval = await onShouldUseSlowInterval();

		const delay = useSlowInterval ? slowInterval : fastInterval;

		timeout = setTimeout(() => {
			void tick();
		}, delay);
	};

	const tick = async () => {
		if (destroyed || running) {
			return;
		}

		running = true;

		clearScheduled();

		try {
			await onLoad();
		} finally {
			running = false;
		}

		await scheduleNext();
	};

	onMount(() => {
		if (runImmediately) {
			void tick();
		} else {
			void scheduleNext();
		}

		return () => {
			destroyed = true;

			clearScheduled();
		};
	});
</script>
