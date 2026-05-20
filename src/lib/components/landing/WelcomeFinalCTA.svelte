<script lang="ts">
	import { ChevronRight } from 'lucide-svelte/icons';
	import { resolve } from '$app/paths';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
</script>

<div class="welcome-final-inner">
	<p class="serif-italic acc welcome-final-mark">Vici.</p>
	<h2 class="welcome-final-title display">{t({ locale: $localeStore, key: 'final.title' })}</h2>
	<p class="welcome-final-lede lede">{t({ locale: $localeStore, key: 'final.lede' })}</p>

	<div class="welcome-final-actions">
		<a class="welcome-final-link welcome-final-link--primary" href={resolve(PublicPath.SignUp)}>
			{t({ locale: $localeStore, key: 'cta.start_predict' })}
			<ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
		</a>
		<a class="welcome-final-link welcome-final-link--ghost" href={resolve(AppPath.Home)}>
			{t({ locale: $localeStore, key: 'cta.browse' })}
		</a>
	</div>
</div>

<style lang="postcss">
	.welcome-final-inner {
		max-width: 80rem;
		margin: 0 auto;
		text-align: center;
	}

	.welcome-final-mark {
		margin: 0 0 1.125rem;
		font-size: clamp(1.35rem, 3vw, 1.625rem);
		line-height: 1;
	}

	.welcome-final-title {
		margin: 0;
		color: var(--foreground);
		font-size: clamp(1.75rem, 4vw, 2.75rem);
		line-height: 1.05;
	}

	.welcome-final-lede {
		max-width: 30rem;
		margin: 0.875rem auto 0;
	}

	.welcome-final-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		margin-top: 2rem;
	}

	.welcome-final-link {
		display: inline-flex;
		min-height: 3.5rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.95rem 1.5rem;
		border-radius: 14px;
		font-size: var(--t-16);
		font-weight: 600;
		line-height: 1;
		text-decoration: none;
		transition:
			transform 200ms var(--ease-vici),
			background 200ms var(--ease-vici),
			border-color 200ms var(--ease-vici);
	}

	.welcome-final-link:hover {
		transform: translateY(-1px);
	}

	.welcome-final-link--primary {
		background: var(--primary);
		color: var(--primary-foreground);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
	}

	.welcome-final-link--primary:hover {
		background: var(--laurel-deep);
	}

	.welcome-final-link--ghost {
		border: 1px solid transparent;
		background: transparent;
		color: var(--foreground);
	}

	.welcome-final-link--ghost:hover {
		border-color: var(--border);
		background: color-mix(in srgb, var(--foreground) 6%, transparent);
	}
</style>
