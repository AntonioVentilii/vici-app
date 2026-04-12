import type { CanisterOptions } from '@dfinity/utils';
import type { Principal } from '@icp-sdk/core/principal';
import { PrincipalTextSchema } from '@junobuild/schema';
import type * as z from 'zod';

export const CanisterIdTextSchema = PrincipalTextSchema;

export type CanisterIdText = z.infer<typeof CanisterIdTextSchema>;

export interface CreateCanisterOptions<T> extends Omit<CanisterOptions<T>, 'canisterId'> {
	canisterId: Principal;
}
