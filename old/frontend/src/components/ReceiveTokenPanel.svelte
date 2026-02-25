<script lang="ts">
	import { identity } from '../stores/auth';
	import Button from './ui/Button.svelte';
	import Input from './ui/Input.svelte';
	import { Copy, CheckCircle2, QrCode } from 'lucide-svelte';
	import { toast } from 'sonner';

	let copied = false;
	$: principalId = $identity?.getPrincipal().toString() || '';

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(principalId);
			copied = true;
			toast.success('Principal ID copied to clipboard!');
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			toast.error('Failed to copy to clipboard');
		}
	};

	const generateQRCode = () => {
		return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(principalId)}`;
	};
</script>

<div class="space-y-6">
	<div class="space-y-4">
		<div class="space-y-2">
			<label class="text-sm font-medium">Your Principal ID</label>
			<div class="flex gap-2">
				<Input value={principalId} readonly className="font-mono text-sm" />
				<Button variant="outline" size="icon" on:click={handleCopy} className="shrink-0">
					{#if copied}
						<CheckCircle2 size={16} class="text-green-600" />
					{:else}
						<Copy size={16} />
					{/if}
				</Button>
			</div>
			<p class="text-muted-foreground text-sm">
				Share this Principal ID with others to receive ICP or ckUSDC tokens
			</p>
		</div>

		<!-- QR Code -->
		<div class="flex flex-col items-center space-y-4 rounded-lg bg-slate-100 p-6">
			<div class="rounded-lg bg-white p-4">
				<img src={generateQRCode()} alt="Principal ID QR Code" class="h-48 w-48" />
			</div>
			<div class="text-muted-foreground flex items-center gap-2 text-sm">
				<QrCode size={16} />
				<span>Scan to get Principal ID</span>
			</div>
		</div>
	</div>

	<div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">
		<p class="text-sm">
			<strong>Note:</strong> Make sure the sender uses the correct token type (ICP or ckUSDC) when sending
			to this Principal ID.
		</p>
	</div>
</div>
