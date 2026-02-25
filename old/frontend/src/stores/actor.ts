import { writable, get } from 'svelte/store';
import { identity } from './auth';
import type { backendInterface } from '../backend';
import { createActorWithConfig } from '../config';

function createActorStore() {
	const { subscribe, set } = writable<{
		actor: backendInterface | null;
		isFetching: boolean;
	}>({
		actor: null,
		isFetching: false
	});

	async function initialize() {
		set({ actor: null, isFetching: true });
		const currentIdentity = get(identity);

		try {
			const actorOptions = currentIdentity
				? {
						agentOptions: {
							identity: currentIdentity
						}
					}
				: undefined;

			const actor = await createActorWithConfig(actorOptions);
			await actor.initializeAccessControl();
			set({ actor, isFetching: false });
		} catch (error) {
			console.error('Failed to initialize actor:', error);
			set({ actor: null, isFetching: false });
		}
	}

	// Initialize when identity changes
	identity.subscribe(() => {
		initialize();
	});

	return {
		subscribe,
		initialize
	};
}

export const backend = createActorStore();
