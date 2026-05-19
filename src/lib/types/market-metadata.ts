import type {
	MarketEventSchema,
	MarketMetadataInputSchema,
	MarketMetadataSchema,
	MarketResolutionMetadataSchema,
	MarketWhyNowSchema
} from '$lib/schema/market-metadata.schema';
import type { j } from '@junobuild/schema';

export type MarketWhyNow = j.infer<typeof MarketWhyNowSchema>;
export type MarketEvent = j.infer<typeof MarketEventSchema>;
export type MarketResolutionMetadata = j.infer<typeof MarketResolutionMetadataSchema>;
export type MarketMetadataInput = j.infer<typeof MarketMetadataInputSchema>;
export type MarketMetadata = j.infer<typeof MarketMetadataSchema>;
