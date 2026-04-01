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

	let score = 0;

	if (title.includes(query)) {
		score += 10;
	}

	if (description.includes(query)) {
		score += 5;
	}

	for (const term of terms) {
		if (title.includes(term)) {
			score += 3;
		}

		if (description.includes(term)) {
			score += 1;
		}
	}

	return score;
};
