import { AppPath } from '$lib/constants/routes.constants';
import type { NavItem } from '$lib/types/nav';
import { CircleUserRound, House, LayoutDashboard, Shield, Users, Zap } from 'lucide-svelte/icons';

/**
 * Bottom-nav structure. The five visible tabs map 1:1 onto the design
 * pill-nav (Markets · Dash · Flow · Social · Profile) with
 * Flow centered and styled as the primary action. Admin is admin-only
 * and hidden by default.
 *
 * Routes that don't have their own nav slot cascade active state to a
 * parent tab via `MobileNav.svelte`'s alias table:
 *
 *  - Markets ← /markets/[id]
 *  - Dash    ← /portfolio
 *  - Social  ← () /leagues, /worlds, /bouts, /tournament, leaderboard
 *  - Profile ← /wallet, /settings, /notifications, /friends
 */
export const navItems: NavItem[] = [
	{ labelKey: 'nav.markets', path: AppPath.Home, mobileIcon: House },
	{ labelKey: 'nav.dash', path: AppPath.Dash, mobileIcon: LayoutDashboard },
	{ labelKey: 'nav.flow', path: AppPath.Flow, mobileIcon: Zap, icon: Zap },
	{ labelKey: 'nav.social', path: AppPath.Social, mobileIcon: Users },
	{ labelKey: 'nav.profile', path: AppPath.Profile, mobileIcon: CircleUserRound },
	{
		labelKey: 'nav.admin',
		path: AppPath.Admin,
		mobileIcon: Shield,
		icon: Shield,
		adminOnly: true
	}
];
