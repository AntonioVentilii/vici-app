import { Button } from '@/components/ui/button';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { ShieldAlert } from 'lucide-react';

export default function AccessDeniedScreen() {
  const { login, loginStatus } = useInternetIdentity();

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-6">
            <ShieldAlert className="h-12 w-12 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Access Denied</h1>
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
