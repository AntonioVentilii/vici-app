import * as z from 'zod';

export const TokenIdSchema = z.symbol().brand<'TokenId'>();

const TokenMetadataSchema = z.object({
	symbol: z.string(),
	decimals: z.number()
});

const TokenFeatureFlagsSchema = z.object({
	disabled: z.boolean().optional(),
	isDevEnabled: z.boolean().optional()
});

export const TokenSchema = z.object({
	id: TokenIdSchema,
	ledgerCanisterId: z.string(),
	...TokenMetadataSchema.shape,
	...TokenFeatureFlagsSchema.shape
});
