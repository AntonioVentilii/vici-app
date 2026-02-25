<script lang="ts">
	import { auth, isAuthenticated, loginStatus } from '../stores/auth';
	import { userProfile, isAdmin } from '../stores/profile';
	import Button from './ui/Button.svelte';
	import Avatar from './ui/Avatar.svelte';
	import { Menu, X, User, LogOut, Shield, Zap, Wallet } from 'lucide-svelte';
	import { cn } from '../lib/utils';

	export let currentPage: string;
	export let onNavigate: (page: string) => void;

	let mobileMenuOpen = false;
	let dropdownOpen = false;

	$: disabled = $loginStatus === 'logging-in';

	const handleAuth = async () => {
		if ($isAuthenticated) {
			await auth.clear();
			onNavigate('home');
		} else {
			try {
				await auth.login();
			} catch (error) {
				console.error('Login error:', error);
			}
		}
	};

	const navItems = [
		{ label: 'Home', page: 'home' },
		{ label: 'Markets', page: 'markets' },
		{ label: 'Rush', page: 'rush', authRequired: true, icon: Zap },
		{ label: 'Portfolio', page: 'portfolio', authRequired: true },
		{ label: 'Wallet', page: 'wallet', authRequired: true, icon: Wallet },
		{ label: 'Leaderboard', page: 'leaderboard' },
		{ label: 'Learn', page: 'learn' }
	];
</script>

<header
	class="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur"
>
	<div class="container mx-auto px-4">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo -->
			<button
				on:click={() => onNavigate('home')}
				class="flex items-center space-x-2 transition-opacity hover:opacity-80"
			>
				<img src="/assets/vici-coin-logo-transparent.dim_200x200.png" alt="Vici" class="h-8 w-8" />
				<span class="text-primary text-xl font-bold">Vici</span>
			</button>

			<!-- Desktop Navigation -->
			<nav class="hidden items-center space-x-1 md:flex">
				{#each navItems as item}
					{#if !item.authRequired || $isAuthenticated}
						<Button
							variant={currentPage === item.page ? 'default' : 'ghost'}
							on:click={() => onNavigate(item.page)}
							className="flex items-center gap-2"
						>
							{#if item.icon}
								<svelte:component this={item.icon} size={16} />
							{/if}
							{item.label}
						</Button>
					{/if}
				{/each}
				{#if $isAdmin}
					<Button
						variant={currentPage === 'admin' ? 'default' : 'ghost'}
						on:click={() => onNavigate('admin')}
						className="flex items-center gap-2"
					>
						<Shield size={16} />
						Admin
					</Button>
				{/if}
			</nav>

			<!-- User Section -->
			<div class="flex items-center space-x-4">
				{#if $isAuthenticated && $userProfile?.profile}
					<div
						class="bg-primary/10 text-primary hidden items-center space-x-2 rounded-full px-3 py-1.5 font-semibold md:flex"
					>
						<span class="text-lg">Ꝟ</span>
						<span>{Number($userProfile.profile.balance).toLocaleString()}</span>
					</div>
				{/if}

				{#if $isAuthenticated}
					<div class="relative">
						<button
							class="border-border relative h-10 w-10 overflow-hidden rounded-full border"
							on:click={() => (dropdownOpen = !dropdownOpen)}
						>
							<Avatar
								src={$userProfile?.profile?.avatar}
								alt={$userProfile?.profile?.nickname}
								fallback={$userProfile?.profile?.nickname?.charAt(0).toUpperCase() || 'U'}
							/>
						</button>

						{#if dropdownOpen}
							<div
								class="border-border bg-popover text-popover-foreground absolute right-0 z-50 mt-2 w-56 rounded-md border shadow-md"
							>
								<div class="py-1">
									<button
										class="hover:bg-accent hover:text-accent-foreground flex w-full items-center px-4 py-2 text-sm"
										on:click={() => {
											onNavigate('profile');
											dropdownOpen = false;
										}}
									>
										<User size={16} class="mr-2" />
										Profile
									</button>
									<button
										class="hover:bg-accent hover:text-accent-foreground text-destructive flex w-full items-center px-4 py-2 text-sm"
										on:click={() => {
											handleAuth();
											dropdownOpen = false;
										}}
									>
										<LogOut size={16} class="mr-2" />
										Logout
									</button>
								</div>
							</div>
							<!-- Click outside handler -->
							<div class="fixed inset-0 z-40" on:click={() => (dropdownOpen = false)}></div>
						{/if}
					</div>
				{:else}
					<Button on:click={handleAuth} {disabled}>
						{disabled ? 'Connecting...' : 'Login'}
					</Button>
				{/if}

				<!-- Mobile Menu Button -->
				<Button
					variant="ghost"
					size="icon"
					className="md:hidden"
					on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
				>
					{#if mobileMenuOpen}
						<svelte:component this={X} size={24} />
					{:else}
						<svelte:component this={Menu} size={24} />
					{/if}
				</Button>
			</div>
		</div>

		<!-- Mobile Navigation -->
		{#if mobileMenuOpen}
			<nav class="border-border space-y-2 border-t py-4 md:hidden">
				{#each navItems as item}
					{#if !item.authRequired || $isAuthenticated}
						<Button
							variant={currentPage === item.page ? 'default' : 'ghost'}
							on:click={() => {
								onNavigate(item.page);
								mobileMenuOpen = false;
							}}
							className="w-full justify-start flex items-center gap-2"
						>
							{#if item.icon}
								<svelte:component this={item.icon} size={16} />
							{/if}
							{item.label}
						</Button>
					{/if}
				{/each}
				{#if $isAdmin}
					<Button
						variant={currentPage === 'admin' ? 'default' : 'ghost'}
						on:click={() => {
							onNavigate('admin');
							mobileMenuOpen = false;
						}}
						className="w-full justify-start"
					>
						<Shield size={16} class="mr-2" />
						Admin
					</Button>
				{/if}
				{#if $isAuthenticated && $userProfile?.profile}
					<div
						class="bg-primary/10 text-primary flex items-center justify-center space-x-2 rounded-full px-3 py-2 font-semibold"
					>
						<span class="text-lg">Ꝟ</span>
						<span>{Number($userProfile.profile.balance).toLocaleString()}</span>
					</div>
				{/if}
			</nav>
		{/if}
	</div>
</header>
