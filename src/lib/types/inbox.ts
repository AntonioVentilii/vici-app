export type InboxNotificationKind =
	| 'resolve'
	| 'streak'
	| 'social'
	| 'challenge'
	| 'level'
	| 'market'
	| 'friend_request'
	| 'battle_incoming'
	| 'battle_accepted'
	| 'battle_declined';

export interface InboxNotification {
	id: string;
	kind: InboxNotificationKind;
	title: string;
	body: string;
	when: string;
	unread: boolean;
	/**
	 * Optional market id the notification deep-links to. Resolution and
	 * challenge notifications carry the market they concern; the tap router
	 * routes to that market's detail (`notificationDestination`). When absent
	 * the kind's default destination is used instead.
	 */
	mid?: string;
	/**
	 * Optional explicit in-app URL the notification should navigate to when
	 * clicked. Takes precedence over `mid` and the kind default. When all
	 * three are absent the card still routes to the kind's home surface.
	 */
	href?: string;
}
