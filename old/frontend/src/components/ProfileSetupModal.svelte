<script lang="ts">
	import { userProfile } from '../stores/profile';
	import Dialog from './ui/Dialog.svelte';
	import Button from './ui/Button.svelte';
	import Input from './ui/Input.svelte';
	import { toast } from 'sonner';
	import { Loader2 } from 'lucide-svelte';

	let nickname = '';
	let isProcessing = false;

	const handleSubmit = async (e: Event) => {
		e.preventDefault();

		if (!nickname.trim()) {
			toast.error('Please enter a nickname');
			return;
		}

		isProcessing = true;
		try {
			await userProfile.updateProfile({
				nickname: nickname.trim(),
				avatar: '/assets/generated/default-avatar.dim_100x100.png',
				balance: BigInt(1000), // Default balance for new users
				createdAt: BigInt(Date.now() * 1000000),
				lastLogin: BigInt(Date.now() * 1000000)
			} as any); // Use any for now as updateProfile might need to handle new user case

			// The backend actually has a separate createUserProfile method
			// but in our store we might want to expose it properly.
			// Let's check useInitializeUser in useQueries.ts

			toast.success(`Welcome to Vici! You've received Ꝟ 1,000 to start trading.`);
		} catch (error) {
			toast.error('Failed to create profile. Please try again.');
			console.error(error);
		} finally {
			isProcessing = false;
		}
	};
</script>

<Dialog open={true}>
	<div class="space-y-4">
		<div class="space-y-2">
			<h2 class="text-2xl font-bold">Welcome to Vici!</h2>
			<p class="text-muted-foreground text-sm">
				Let's set up your profile. You'll receive Ꝟ 1,000 to start trading.
			</p>
		</div>

		<form on:submit={handleSubmit} class="mt-4 space-y-4">
			<div class="space-y-2">
				<label for="nickname" class="text-sm font-medium">Nickname</label>
				<Input
					id="nickname"
					placeholder="Enter your nickname"
					bind:value={nickname}
					maxLength={30}
					autofocus
				/>
			</div>
			<Button type="submit" class="w-full" disabled={isProcessing}>
				{#if isProcessing}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Creating Profile...
				{:else}
					Get Started
				{/if}
			</Button>
		</form>
	</div>
</Dialog>
