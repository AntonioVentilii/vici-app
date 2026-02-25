import { useState } from 'react';
import { useInitializeUser } from '../hooks/useQueries';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ProfileSetupModal() {
	const [nickname, setNickname] = useState('');
	const initializeUser = useInitializeUser();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!nickname.trim()) {
			toast.error('Please enter a nickname');
			return;
		}

		try {
			await initializeUser.mutateAsync({
				nickname: nickname.trim(),
				avatar: '/assets/generated/default-avatar.dim_100x100.png'
			});
			toast.success(`Welcome to Vici! You've received Ꝟ 1,000 to start trading.`);
		} catch (error) {
			toast.error('Failed to create profile. Please try again.');
			console.error(error);
		}
	};

	return (
		<Dialog open={true}>
			<DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
				<DialogHeader>
					<DialogTitle className="text-2xl">Welcome to Vici!</DialogTitle>
					<DialogDescription>
						Let's set up your profile. You'll receive Ꝟ 1,000 to start trading.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="mt-4 space-y-4">
					<div className="space-y-2">
						<Label htmlFor="nickname">Nickname</Label>
						<Input
							id="nickname"
							placeholder="Enter your nickname"
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							maxLength={30}
							autoFocus
						/>
					</div>
					<Button type="submit" className="w-full" disabled={initializeUser.isPending}>
						{initializeUser.isPending ? 'Creating Profile...' : 'Get Started'}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
