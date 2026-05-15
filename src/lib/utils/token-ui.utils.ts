import { VICI_TOKEN, VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';

export const getTokenColorClasses = (symbol: string) => {
	if (symbol === 'ICP') {
		return 'bg-[var(--hold-wash)] text-[var(--hold)]';
	}

	if (symbol.startsWith('ck')) {
		return 'bg-[var(--yes-wash)] text-[var(--yes)]';
	}

	if (symbol === VXP_TOKEN.symbol || symbol === VICI_TOKEN.symbol) {
		return 'bg-[var(--laurel-glow)] text-primary';
	}

	return 'bg-foreground/8 text-foreground';
};
