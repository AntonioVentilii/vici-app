import { AppPath } from '$lib/constants/routes.constants';
import type { NavItem } from '$lib/types/nav';
import {
	Briefcase,
	CircleUserRound,
	House,
	LayoutDashboard,
	Shield,
	Zap
} from 'lucide-svelte/icons';

export const navItems: NavItem[] = [
	{ label: 'Markets', path: AppPath.Home, mobileIcon: House },
	{ label: 'Portfolio', path: AppPath.Portfolio, mobileIcon: Briefcase },
	{ label: 'Flow', path: AppPath.Flow, mobileIcon: Zap, icon: Zap },
	{ label: 'Leaders', path: AppPath.Leaderboard, mobileIcon: LayoutDashboard },
	{ label: 'Profile', path: AppPath.Profile, mobileIcon: CircleUserRound },
	{ label: 'Admin', path: AppPath.Admin, mobileIcon: Shield, icon: Shield, adminOnly: true }
];
