import type { AppLocale } from '$lib/constants/locale.constants';
import { enMessages } from '$lib/constants/messages/en';
import { itMessages } from '$lib/constants/messages/it';

const catalogs = {
	en: enMessages,
	it: itMessages
} as const;

export type MessageKey = keyof typeof enMessages;

export const t = ({ locale, key }: { locale: AppLocale; key: MessageKey }): string =>
	catalogs[locale][key] ?? catalogs.en[key];
