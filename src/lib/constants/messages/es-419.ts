/**
 * Spanish (Latin America) — neutral LatAm landing copy.
 *
 * Partial `soon` catalog: only the landing `welcome.*` keys diverge here,
 * giving the LatAm tier its own regional hero card and voice. Every other
 * key resolves through the fallback chain (`es` → `en`). True-neutral tuteo,
 * safe as the floor every LatAm region (`es-MX`, `es-AR`, `es-CO`, …) backs
 * onto; intentionally flavour-neutral rather than country-specific.
 */
export const es419Messages = {
	'welcome.close.cta': 'Empieza a predecir — gratis',
	'welcome.close.headline': 'Ya viene el Mundial. Predícelo antes de que pase.',
	'welcome.hero.card_meta': '{pct}% dice que SÍ',
	'welcome.hero.card_q': '¿Argentina sale bicampeón del Mundial 2026?',
	'welcome.hero.cta': 'Haz tu primera predicción',
	'welcome.hero.cta_note': 'Gratis. Sin tarjeta. Sin trampa.',
	'welcome.hero.headline': 'Que tu “te lo dije” tenga pruebas.',
	'welcome.hero.hint': 'Desliza la carta — izquierda no, derecha sí',
	'welcome.hero.kicker': 'Copa del Mundo FIFA 2026® · en vivo',
	'welcome.hero.payoff': 'Hora de desafiar a tus amigos.',
	'welcome.hero.payoff_cta': 'Regístrate ahora',
	'welcome.how.s1': 'Desliza una predicción real',
	'welcome.how.s2': 'Se resuelve con datos públicos',
	'welcome.how.s3': 'Sube en la tabla',
	'welcome.proof.label': '¿Y tú dónde quedas?',
	'welcome.proof.live': 'personas están prediciendo el Mundial ahora mismo.',
	'welcome.status.body':
		'Cada predicción queda en tu historial. Acierta y subes — más allá de tu grupo, tu ciudad, el mundo. A la tabla no le importa quién grita más. Solo quién acierta más.',
	'welcome.status.headline': 'Opinar puede cualquiera. Tener razón, pocos.',
	'welcome.status.kicker': 'La precisión es estatus',
	'welcome.trust.band': 'Sin casa. Sin ventaja. Todo se resuelve con datos públicos.'
} as const;
