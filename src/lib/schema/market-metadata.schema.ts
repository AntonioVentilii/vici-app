import { MarketEventDirection, MarketWhyNowKind } from '$lib/enums/market-metadata';
import { j, PrincipalTextSchema } from '@junobuild/schema';

export const MarketWhyNowKindSchema = j.enum(MarketWhyNowKind);
export const MarketEventDirectionSchema = j.enum(MarketEventDirection);

export const MarketWhyNowSchema = j.strictObject({
	kind: MarketWhyNowKindSchema,
	text: j.string()
});

export const MarketEventSchema = j.strictObject({
	day: j.number(),
	label: j.string(),
	dir: MarketEventDirectionSchema
});

export const MarketMetadataInputSchema = j.strictObject({
	whyNow: MarketWhyNowSchema.optional(),
	events: j.array(MarketEventSchema).default([]),
	tags: j.array(j.string()).default([]),
	suggested: j.boolean().default(false)
});

export const MarketMetadataSchema = j.strictObject({
	seriesId: j.string(),
	whyNow: MarketWhyNowSchema.optional(),
	events: j.array(MarketEventSchema).default([]),
	tags: j.array(j.string()).default([]),
	suggested: j.boolean().default(false),
	updatedAt: j.number(),
	updatedBy: PrincipalTextSchema
});

export const UpsertMarketMetadataArgsSchema = j.strictObject({
	seriesId: j.string(),
	data: MarketMetadataInputSchema
});

export const GetMarketMetadataArgsSchema = j.strictObject({
	seriesId: j.string()
});
