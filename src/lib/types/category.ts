import type { PrincipalText } from '@junobuild/schema';

export interface Category {
	id: string;
	name: string;
	description?: string;
	icon?: string;
}

export interface SeriesCategory {
	seriesId: string; // Registry Series ID
	categoryId: string; // Vici Category ID
	associatedAt: number;
	associatedBy: PrincipalText; // Admin Principal string
}
