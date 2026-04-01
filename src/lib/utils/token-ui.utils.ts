import { VICI_TOKEN, VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';

export const getTokenColorClasses = (symbol: string) => {
	if (symbol === 'ICP') {
		return 'bg-indigo-100 text-indigo-600';
	}

	if (symbol.startsWith('ck')) {
		return 'bg-green-100 text-green-600';
	}

	if (symbol === VXP_TOKEN.symbol || symbol === VICI_TOKEN.symbol) {
		return 'bg-violet-100 text-violet-600';
	}

	return 'bg-slate-100 text-slate-600';
};
