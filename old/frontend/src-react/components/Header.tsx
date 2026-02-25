import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetCallerUserProfile, useIsCallerAdmin } from '../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Menu, X, User, LogOut, Shield, Zap, Wallet } from 'lucide-react';
import { useState } from 'react';
import type { Page } from '../App';

interface HeaderProps {
	currentPage: Page;
	onNavigate: (page: Page) => void;
}

export default function Header({ currentPage, onNavigate }: HeaderProps) {
	const { login, clear, loginStatus, identity } = useInternetIdentity();
	const { data: userProfile } = useGetCallerUserProfile();
	const { data: isAdmin } = useIsCallerAdmin();
	const queryClient = useQueryClient();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const isAuthenticated = !!identity;
	const disabled = loginStatus === 'logging-in';

	const handleAuth = async () => {
		if (isAuthenticated) {
			await clear();
			queryClient.clear();
			onNavigate('home');
		} else {
			try {
				await login();
			} catch (error: any) {
				console.error('Login error:', error);
				if (error.message === 'User is already authenticated') {
					await clear();
					setTimeout(() => login(), 300);
				}
			}
		}
	};

	const navItems: { label: string; page: Page; authRequired?: boolean; icon?: React.ReactNode }[] =
		[
			{ label: 'Home', page: 'home' },
			{ label: 'Markets', page: 'markets' },
			{ label: 'Rush', page: 'rush', authRequired: true, icon: <Zap className="h-4 w-4" /> },
			{ label: 'Portfolio', page: 'portfolio', authRequired: true },
			{ label: 'Wallet', page: 'wallet', authRequired: true, icon: <Wallet className="h-4 w-4" /> },
			{ label: 'Leaderboard', page: 'leaderboard' },
			{ label: 'Learn', page: 'learn' }
		];

	return (
		<header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
			<div className="container mx-auto px-4">
				<div className="flex h-16 items-center justify-between">
					{/* Logo */}
					<button
						onClick={() => onNavigate('home')}
						className="flex items-center space-x-2 transition-opacity hover:opacity-80"
					>
						<img
							src="/assets/vici-coin-logo-transparent.dim_200x200.png"
							alt="Vici"
							className="h-8 w-8"
						/>
						<span className="text-primary text-xl font-bold">Vici</span>
					</button>

					{/* Desktop Navigation */}
					<nav className="hidden items-center space-x-1 md:flex">
						{navItems.map((item) => {
							if (item.authRequired && !isAuthenticated) return null;
							return (
								<Button
									key={item.page}
									variant={currentPage === item.page ? 'default' : 'ghost'}
									onClick={() => onNavigate(item.page)}
									className="flex items-center gap-2"
								>
									{item.icon}
									{item.label}
								</Button>
							);
						})}
						{isAdmin && (
							<Button
								variant={currentPage === 'admin' ? 'default' : 'ghost'}
								onClick={() => onNavigate('admin')}
							>
								<Shield className="mr-2 h-4 w-4" />
								Admin
							</Button>
						)}
					</nav>

					{/* User Section */}
					<div className="flex items-center space-x-4">
						{isAuthenticated && userProfile && (
							<div className="bg-primary/10 text-primary hidden items-center space-x-2 rounded-full px-3 py-1.5 font-semibold md:flex">
								<span className="text-lg">Ꝟ</span>
								<span>{Number(userProfile.balance).toLocaleString()}</span>
							</div>
						)}

						{isAuthenticated ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" className="relative h-10 w-10 rounded-full">
										<Avatar className="h-10 w-10">
											<AvatarImage src={userProfile?.avatar} alt={userProfile?.nickname} />
											<AvatarFallback>
												{userProfile?.nickname?.charAt(0).toUpperCase() || 'U'}
											</AvatarFallback>
										</Avatar>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-56">
									<DropdownMenuItem onClick={() => onNavigate('profile')}>
										<User className="mr-2 h-4 w-4" />
										Profile
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleAuth}>
										<LogOut className="mr-2 h-4 w-4" />
										Logout
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							<Button onClick={handleAuth} disabled={disabled}>
								{disabled ? 'Connecting...' : 'Login'}
							</Button>
						)}

						{/* Mobile Menu Button */}
						<Button
							variant="ghost"
							size="icon"
							className="md:hidden"
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						>
							{mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
						</Button>
					</div>
				</div>

				{/* Mobile Navigation */}
				{mobileMenuOpen && (
					<nav className="border-border space-y-2 border-t py-4 md:hidden">
						{navItems.map((item) => {
							if (item.authRequired && !isAuthenticated) return null;
							return (
								<Button
									key={item.page}
									variant={currentPage === item.page ? 'default' : 'ghost'}
									onClick={() => {
										onNavigate(item.page);
										setMobileMenuOpen(false);
									}}
									className="flex w-full items-center justify-start gap-2"
								>
									{item.icon}
									{item.label}
								</Button>
							);
						})}
						{isAdmin && (
							<Button
								variant={currentPage === 'admin' ? 'default' : 'ghost'}
								onClick={() => {
									onNavigate('admin');
									setMobileMenuOpen(false);
								}}
								className="w-full justify-start"
							>
								<Shield className="mr-2 h-4 w-4" />
								Admin
							</Button>
						)}
						{isAuthenticated && userProfile && (
							<div className="bg-primary/10 text-primary flex items-center justify-center space-x-2 rounded-full px-3 py-2 font-semibold">
								<span className="text-lg">Ꝟ</span>
								<span>{Number(userProfile.balance).toLocaleString()}</span>
							</div>
						)}
					</nav>
				)}
			</div>
		</header>
	);
}
