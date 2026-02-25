import { useState } from 'react';
import { useDepositFunds, useWithdrawFunds } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Principal } from '@icp-sdk/core/principal';
import { toast } from 'sonner';
import type { WalletBalance } from '../backend';

interface SendTokenFormProps {
	currentBalance: WalletBalance | undefined;
}

export default function SendTokenForm({ currentBalance }: SendTokenFormProps) {
	const [tokenType, setTokenType] = useState<'icp' | 'ckUSDC'>('icp');
	const [recipient, setRecipient] = useState('');
	const [amount, setAmount] = useState('');
	const [error, setError] = useState('');
	const withdrawFunds = useWithdrawFunds();

	const validatePrincipal = (value: string): boolean => {
		try {
			Principal.fromText(value);
			return true;
		} catch {
			return false;
		}
	};

	const validateAmount = (value: string): boolean => {
		const num = parseFloat(value);
		if (isNaN(num) || num <= 0) return false;

		const balance = tokenType === 'icp' ? currentBalance?.icp : currentBalance?.ckUSDC;
		if (!balance) return false;

		// Convert to smallest unit (e8s)
		const amountInSmallestUnit = BigInt(Math.floor(num * 100_000_000));
		return amountInSmallestUnit <= balance;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		// Validate Principal ID
		if (!validatePrincipal(recipient)) {
			setError('Invalid Principal ID format');
			return;
		}

		// Validate amount
		if (!validateAmount(amount)) {
			setError('Invalid amount or insufficient balance');
			return;
		}

		try {
			toast.info('Send functionality not yet fully implemented', {
				description: 'This feature requires ledger canister integration'
			});

			// Reset form
			setRecipient('');
			setAmount('');
		} catch (err: any) {
			setError(err.message || 'Failed to send transaction');
			toast.error('Transaction failed', {
				description: err.message || 'Please try again'
			});
		}
	};

	const formatBalance = (balance: bigint | undefined) => {
		if (!balance) return '0.00';
		return (Number(balance) / 100_000_000).toFixed(8);
	};

	const currentTokenBalance = tokenType === 'icp' ? currentBalance?.icp : currentBalance?.ckUSDC;

	return (
		<div className="space-y-6">
			<Alert>
				<Info className="h-4 w-4" />
				<AlertDescription>
					Token sending requires integration with ICP Ledger canisters. This feature will be
					available in a future update.
				</AlertDescription>
			</Alert>

			<form onSubmit={handleSubmit} className="space-y-6">
				{/* Token Type Selection */}
				<div className="space-y-2">
					<Label htmlFor="token-type">Token Type</Label>
					<Select
						value={tokenType}
						onValueChange={(value) => setTokenType(value as 'icp' | 'ckUSDC')}
						disabled
					>
						<SelectTrigger id="token-type">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="icp">ICP</SelectItem>
							<SelectItem value="ckUSDC">ckUSDC</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-sm">
						Available: {formatBalance(currentTokenBalance)} {tokenType.toUpperCase()}
					</p>
				</div>

				{/* Recipient Principal ID */}
				<div className="space-y-2">
					<Label htmlFor="recipient">Recipient Principal ID</Label>
					<Input
						id="recipient"
						type="text"
						placeholder="xxxxx-xxxxx-xxxxx-xxxxx-xxx"
						value={recipient}
						onChange={(e) => {
							setRecipient(e.target.value);
							setError('');
						}}
						disabled
					/>
				</div>

				{/* Amount */}
				<div className="space-y-2">
					<Label htmlFor="amount">Amount</Label>
					<Input
						id="amount"
						type="number"
						step="0.00000001"
						min="0"
						placeholder="0.00"
						value={amount}
						onChange={(e) => {
							setAmount(e.target.value);
							setError('');
						}}
						disabled
					/>
				</div>

				{/* Error Message */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Submit Button */}
				<Button type="submit" className="w-full" disabled>
					<Send className="mr-2 h-4 w-4" />
					Send {tokenType.toUpperCase()} (Coming Soon)
				</Button>
			</form>
		</div>
	);
}
