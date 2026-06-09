/**
 * Spanish (Mexico) — landing deltas over the LatAm base.
 *
 * Partial `soon` catalog: only the `welcome.*` keys whose copy differs from
 * `es-419` are declared here (Mexican tuteo, "pronóstico/atínale" register,
 * the local hero card). Everything else resolves through the fallback chain
 * (`es-419` → `es` → `en`).
 */
export const esMxMessages = {
	'welcome.close.cta': 'Empieza a pronosticar — gratis',
	'welcome.close.headline': 'Ya viene el Mundial. Pronostícalo antes de que pase.',
	'welcome.hero.card_q': '¿México llega al quinto partido?',
	'welcome.hero.cta': 'Haz tu primer pronóstico',
	'welcome.hero.cta_note': 'Gratis. Sin tarjeta. Sin trucos.',
	'welcome.hero.headline': 'Tu “te lo dije”, ahora con pruebas.',
	'welcome.hero.kicker': 'Mundial FIFA 2026® · en vivo',
	'welcome.hero.sub':
		'El juego de pronósticos del Mundial, gratis. Arma una liga con tus amigos, atínale a todo el torneo y mira quién la rifa.',
	'welcome.proof.live': 'personas están pronosticando el Mundial ahorita.',
	'welcome.status.body':
		'Cada pronóstico queda en tu historial. Atínale y subes — más allá de tu chat, tu ciudad, el mundo entero. A la tabla no le importa quién grita más fuerte. Solo quién le atina más.',
	'welcome.status.headline': 'Opinar, cualquiera. Atinarle, pocos.'
} as const;
