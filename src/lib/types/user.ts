import type { User } from '@junobuild/core';

export enum UserRole {
	ADMIN = 'admin',
	RESOLVER = 'resolver',
	CREATOR = 'creator'
}

export type UserOption = User | undefined | null;
