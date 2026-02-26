import { REPLICA_HOST } from '$lib/constants/app.constants';
import { isDev } from '$lib/env/app.env';
import { AgentManager } from '@dfinity/utils';

const agents = AgentManager.create({ fetchRootKey: isDev(), host: REPLICA_HOST });

export const { getAgent } = agents;
