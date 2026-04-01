import { Collection } from '$lib/constants/collections.constants';
import { assertSetRole } from '$satellite/services/roles.services';
import {
	onProfileSetForVxpOnboarding,
	onTradeActivityForVxpOnboarding
} from '$satellite/services/vxp-onboarding.services';
import {
	defineAssert,
	defineHook,
	type AssertSetDoc,
	type OnSetDoc,
	type OnSetDocContext,
	type RunFunction
} from '@junobuild/functions';

const setDocCollections = [Collection.ACTIVITIES, Collection.PROFILES] as const;

type OnSetDocCollection = (typeof setDocCollections)[number];

export const onSetDoc = defineHook<OnSetDoc>({
	collections: setDocCollections,
	run: async (context) => {
		const fn: Record<OnSetDocCollection, RunFunction<OnSetDocContext>> = {
			[Collection.PROFILES]: onProfileSetForVxpOnboarding,
			[Collection.ACTIVITIES]: onTradeActivityForVxpOnboarding
		};

		await fn[context.data.collection]?.(context);
	}
});

export const assertSetDoc = defineAssert<AssertSetDoc>({
	collections: [Collection.ROLES],
	assert: assertSetRole
});
