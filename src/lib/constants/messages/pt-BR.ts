// Brazilian Portuguese is a `soon` locale with a deliberately partial
// catalog: it carries only the landing `welcome.*` keys where the Brazilian
// voice diverges from the European Portuguese base (`pt`). Every other key —
// and every landing key that already reads the same in both — falls back
// through the registered chain (`pt-BR` → `pt` → `en`), so this file stays a
// thin delta rather than a full duplicate of `pt`.
export const ptBRMessages = {
	'welcome.faq.a1':
		'Sim. O modo de jogo é totalmente grátis — sem cartão, sem depósito, sem assinatura. O VXP é uma moeda de puro gameplay que registra a precisão; não dá pra resgatar e não é dinheiro. Os mercados com dinheiro de verdade, quando chegarem, serão opcionais e claramente sinalizados.',
	'welcome.faq.a2':
		'Centenas de perguntas sobre macro, cripto, política, tech, esportes e cultura. Além de mercados de torneios ao vivo — a Copa do Mundo 2026 vai até julho com mercados de avanço por seleção, mata-mata e campeão. Cada pergunta resolve numa fonte pública.',
	'welcome.faq.a3':
		'Palpites resolvidos divididos pelo total de palpites resolvidos. Palpites em aberto não contam até um mercado fechar. A precisão é a unidade da sua reputação — na classificação global, na sua liga privada e em qualquer Battle de que você participe.',
	'welcome.faq.a4':
		'No modo de jogo, não. O VICI é grátis. A plataforma ganha com mercados de dinheiro de verdade (quando chegarem), patrocínios de ligas e parcerias de torneios. Seus dados de precisão são seus — não vendemos.',
	'welcome.faq.a5':
		'Servidores na União Europeia. Criptografados em repouso e em trânsito. Guardamos um token de sessão; não usamos cookies de rastreamento. Você pode exportar ou apagar seus dados quando quiser.',
	'welcome.faq.a6':
		'Um confronto de precisão cronometrado entre duas ligas, ou entre universidades num torneio. Janela de sete dias, os dois lados precisam de um mínimo de palpites pra se qualificar, vence a liga com a maior precisão média.',
	'welcome.faq.contact_prefix': 'Mais perguntas? Escreva pra',
	'welcome.faq.contact_suffix': '— respondemos em dois dias úteis.',
	'welcome.faq.q1': 'O VICI é grátis?',
	'welcome.faq.q2': 'Sobre o que posso palpitar?',
	'welcome.faq.q3': 'Como minha precisão é classificada?',
	'welcome.faq.q4': 'Vocês ganham dinheiro com meus palpites?',
	'welcome.faq.q6': 'O que é um Battle?',
	'welcome.faq.sub': 'O que todo novo usuário pergunta antes do primeiro palpite.',
	'welcome.faq.title_b': 'que valem a pena.',
	'welcome.hero.card_meta': '{pct}% dizem que SIM',
	'welcome.hero.sub':
		'O jogo de palpites da Copa, de graça. Junte a galera numa liga, palpite o torneio inteiro e veja quem acerta.',
	'welcome.universities.fifa_tag': 'COPA DO MUNDO FIFA 2026'
} as const;
