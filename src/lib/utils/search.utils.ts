export const normalise = (value: string): string =>
	value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();

export const getSearchScore = ({
	market,
	searchTerm
}: {
	market: { title: string; description?: string };
	searchTerm: string;
}): number => {
	const query = normalise(searchTerm);

	if (query === '') {
		return 1;
	}

	const title = normalise(market.title);
	const description = normalise(market.description ?? '');
	const terms = query.split(/\s+/).filter(Boolean);

	const fullMatchScore = (title.includes(query) ? 10 : 0) + (description.includes(query) ? 5 : 0);

	const termsScore = terms.reduce(
		(acc, term) => acc + (title.includes(term) ? 3 : 0) + (description.includes(term) ? 1 : 0),
		0
	);

	return fullMatchScore + termsScore;
};
