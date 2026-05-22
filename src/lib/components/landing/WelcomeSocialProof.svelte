<script lang="ts">
	import LandingSectionHeader from '$lib/components/landing/LandingSectionHeader.svelte';
	import {
		WELCOME_SOCIAL_LEADERBOARD,
		WELCOME_SOCIAL_PREDICTOR_COUNT,
		WELCOME_SOCIAL_START_RANK,
		WELCOME_SOCIAL_TESTIMONIALS,
		WELCOME_SOCIAL_TOP_ACCURACY,
		type WelcomeSocialAvatarTone
	} from '$lib/constants/welcome-social.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import {
		formatLocaleCompactNumber as formatXp,
		formatLocaleNumber as formatNumber,
		formatLocalePercent as formatAccuracy
	} from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	const avatarClass = ({ tone }: { tone: WelcomeSocialAvatarTone }): string =>
		`welcome-social-avatar welcome-social-avatar--${tone}`;

	const [heroTestimonial, secondaryTestimonial] = WELCOME_SOCIAL_TESTIMONIALS;
</script>

<div class="welcome-section-inner">
	<LandingSectionHeader
		eyebrow={t({ locale: $localeStore, key: 'social.eyebrow' })}
		sub={t({ locale: $localeStore, key: 'social.sub' })}
		title={t({ locale: $localeStore, key: 'social.title_a' })}
		titleAccent={t({ locale: $localeStore, key: 'social.title_b' })}
	/>

	<div class="welcome-social-grid">
		<article class="welcome-social-card welcome-social-leaderboard">
			<header class="welcome-social-leaderboard-head">
				<p class="eyebrow acc">{t({ locale: $localeStore, key: 'social.global' })}</p>
				<p class="num welcome-social-predictors">
					{t({
						locale: $localeStore,
						key: 'social.predictors_count',
						params: {
							count: formatNumber({ value: WELCOME_SOCIAL_PREDICTOR_COUNT, locale: $localeStore })
						}
					})}
				</p>
			</header>

			<p class="welcome-social-aspire">
				{t({
					locale: $localeStore,
					key: 'social.aspire_line',
					params: {
						rank: `#${formatNumber({ value: WELCOME_SOCIAL_START_RANK, locale: $localeStore })}`,
						accuracy: formatAccuracy({
							value: WELCOME_SOCIAL_TOP_ACCURACY,
							locale: $localeStore
						})
					}
				})}
			</p>

			<ol class="welcome-social-list">
				{#each WELCOME_SOCIAL_LEADERBOARD as user (user.name)}
					{@const accuracy = formatAccuracy({ value: user.accuracy, locale: $localeStore })}
					<li class="welcome-social-row">
						<div class="welcome-social-user">
							<span
								class="num welcome-social-rank"
								aria-label={t({
									locale: $localeStore,
									key: 'social.rank_value',
									params: { rank: user.rank }
								})}>#{user.rank}</span
							>
							<span class={avatarClass({ tone: user.tone })} aria-hidden="true"
								>{user.initials}</span
							>
							<div class="welcome-social-user-copy">
								<span class="welcome-social-name">{user.name}</span>
								<span class="welcome-social-meta">
									{t({
										locale: $localeStore,
										key: 'social.leaderboard_row_meta',
										params: {
											streak: user.streak,
											xp: formatXp({ value: user.xp, locale: $localeStore })
										}
									})}
								</span>
							</div>
						</div>
						<span
							class="num welcome-social-accuracy"
							aria-label={t({
								locale: $localeStore,
								key: 'social.accuracy_value',
								params: { accuracy }
							})}>{accuracy}</span
						>
					</li>
				{/each}
			</ol>
		</article>

		<div class="welcome-social-testimonials">
			<article
				class="welcome-social-card welcome-social-testimonial welcome-social-testimonial--hero"
			>
				<p class="eyebrow acc">{t({ locale: $localeStore, key: 'social.what_say' })}</p>
				<blockquote class="welcome-social-quote welcome-social-quote--hero">
					<p>{t({ locale: $localeStore, key: heroTestimonial.quoteKey })}</p>
				</blockquote>
				<footer class="welcome-social-testimonial-author">
					<span class={avatarClass({ tone: heroTestimonial.tone })} aria-hidden="true">
						{heroTestimonial.initials}
					</span>
					<div class="welcome-social-user-copy">
						<span class="welcome-social-name">{heroTestimonial.name}</span>
						<span class="welcome-social-meta">
							{t({
								locale: $localeStore,
								key: 'social.testimonial_meta',
								params: {
									streak: heroTestimonial.streak,
									rank: heroTestimonial.rank,
									accuracy: formatAccuracy({
										value: heroTestimonial.accuracy,
										locale: $localeStore
									})
								}
							})}
						</span>
					</div>
				</footer>
			</article>

			<article class="welcome-social-card welcome-social-testimonial">
				<p class="eyebrow">{t({ locale: $localeStore, key: 'social.what_say' })}</p>
				<blockquote class="welcome-social-quote">
					<p>{t({ locale: $localeStore, key: secondaryTestimonial.quoteKey })}</p>
				</blockquote>
				<footer class="welcome-social-testimonial-author">
					<span class={avatarClass({ tone: secondaryTestimonial.tone })} aria-hidden="true">
						{secondaryTestimonial.initials}
					</span>
					<div class="welcome-social-user-copy">
						<span class="welcome-social-name">{secondaryTestimonial.name}</span>
						<span class="welcome-social-meta">
							{t({
								locale: $localeStore,
								key: 'social.testimonial_meta',
								params: {
									streak: secondaryTestimonial.streak,
									rank: secondaryTestimonial.rank,
									accuracy: formatAccuracy({
										value: secondaryTestimonial.accuracy,
										locale: $localeStore
									})
								}
							})}
						</span>
					</div>
				</footer>
			</article>
		</div>
	</div>
</div>

<style lang="postcss">
	.welcome-section-inner {
		max-width: 80rem;
		margin: 0 auto;
	}

	.welcome-social-grid {
		display: grid;
		gap: 1rem;
		align-items: stretch;
		margin-top: 3.5rem;
	}

	@media (min-width: 62rem) {
		.welcome-social-grid {
			grid-template-columns: minmax(0, 1.05fr) minmax(20rem, 0.95fr);
		}
	}

	.welcome-social-card {
		border: 1px solid var(--border);
		border-radius: 18px;
		background: var(--card);
		box-shadow: var(--shadow-card);
	}

	.welcome-social-leaderboard {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: clamp(1.25rem, 3vw, 1.5rem);
	}

	.welcome-social-leaderboard-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.welcome-social-leaderboard-head p {
		margin: 0;
	}

	.welcome-social-predictors {
		font-size: var(--t-12);
		color: var(--muted-foreground);
	}

	.welcome-social-aspire {
		margin: 0.25rem 0 0.75rem;
		padding: 0.625rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--laurel) 22%, transparent);
		border-radius: 10px;
		background: color-mix(in srgb, var(--laurel) 7%, transparent);
		color: var(--foreground);
		font-size: var(--t-13);
		line-height: 1.5;
	}

	.welcome-social-list {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.welcome-social-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
	}

	.welcome-social-row:last-child {
		border-bottom: 0;
	}

	.welcome-social-user,
	.welcome-social-testimonial-author {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.welcome-social-rank {
		width: 1.5rem;
		flex: 0 0 auto;
		color: var(--muted-foreground);
		font-size: var(--t-12);
		font-weight: 700;
	}

	.welcome-social-avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		flex: 0 0 auto;
		border: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--avatar-tone) 22%, var(--card));
		color: var(--foreground);
		font-size: var(--t-11);
		font-weight: 800;
		letter-spacing: 0.08em;
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--background) 60%, transparent);
	}

	.welcome-social-avatar--laurel {
		--avatar-tone: var(--laurel);
	}

	.welcome-social-avatar--yes {
		--avatar-tone: var(--yes);
	}

	.welcome-social-avatar--primary {
		--avatar-tone: var(--primary);
	}

	.welcome-social-avatar--no {
		--avatar-tone: var(--no);
	}

	.welcome-social-avatar--hold {
		--avatar-tone: var(--hold);
	}

	.welcome-social-avatar--ink {
		--avatar-tone: var(--muted-foreground);
	}

	.welcome-social-user-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.125rem;
	}

	.welcome-social-name {
		overflow: hidden;
		color: var(--foreground);
		font-size: var(--t-13);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.welcome-social-meta {
		font-family: var(--font-mono);
		font-size: var(--t-11);
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--no);
		text-transform: uppercase;
	}

	.welcome-social-accuracy {
		flex: 0 0 auto;
		color: var(--yes);
		font-size: var(--t-14);
		font-weight: 800;
	}

	.welcome-social-testimonials {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.welcome-social-testimonial {
		padding: 1.375rem;
	}

	.welcome-social-testimonial--hero {
		padding: clamp(1.75rem, 4vw, 2rem);
	}

	.welcome-social-testimonial .eyebrow {
		margin: 0;
	}

	.welcome-social-quote {
		margin: 0;
	}

	.welcome-social-quote p {
		margin: 0.625rem 0 0;
		color: var(--foreground);
		font-family: var(--font-serif);
		font-size: clamp(1.0625rem, 2vw, 1.25rem);
		font-style: italic;
		line-height: 1.45;
		text-wrap: balance;
	}

	.welcome-social-quote--hero p {
		margin-top: 1.125rem;
		font-size: clamp(1.5rem, 3vw, 1.625rem);
		line-height: 1.32;
	}

	.welcome-social-testimonial-author {
		margin-top: 1.25rem;
	}

	.welcome-social-testimonial:not(.welcome-social-testimonial--hero)
		.welcome-social-testimonial-author {
		margin-top: 0.875rem;
	}

	@media (max-width: 34rem) {
		.welcome-social-leaderboard-head,
		.welcome-social-row {
			align-items: flex-start;
		}

		.welcome-social-leaderboard-head {
			flex-direction: column;
			gap: 0.25rem;
		}

		.welcome-social-row {
			flex-direction: column;
		}

		.welcome-social-accuracy {
			padding-left: 4.25rem;
		}
	}
</style>
