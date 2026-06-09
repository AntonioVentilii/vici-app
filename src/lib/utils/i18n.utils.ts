import { localeFallbackChain, type AppLocale } from '$lib/constants/locale.constants';
import { deMessages } from '$lib/constants/messages/de';
import { enMessages } from '$lib/constants/messages/en';
import { esMessages } from '$lib/constants/messages/es';
import { es419Messages } from '$lib/constants/messages/es-419';
import { esArMessages } from '$lib/constants/messages/es-AR';
import { esMxMessages } from '$lib/constants/messages/es-MX';
import { frMessages } from '$lib/constants/messages/fr';
import { itMessages } from '$lib/constants/messages/it';
import { ptMessages } from '$lib/constants/messages/pt';
import { ptBRMessages } from '$lib/constants/messages/pt-BR';
import { zhHansMessages } from '$lib/constants/messages/zh-Hans';
import { nonNullish } from '@dfinity/utils';

/**
 * Catalogs we ship today. A `soon` locale may be absent here (no catalog
 * at all), present with a *partial* catalog that defines only the keys
 * where it diverges from its fallback (e.g. the `es-419` landing deltas),
 * or present with a *full* catalog (e.g. `pt-BR`, which today mirrors the
 * Brazilian-voiced `pt` strings verbatim). In every case `t()` resolves any
 * missing key through the locale's fallback chain to a populated locale,
 * ending at `en`.
 */
const catalogs: Partial<Record<AppLocale, Record<string, string>>> = {
	en: enMessages,
	it: itMessages,
	es: esMessages,
	'es-419': es419Messages,
	'es-MX': esMxMessages,
	'es-AR': esArMessages,
	de: deMessages,
	fr: frMessages,
	pt: ptMessages,
	'pt-BR': ptBRMessages,
	'zh-Hans': zhHansMessages
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
	// Walk the locale's fallback chain (itself → registered fallbacks → en)
	// and take the first catalog that actually carries the key. A `soon`
	// locale with no catalog, or a partial one missing this key, renders the
	// first populated ancestor's copy — never the raw key.
	for (const candidate of localeFallbackChain(locale)) {
		const template = catalogs[candidate]?.[key];

		if (nonNullish(template)) {
			return interpolate({ template, params });
		}
	}

	return interpolate({ template: enMessages[key] ?? key, params });
};
