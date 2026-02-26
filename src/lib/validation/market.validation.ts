import { MarketIdSchema } from '$lib/schema/market.schema';
import type { MarketId } from '$lib/types/market';
import * as z from 'zod';

const MarketIdStringSchema = z.string();

export const parseMarketId = (marketIdString: z.infer<typeof MarketIdStringSchema>): MarketId => {
	const validString = MarketIdStringSchema.parse(marketIdString);
	return MarketIdSchema.parse(Symbol(validString));
};
