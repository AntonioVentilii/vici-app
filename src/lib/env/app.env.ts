const viteEnv = (): ImportMetaEnv | undefined =>
	typeof import.meta !== 'undefined' ? (import.meta as ImportMeta & { env?: ImportMetaEnv }).env : undefined;

export const isSkylab = (): boolean => viteEnv()?.MODE === 'skylab';
export const isNotSkylab = (): boolean => !isSkylab();

export const isDev = (): boolean => viteEnv()?.DEV === true || isSkylab();

export const isProd = (): boolean => viteEnv()?.PROD === true;
