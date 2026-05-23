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
	{ labelKey: 'nav.markets', path: AppPath.Home, mobileIcon: House },
	{ labelKey: 'nav.portfolio', path: AppPath.Portfolio, mobileIcon: Briefcase },
	{ labelKey: 'nav.flow', path: AppPath.Flow, mobileIcon: Zap, icon: Zap },
	{ labelKey: 'nav.leaderboard', path: AppPath.Social, mobileIcon: LayoutDashboard },
	{ labelKey: 'nav.profile', path: AppPath.Profile, mobileIcon: CircleUserRound },
	{
		labelKey: 'nav.admin',
		path: AppPath.Admin,
		mobileIcon: Shield,
		icon: Shield,
		adminOnly: true
	}
];
