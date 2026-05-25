<script lang="ts">
	import {
		daysToKickoff,
		featuredEvent,
		featuredEventActive
	} from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		/** i18n key for the upcoming state. Receives \`{ event, days }\`
		 *  params. Page-scoped so each call site keeps its own copy
		 *  (e.g. \`onboarding.featured_event.upcoming\` vs
		 *  \`profile.featured_event.upcoming\`). */
		upcomingKey: MessageKey;
		/** i18n key for the live / wrap-up state. Receives \`{ event }\`. */
		liveKey: MessageKey;
	}

	const { upcomingKey, liveKey }: Props = $props();
</script>

{#if $featuredEventActive}
	<!-- Single source of truth for the featured-event teaser pill.
	     Shown on /onboarding step 0 and /profile today; ready to drop
	     onto any future surface that wants the live tentpole context.
	     Hidden once `featuredEventActive` flips false (post-archive). -->
	<div class="featured-event-chip" role="note">
		<span class="featured-event-chip-dot" aria-hidden="true"></span>
		<span class="num">
			{#if $daysToKickoff !== null && $daysToKickoff > 0}
				{t({
					locale: $localeStore,
					key: upcomingKey,
					params: { event: $featuredEvent.title, days: $daysToKickoff }
				})}
			{:else}
				{t({
					locale: $localeStore,
					key: liveKey,
					params: { event: $featuredEvent.title }
				})}
			{/if}
		</span>
	</div>
{/if}

<style lang="postcss">
	.featured-event-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		align-self: flex-start;
		padding: 0.35rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--laurel) 28%, transparent);
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		color: var(--laurel);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.featured-event-chip-dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: currentColor;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--laurel) 18%, transparent);
	}
</style>
