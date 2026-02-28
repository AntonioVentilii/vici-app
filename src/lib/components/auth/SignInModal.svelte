<script lang="ts">
	import SignInActions from '$lib/components/auth/SignInActions.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';

	let { show = $bindable(false) } = $props<{
		show: boolean;
	}>();
</script>

<Dialog bind:show>
	<div class="flex flex-col items-center justify-center gap-8 py-4 text-center">
		<div class="flex flex-col items-center justify-center gap-3">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white shadow-xl"
			>
				V
			</div>
			<h1 class="text-3xl font-extrabold tracking-tight text-slate-950">
				VENI. <span class="text-indigo-600">VIDI.</span> VICI.
			</h1>
		</div>

		<div class="w-full max-w-sm rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
			<p class="mb-6 text-sm font-semibold tracking-wider text-slate-400 uppercase">Sign in with</p>
			<div class="flex flex-col items-center justify-center">
				<SignInActions />
			</div>
		</div>
	</div>
</Dialog>
