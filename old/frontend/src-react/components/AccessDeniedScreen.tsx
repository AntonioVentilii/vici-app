import { Button } from '@/components/ui/button';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { ShieldAlert } from 'lucide-react';

export default function AccessDeniedScreen() {
	const { login, loginStatus } = useInternetIdentity();

	return (
		<div className="flex flex-1 items-center justify-center px-4 py-16">
			<div className="max-w-md space-y-6 text-center">
				<div className="flex justify-center">
					<div className="bg-destructive/10 rounded-full p-6">
						<ShieldAlert className="text-destructive h-12 w-12" />
					</div>
				</div>
				<div className="space-y-2">
					<h1 className="text-foreground text-3xl font-bold">Access Denied</h1>
					<p className="text-muted-foreground">
						You need to be logged in to access this page. Please log in to continue.
					</p>
				</div>
				<Button onClick={login} disabled={loginStatus === 'logging-in'} size="lg">
					{loginStatus === 'logging-in' ? 'Connecting...' : 'Login to Continue'}
				</Button>
			</div>
		</div>
	);
}
