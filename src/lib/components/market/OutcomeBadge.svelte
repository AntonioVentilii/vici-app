<script lang="ts">
	import type { Outcome } from '$lib/services/mockBackend';

	interface Props {
		outcome?: Outcome | string;
		status?: string;
	}

	const { outcome, status }: Props = $props();

	const getColor = (o: string | undefined) => {
		if (o === 'YES') {
			return 'bg-green-100 text-green-700 border-green-200';
		}
		if (o === 'NO') {
			return 'bg-red-100 text-red-700 border-red-200';
		}
		if (o === 'CANCELED') {
			return 'bg-slate-100 text-slate-600 border-slate-200';
		}
		return 'bg-indigo-100 text-indigo-700 border-indigo-200';
	};
</script>

<span
	class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase backdrop-blur-md {getColor(
		outcome ?? status
	)}"
>
	{outcome ?? status ?? 'Unknown'}
</span>
