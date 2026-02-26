/* eslint-disable require-await */

import type { LeaderboardEntry } from '$lib/types/social';

export class SocialService {
	async addFriend(): Promise<void> {}

	async removeFriend(): Promise<void> {}

	async getLeaderboard(): Promise<LeaderboardEntry[]> {
		return [];
	}

	async getFriends(): Promise<string[]> {
		return [];
	}
}

export const socialService = new SocialService();
