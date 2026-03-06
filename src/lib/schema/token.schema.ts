import * as z from 'zod';

export const TokenIdSchema = z.symbol().brand<'TokenId'>();

const TokenMetadataSchema = z.object({
	symbol: z.string(),
	decimals: z.number()
});

export const TokenSchema = z.object({
	id: TokenIdSchema,
	...TokenMetadataSchema.shape,
	ledgerCanisterId: z.string()
});
