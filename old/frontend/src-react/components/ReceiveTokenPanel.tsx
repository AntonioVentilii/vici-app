import { useState } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, CheckCircle2, QrCode } from 'lucide-react';
import { toast } from 'sonner';

export default function ReceiveTokenPanel() {
	const { identity } = useInternetIdentity();
	const [copied, setCopied] = useState(false);

	const principalId = identity?.getPrincipal().toString() || '';

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(principalId);
			setCopied(true);
			toast.success('Principal ID copied to clipboard!');
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			toast.error('Failed to copy to clipboard');
		}
	};

	// Generate QR code data URL
	const generateQRCode = () => {
		// Using a simple QR code generation approach
		// In production, you might want to use a library like qrcode.react
		const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(principalId)}`;
		return qrCodeUrl;
	};

	return (
		<div className="space-y-6">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label>Your Principal ID</Label>
					<div className="flex gap-2">
						<Input value={principalId} readOnly className="font-mono text-sm" />
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={handleCopy}
							className="shrink-0"
						>
							{copied ? (
								<CheckCircle2 className="h-4 w-4 text-green-600" />
							) : (
								<Copy className="h-4 w-4" />
							)}
						</Button>
					</div>
					<p className="text-muted-foreground text-sm">
						Share this Principal ID with others to receive ICP or ckUSDC tokens
					</p>
				</div>

				{/* QR Code */}
				<div className="bg-muted/50 flex flex-col items-center space-y-4 rounded-lg p-6">
					<div className="rounded-lg bg-white p-4">
						<img src={generateQRCode()} alt="Principal ID QR Code" className="h-48 w-48" />
					</div>
					<div className="text-muted-foreground flex items-center gap-2 text-sm">
						<QrCode className="h-4 w-4" />
						<span>Scan to get Principal ID</span>
					</div>
				</div>
			</div>

			<div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
				<p className="text-sm text-blue-900 dark:text-blue-100">
					<strong>Note:</strong> Make sure the sender uses the correct token type (ICP or ckUSDC)
					when sending to this Principal ID.
				</p>
			</div>
		</div>
	);
}
