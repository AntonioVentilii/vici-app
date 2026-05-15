const CATEGORY_COLORS: Record<string, string> = {
	macro: '#7EB6FF',
	crypto: '#F7931A',
	politics: '#FF6B6B',
	tech: '#B49CFF',
	sports: '#6FE0B6',
	culture: '#FFB066'
};

export const categoryColor = (category: string): string =>
	CATEGORY_COLORS[category.toLowerCase()] ?? '#E2B842';
