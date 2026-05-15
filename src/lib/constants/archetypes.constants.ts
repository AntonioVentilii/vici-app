export interface Archetype {
	id: string;
	name: string;
	description: string;
	accent: string;
	tag: string;
}

export const ARCHETYPES: Archetype[] = [
	{
		id: 'strategist',
		name: 'Strategist',
		description: 'Calculates the field. High-conviction, low-volume.',
		accent: '#7EB6FF',
		tag: 'STRATEGIST'
	},
	{
		id: 'conservative',
		name: 'Conservative',
		description: 'Backs the consensus. Steady accuracy over time.',
		accent: '#6FE0B6',
		tag: 'CONSERVATIVE'
	},
	{
		id: 'bold',
		name: 'Bold predictor',
		description: 'Hunts upside. Goes against the crowd.',
		accent: '#FF8A4C',
		tag: 'BOLD'
	},
	{
		id: 'visionary',
		name: 'Visionary',
		description: 'Long-horizon. Sees what others miss.',
		accent: '#B49CFF',
		tag: 'VISIONARY'
	}
];

export const ARCHETYPE_MAP = new Map(ARCHETYPES.map((a) => [a.id, a]));
