export type InboxNotificationKind =
	| 'resolve'
	| 'streak'
	| 'social'
	| 'challenge'
	| 'level'
	| 'market'
	| 'friend_request';

export interface InboxNotification {
	id: string;
	kind: InboxNotificationKind;
	title: string;
	body: string;
	when: string;
	unread: boolean;
	/**
	 * Optional in-app URL the notification should navigate to when clicked.
	 * When absent the card renders as a non-interactive surface.
	 */
	href?: string;
}
