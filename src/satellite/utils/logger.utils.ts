import { isNullish } from '@dfinity/utils';

const LOG_PREFIX = '[satellite]';

export const logInfo = ({
	message,
	detail
}: {
	message: string;
	detail?: Record<string, string | number | bigint | boolean>;
}): void => {
	const suffix = isNullish(detail)
		? ''
		: ` ${Object.entries(detail)
				.map(([k, v]) => `${k}=${typeof v === 'bigint' ? v.toString() : v}`)
				.join(' ')}`;

	// eslint-disable-next-line no-console
	console.log(`${LOG_PREFIX} ${message}${suffix}`);
};

export const logError = ({
	message,
	detail
}: {
	message: string;
	detail?: Record<string, string | number | bigint | boolean>;
}): void => {
	const suffix = isNullish(detail)
		? ''
		: ` ${Object.entries(detail)
				.map(([k, v]) => `${k}=${typeof v === 'bigint' ? v.toString() : v}`)
				.join(' ')}`;

	console.error(`${LOG_PREFIX} ${message}${suffix}`);
};
