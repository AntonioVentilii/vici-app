<script lang="ts">
	import { signOut } from '@junobuild/core';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';

	const doSignOut = (): Promise<void> => signOut();
</script>

<BaseButton
	class="text-slate-500 hover:text-indigo-600 active:text-indigo-700"
	aria-label="Sign out"
	onclick={doSignOut}
>
	<svg
		fill="currentColor"
		height="16"
		viewBox="0 -960 960 960"
		width="16"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M120-120v-720h360v80H200v560h280v80H120Zm520-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z"
		/>
	</svg>
</BaseButton>
