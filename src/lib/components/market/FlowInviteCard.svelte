<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { userStore } from '$lib/stores/user.store';

	interface Props {
		sessionXp?: number;
	}

	const { sessionXp = 0 }: Props = $props();

	let toast = $state('');

	const handle = $derived($userStore.profile?.nickname?.trim() ?? 'predictor');

	const inviteCode = $derived.by(() => {
		const seed = `${handle}|${sessionXp}|${$userStore.profile?.level ?? 0}`;
		let h = 5381;

		for (let i = 0; i < seed.length; i++) {
			h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
		}

		const suffix = Math.abs(h).toString(36).slice(0, 5).toUpperCase();
		const prefix = handle.replace(/\s+/g, '-').toUpperCase().slice(0, 24);

		return `${prefix}-${suffix}`;
	});

	const inviteUrl = $derived(`https://vici.markets/i/${inviteCode}`);
	const shareText = 'Predict at the speed of thought. Join me on VICI.';

	const showToast = (message: string) => {
		toast = message;
		setTimeout(() => {
			toast = '';
		}, 1600);
	};

	const copyCode = async () => {
		try {
			await navigator.clipboard.writeText(inviteCode);
			showToast('Code copied');
		} catch {
			showToast('Copy failed');
		}
	};

	const shareInvite = async () => {
		if (navigator.share) {
			try {
				await navigator.share({ title: 'VICI', text: shareText, url: inviteUrl });

				return;
			} catch (e) {
				if (e instanceof Error && e.name === 'AbortError') {
					return;
				}
			}
		}

		try {
			await navigator.clipboard.writeText(`${shareText} ${inviteUrl}`);
			showToast('Invite copied');
		} catch {
			showToast('Copy failed');
		}
	};
</script>

<section class="flow-invite">
	<div class="flow-invite-head">
		<div>
			<p class="eyebrow flow-invite-label">Bring a friend</p>
			<p class="flow-invite-copy">
				Both of you earn <span class="num text-laurel">+500 XP</span> on their first call.
			</p>
		</div>
	</div>

	<div class="flow-invite-actions">
		<button class="flow-invite-code" aria-label="Copy invite code" onclick={copyCode} type="button">
			<span class="eyebrow">Code</span>
			<span class="num flow-invite-code-value">{inviteCode}</span>
		</button>
		<Button class="flow-invite-share" onclick={shareInvite}>Share</Button>
	</div>

	{#if toast}
		<p class="flow-invite-toast" role="status">{toast}</p>
	{/if}
</section>

<style lang="postcss">
	.flow-invite {
		margin-top: 0.75rem;
		padding: 1rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
	}

	.flow-invite-label {
		margin: 0;
		color: var(--laurel);
	}

	.flow-invite-copy {
		margin: 0.35rem 0 0;
		font-size: var(--t-13);
		line-height: var(--leading-normal);
		color: var(--parchment-mute);
	}

	.flow-invite-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.flow-invite-code {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		padding: 0.5rem 0.75rem;
		border-radius: var(--r-8);
		border: 1px solid var(--border-base);
		background: var(--bg-popover);
		cursor: pointer;
		text-align: left;
	}

	.flow-invite-code-value {
		font-size: var(--t-13);
		font-weight: 600;
		letter-spacing: 0.06em;
		color: var(--parchment);
	}

	:global(.flow-invite-share) {
		flex: 0 0 auto;
	}

	.flow-invite-toast {
		margin: 0.5rem 0 0;
		font-size: var(--t-12);
		color: var(--laurel);
	}
</style>
