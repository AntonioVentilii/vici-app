import type { AppLocale } from '$lib/constants/locale.constants';
import { deMessages } from '$lib/constants/messages/de';
import { enMessages } from '$lib/constants/messages/en';
import { esMessages } from '$lib/constants/messages/es';
import { frMessages } from '$lib/constants/messages/fr';
import { itMessages } from '$lib/constants/messages/it';
import { ptMessages } from '$lib/constants/messages/pt';

const catalogs: Record<AppLocale, Record<string, string>> = {
	en: enMessages,
	it: itMessages,
	es: esMessages,
	de: deMessages,
	fr: frMessages,
	pt: ptMessages
};

export type MessageKey = keyof typeof enMessages;

const interpolate = ({
	template,
	params
}: {
	template: string;
	params?: Record<string, string | number>;
}): string => {
	if (!params) {
		return template;
	}

	return Object.entries(params).reduce(
		(value, [key, param]) => value.replaceAll(`{${key}}`, String(param)),
		template
	);
};

export const t = ({
	locale,
	key,
	params
}: {
	locale: AppLocale;
	key: MessageKey;
	params?: Record<string, string | number>;
}): string => {
	const catalog = catalogs[locale] ?? catalogs.en;
	const template = catalog[key] ?? catalogs.en[key] ?? key;

	return interpolate({ template, params });
};
