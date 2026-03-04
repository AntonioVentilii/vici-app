import { getPositions } from '$lib/api/clearing.api';
import { Collection } from '$lib/constants/collections.constants';
import type { UserProfile } from '$lib/types/profile';
import type { UserRole } from '$lib/types/user';
import { isNullish } from '@dfinity/utils';
import type { PrincipalText } from '@dfinity/zod-schemas';
import type { Identity } from '@icp-sdk/core';
import { getDoc, listDocs, setDoc } from '@junobuild/core';

export const getProfile = async (principal: PrincipalText): Promise<UserProfile | undefined> => {
	const profileDoc = await getDoc<UserProfile>({
		collection: Collection.PROFILES,
		key: principal
	});

	if (isNullish(profileDoc)) {
		return;
	}

	const roleDoc = await getDoc<{ role: UserRole }>({
		collection: Collection.ROLES,
		key: principal
	});

	return {
		...profileDoc.data,
		role: roleDoc?.data.role
	};
};

export const upsertProfile = async (profile: UserProfile): Promise<void> => {
	await setDoc({
		collection: Collection.PROFILES,
		doc: {
			key: profile.owner,
			data: {
				...profile,
				updatedAt: Date.now()
			}
		}
	});
};

export const searchProfiles = async (query: string): Promise<UserProfile[]> => {
	const { items } = await listDocs<UserProfile>({
		collection: Collection.PROFILES
	});

	const lowerQuery = query.toLowerCase();

	return items
		.map((doc) => doc.data)
		.filter(
			(p) =>
				p.nickname.toLowerCase().includes(lowerQuery) || p.owner.toLowerCase().includes(lowerQuery)
		);
};

export const calculateAndSyncStats = async (identity: Identity): Promise<void> => {
	const principal = identity.getPrincipal().toText();
	const positions = await getPositions({ identity });

	let totalTrades = 0;
	let pnl = 0;
	let wins = 0;

	// This is a simplified mock calculation.
	// In a real app, we'd fetch trade history and settlement results.
	// For now, we derive some "stats" from open positions and mock history.
	totalTrades = positions.length;
	pnl = positions.reduce((acc, [_, pos]) => acc + Number(pos.locked_collateral), 0) / 1e8;
	wins = Math.floor(totalTrades * 0.6); // Mock 60% win rate

	const profile = await getProfile(principal);
	if (profile) {
		await upsertProfile({
			...profile,
			totalTrades,
			winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
			pnl
		});
	}
};
