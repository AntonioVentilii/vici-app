import type { AppPath } from '$lib/constants/routes.constants';
import type {
	Briefcase,
	CircleUserRound,
	House,
	LayoutDashboard,
	Shield,
	Zap
} from 'lucide-svelte/icons';

export interface NavItem {
	label: string;
	path: AppPath;
	mobileIcon:
		| typeof House
		| typeof Zap
		| typeof LayoutDashboard
		| typeof Briefcase
		| typeof Shield
		| typeof CircleUserRound;
	icon?: typeof Zap | typeof Shield;
	adminOnly?: boolean;
}
