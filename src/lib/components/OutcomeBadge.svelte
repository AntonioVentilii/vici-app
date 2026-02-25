<script lang="ts">
	import type { Outcome } from '$lib/services/mockBackend';

	interface Props {
		outcome?: Outcome | string;
		status?: string;
	}

	const { outcome, status }: Props = $props();

	const getColor = (o: string | undefined) => {
		if (o === 'YES') {
			return 'bg-green-500/20 text-green-400 border-green-500/20';
		}
		if (o === 'NO') {
			return 'bg-red-500/20 text-red-400 border-red-500/20';
		}
		if (o === 'CANCELED') {
			return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
		}
		return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20';
	};
</script>

<span
	class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase backdrop-blur-md {getColor(
		outcome ?? status
	)}"
>
	{outcome ?? status ?? 'Unknown'}
</span>
