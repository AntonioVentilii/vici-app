<script lang="ts">
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		oracleInsight: string;
	}

	let { oracleInsight }: Props = $props();
</script>

<section class="profile-oracle">
	<div class="profile-oracle-icon" aria-hidden="true">
		<OracleChar size={32} />
	</div>
	<div class="profile-oracle-body">
		<p class="profile-oracle-eyebrow">
			{t({ locale: $localeStore, key: 'profile.dashboard.oracle_label' })}
			<span>{t({ locale: $localeStore, key: 'profile.dashboard.oracle_weekly' })}</span>
		</p>
		<p class="profile-oracle-text serif-italic">{oracleInsight}</p>
	</div>
</section>

<style lang="postcss">
	.profile-oracle {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		border: 1px solid color-mix(in srgb, var(--char-oracle) 18%, var(--border-base));
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--char-oracle) 4%, var(--bg-popover));
	}

	.profile-oracle-icon {
		display: flex;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--char-oracle) 18%, transparent);
	}

	.profile-oracle-body {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.25rem;
	}

	.profile-oracle-eyebrow {
		margin: 0;
		color: var(--char-oracle);
		font-family: var(--font-mono);
		font-size: var(--t-10);
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-oracle-text {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-14);
		line-height: var(--leading-snug);
	}
</style>
