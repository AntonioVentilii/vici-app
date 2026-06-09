/**
 * Spanish (Argentina) — landing deltas over the LatAm base.
 *
 * Partial `soon` catalog: only the `welcome.*` keys whose copy differs from
 * `es-419` are declared here (consistent rioplatense voseo, "palpitar/la
 * pega/sin vueltas" idiom). Everything else resolves through the fallback
 * chain (`es-419` → `es` → `en`).
 */
export const esArMessages: Record<string, string> = {
	'welcome.close.cta': 'Empezá a predecir — gratis',
	'welcome.close.headline': 'Se viene el Mundial. Palpitalo antes de que pase.',
	'welcome.hero.cta': 'Hacé tu primera predicción',
	'welcome.hero.cta_note': 'Gratis. Sin tarjeta. Sin vueltas.',
	'welcome.hero.headline': 'Ese “te lo dije”, ahora con pruebas.',
	'welcome.hero.hint': 'Deslizá la carta — izquierda no, derecha sí',
	'welcome.hero.kicker': 'Mundial FIFA 2026 · en vivo',
	'welcome.hero.payoff_cta': 'Registrate ahora',
	'welcome.hero.sub':
		'El juego de pronósticos del Mundial, gratis. Armá una liga con tus amigos, palpitá todo el torneo y mirá quién la pega.',
	'welcome.how.s1': 'Deslizá una predicción real',
	'welcome.how.s3': 'Subí en la tabla',
	'welcome.proof.label': '¿Vos dónde quedás?',
	'welcome.proof.live': 'personas están palpitando el Mundial ahora mismo.',
	'welcome.status.body':
		'Cada predicción queda en tu historial. Acertá y subís — más allá de tu grupo, tu ciudad, el mundo. A la tabla no le importa quién grita más fuerte. Solo quién la pega más seguido.',
	'welcome.trust.band': 'Sin banca. Sin ventaja. Todo se resuelve con datos públicos.'
} as const;
