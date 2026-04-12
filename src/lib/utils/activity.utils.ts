import { ActivityType } from '$lib/enums/social';

export const getActivityIcon = (type: ActivityType) => {
	switch (type) {
		case ActivityType.TRADE:
			return '📈';
		case ActivityType.SETTLEMENT:
			return '🏁';
		case ActivityType.COMMENT:
			return '💬';
		case ActivityType.FOLLOW:
			return '👤';
		default:
			return '📍';
	}
};
