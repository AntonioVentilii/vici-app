import type { MessageKey } from '$lib/utils/i18n.utils';

export type WelcomeSocialAvatarTone = 'laurel' | 'yes' | 'primary' | 'no' | 'hold' | 'ink';

export interface WelcomeLeaderboardUser {
	readonly rank: number;
	readonly name: string;
	readonly initials: string;
	readonly streak: number;
	readonly xp: number;
	readonly accuracy: number;
	readonly tone: WelcomeSocialAvatarTone;
}

export interface WelcomeTestimonial {
	readonly name: string;
	readonly initials: string;
	readonly streak: number;
	readonly rank: number;
	readonly accuracy: number;
	readonly quoteKey: MessageKey;
	readonly tone: WelcomeSocialAvatarTone;
}

export const WELCOME_SOCIAL_PREDICTOR_COUNT = 184210;

export const WELCOME_SOCIAL_START_RANK = 38210;

export const WELCOME_SOCIAL_TOP_ACCURACY = 0.8;

export const WELCOME_SOCIAL_LEADERBOARD: readonly WelcomeLeaderboardUser[] = [
	{
		rank: 1,
		name: 'augustus.eth',
		initials: 'AE',
		streak: 42,
		xp: 48200,
		accuracy: 0.821,
		tone: 'laurel'
	},
	{
		rank: 2,
		name: 'cassandra',
		initials: 'CA',
		streak: 21,
		xp: 44100,
		accuracy: 0.804,
		tone: 'yes'
	},
	{
		rank: 3,
		name: 'marcus',
		initials: 'MA',
		streak: 18,
		xp: 38900,
		accuracy: 0.792,
		tone: 'primary'
	},
	{
		rank: 4,
		name: 'lydia',
		initials: 'LY',
		streak: 16,
		xp: 33100,
		accuracy: 0.781,
		tone: 'no'
	},
	{
		rank: 5,
		name: 'seneca',
		initials: 'SE',
		streak: 14,
		xp: 28600,
		accuracy: 0.769,
		tone: 'hold'
	},
	{
		rank: 6,
		name: 'octavia',
		initials: 'OC',
		streak: 12,
		xp: 24800,
		accuracy: 0.756,
		tone: 'ink'
	}
] as const;

export const WELCOME_SOCIAL_TESTIMONIALS = [
	{
		name: 'cassandra',
		initials: 'CA',
		streak: 21,
		rank: 2,
		accuracy: 0.804,
		quoteKey: 'social.testimonial_hero_quote',
		tone: 'yes'
	},
	{
		name: 'augustus.eth',
		initials: 'AE',
		streak: 42,
		rank: 1,
		accuracy: 0.821,
		quoteKey: 'social.testimonial_secondary_quote',
		tone: 'laurel'
	}
] as const satisfies readonly [WelcomeTestimonial, WelcomeTestimonial];
