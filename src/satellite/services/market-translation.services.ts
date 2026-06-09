import { Collection } from '$lib/constants/collections.constants';
import { SUPPORTED_LOCALES, type AppLocale } from '$lib/constants/locale.constants';
import type { MarketTranslation, MarketTranslationInput } from '$lib/types/market-translation';
import { isAdmin } from '$satellite/services/_authz';
import { isNullish } from '@dfinity/utils';
import { msgCaller, time } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
	encodeDocData,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

const callerText = (): string => msgCaller().toText();

const SUPPORTED_LOCALE_IDS: ReadonlySet<string> = new Set(SUPPORTED_LOCALES.map((l) => l.id));

/**
 * Schema-side `locale` is `j.string()` (see the schema for why), so validate
 * the value here against the canonical `SUPPORTED_LOCALES` list before we
 * persist or read.
 */
const assertSupportedLocale = (locale: string): AppLocale => {
	if (!SUPPORTED_LOCALE_IDS.has(locale)) {
		throw new Error(`Unsupported locale: ${locale}`);
	}

	return locale as AppLocale;
};

/**
 * Per-locale translation overlay key. The original on-chain text remains the
 * canonical source; this overlay is rendered when the user's locale has a
 * matching translation doc.
 */
const translationKey = ({ seriesId, locale }: { seriesId: string; locale: AppLocale }): string =>
	`${seriesId}__${locale}`;

const assertAdmin = (): void => {
	const caller = msgCaller();

	if (!isAdmin({ caller })) {
		throw new Error('Only an admin can edit market translations.');
	}
};

export const getMarketTranslation = ({
	seriesId,
	locale
}: {
	seriesId: string;
	locale: string;
}): MarketTranslation | undefined => {
	const validated = assertSupportedLocale(locale);
	const doc = getDocStore({
		collection: Collection.MARKET_TRANSLATIONS,
		key: translationKey({ seriesId, locale: validated }),
		caller: msgCaller()
	});

	return isNullish(doc) ? undefined : decodeDocData<MarketTranslation>(doc.data);
};

export const listMarketTranslations = ({ seriesId }: { seriesId: string }): MarketTranslation[] => {
	const { items } = listDocsStore({
		collection: Collection.MARKET_TRANSLATIONS,
		caller: msgCaller(),
		// `description = seriesId` is written by upsert; matcher.description is
		// a regex, so anchor it to avoid prefix collisions.
		params: {
			matcher: {
				description: `^${seriesId}$`
			}
		}
	});

	return items.map(([_, doc]) => decodeDocData<MarketTranslation>(doc.data));
};

export const upsertMarketTranslation = ({
	seriesId,
	locale,
	data
}: {
	seriesId: string;
	locale: string;
	data: MarketTranslationInput;
}): MarketTranslation => {
	assertAdmin();

	const validated = assertSupportedLocale(locale);
	const caller = msgCaller();
	const key = translationKey({ seriesId, locale: validated });
	const current = getDocStore({
		collection: Collection.MARKET_TRANSLATIONS,
		key,
		caller
	});

	const translation: MarketTranslation = {
		seriesId,
		locale: validated,
		title: data.title,
		description: data.description,
		resolution: data.resolution,
		outcomes: data.outcomes ?? [],
		updatedAt: Number(time() / 1_000_000n),
		updatedBy: callerText()
	};

	setDocStore({
		collection: Collection.MARKET_TRANSLATIONS,
		key,
		doc: {
			version: current?.version,
			description: seriesId,
			data: encodeDocData(translation)
		},
		caller
	});

	return translation;
};
