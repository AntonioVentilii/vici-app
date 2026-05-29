<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		emblem: string;
		nameKey: MessageKey;
		streak: number;
		target: number;
		daysToMarathon: number;
		streakBarPct: number;
	}

	let { emblem, nameKey, streak, target, daysToMarathon, streakBarPct }: Props = $props();
</script>

<div class="dash-section">
	<div class="dash-section-eyebrow">
		<span>{t({ locale: $localeStore, key: 'dash.next.eyebrow' })}</span>
	</div>
	<button class="dash-achv" onclick={() => goto(resolve(AppPath.Album))} type="button">
		<span class="em" aria-hidden="true">{emblem}</span>
		<div class="body">
			<div class="name">{t({ locale: $localeStore, key: nameKey })}</div>
			<div class="progress"><span style:width="{streakBarPct}%" class="fill"></span></div>
			<div class="pct">
				{t({
					locale: $localeStore,
					key: 'dash.next.streak_progress',
					params: { current: streak, target, count: daysToMarathon }
				})}
			</div>
		</div>
	</button>
</div>
