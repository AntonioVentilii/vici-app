import { VICI_TOKEN, VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';

export const getTokenColorClasses = (symbol: string) => {
	if (symbol === 'ICP') {
		return 'bg-hold-wash text-hold';
	}

	if (symbol.startsWith('ck')) {
		return 'bg-yes-wash text-yes';
	}

	if (symbol === VXP_TOKEN.symbol || symbol === VICI_TOKEN.symbol) {
		return 'bg-laurel-glow text-primary';
	}

	return 'bg-foreground/8 text-foreground';
};
