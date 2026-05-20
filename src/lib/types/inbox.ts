export type InboxNotificationKind =
	| 'resolve'
	| 'streak'
	| 'social'
	| 'challenge'
	| 'level'
	| 'market';

export interface InboxNotification {
	id: string;
	kind: InboxNotificationKind;
	title: string;
	body: string;
	when: string;
	unread: boolean;
}
