<script lang="ts">
	import { goto } from '$app/navigation';
	import Logo from '$lib/components/layout/Logo.svelte';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
</script>

<footer class="welcome-footer">
	<div class="welcome-footer-inner">
		<div class="welcome-footer-brand">
			<Logo href={PublicPath.Welcome} />
			<p class="welcome-footer-tagline">{t({ locale: $localeStore, key: 'footer.tagline' })}</p>
		</div>

		<div class="welcome-footer-cols">
			<div>
				<p class="eyebrow">{t({ locale: $localeStore, key: 'footer.product' })}</p>
				<ul>
					<li><a href="#markets">{t({ locale: $localeStore, key: 'footer.markets' })}</a></li>
					<li>
						<button onclick={() => goto(AppPath.Flow)} type="button"
							>{t({ locale: $localeStore, key: 'nav.flow' })}</button
						>
					</li>
					<li>
						<button onclick={() => goto(AppPath.Leaderboard)} type="button"
							>{t({ locale: $localeStore, key: 'footer.leaderboard' })}</button
						>
					</li>
				</ul>
			</div>
			<div>
				<p class="eyebrow">{t({ locale: $localeStore, key: 'footer.legal' })}</p>
				<ul>
					<li><span>{t({ locale: $localeStore, key: 'footer.terms' })}</span></li>
					<li><span>{t({ locale: $localeStore, key: 'footer.privacy' })}</span></li>
					<li><span>{t({ locale: $localeStore, key: 'footer.rules' })}</span></li>
				</ul>
			</div>
		</div>
	</div>

	<p class="welcome-footer-bottom num">{t({ locale: $localeStore, key: 'footer.bottom' })}</p>
</footer>

<style lang="postcss">
	.welcome-footer {
		margin-top: 4rem;
		padding: 3rem clamp(1.25rem, 4vw, 2rem) 2rem;
		border-top: 1px solid var(--border);
	}

	.welcome-footer-inner {
		max-width: 80rem;
		margin: 0 auto;
		display: grid;
		gap: 2rem;
	}

	@media (min-width: 48rem) {
		.welcome-footer-inner {
			grid-template-columns: 1fr 1fr;
		}
	}

	.welcome-footer-tagline {
		margin: 0.75rem 0 0;
		max-width: 20rem;
		font-size: var(--t-14);
		color: var(--muted-foreground);
	}

	.welcome-footer-cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.welcome-footer-cols ul {
		margin: 0.5rem 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: var(--t-14);
		color: var(--muted-foreground);
	}

	.welcome-footer-cols button {
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.welcome-footer-cols button:hover,
	.welcome-footer-cols a:hover {
		color: var(--foreground);
	}

	.welcome-footer-bottom {
		max-width: 80rem;
		margin: 2rem auto 0;
		font-size: var(--t-12);
		color: var(--muted-foreground);
	}
</style>
