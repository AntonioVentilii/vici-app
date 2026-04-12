import type { RelationSchema } from '$lib/schema/relation.schema';
import type { j } from '@junobuild/schema';

export type Relation = j.infer<typeof RelationSchema>;
