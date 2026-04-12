import type { NicknameSchema, UserProfileSchema } from '$lib/schema/profile.schema';
import type { j } from '@junobuild/schema';

export type Nickname = j.infer<typeof NicknameSchema>;

export type UserProfile = j.infer<typeof UserProfileSchema>;
