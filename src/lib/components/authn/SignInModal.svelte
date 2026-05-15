<script lang="ts">
	import SignInActions from '$lib/components/authn/SignInActions.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { setAuthBusy } from '$lib/stores/user.store';

	interface Props {
		show: boolean;
	}

	let { show = $bindable(false) }: Props = $props();

	const onSuccess = () => {
		// Mark auth as busy so the UI shows a spinner during the brief
		// window between closing the modal and `onAuthStateChange` firing
		// with the newly signed-in user.
		setAuthBusy(true);
		show = false;
	};
</script>

<Dialog bind:show>
	<div class="flex flex-col items-center justify-center gap-8 py-4 text-center">
		<div class="flex flex-col items-center justify-center gap-3">
			<div
				class="bg-primary text-primary-foreground flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold shadow-[var(--laurel-glow)] shadow-xl"
			>
				V
			</div>
			<h1 class="font-display text-foreground text-3xl font-semibold tracking-tight">
				VENI. VIDI. <span class="text-primary">VICI.</span>
			</h1>
		</div>

		<div class="border-border w-full max-w-sm rounded-2xl border bg-[var(--bg-surface)] p-6">
			<p class="text-muted-foreground mb-6 text-sm font-semibold tracking-wider uppercase">
				Sign in with
			</p>
			<div class="flex flex-col items-center justify-center">
				<SignInActions {onSuccess} />
			</div>
		</div>
	</div>
</Dialog>
