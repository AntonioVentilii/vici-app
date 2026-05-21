<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { MarketEventDirection, MarketWhyNowKind } from '$lib/enums/market-metadata';
	import { getMarketMetadata, upsertMarketMetadata } from '$lib/services/market-metadata.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { ButtonStatus } from '$lib/types/components';
	import type { Market } from '$lib/types/market';
	import type { MarketEvent, MarketMetadataInput } from '$lib/types/market-metadata';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: Market;
		canEdit: boolean;
	}

	const { market, canEdit }: Props = $props();

	let whyKind = $state<MarketWhyNowKind>(MarketWhyNowKind.CLOSING);
	let whyText = $state('');
	let resolutionText = $state('');
	let resolutionSource = $state('');
	let settlesAtMs = $state('');
	let eventOneLabel = $state('');
	let eventOneDay = $state('');
	let eventOneDir = $state<MarketEventDirection>(MarketEventDirection.UP);
	let eventTwoLabel = $state('');
	let eventTwoDay = $state('');
	let eventTwoDir = $state<MarketEventDirection>(MarketEventDirection.UP);
	let status = $state<ButtonStatus>('enabled');
	let loaded = $state(false);
	let savedAt = $state<number | undefined>(undefined);
	let error = $state<string | undefined>(undefined);

	const parseDay = (value: string): number | undefined => {
		const trimmed = value.trim();

		if (trimmed.length === 0) {
			return;
		}

		const parsed = Number(trimmed);

		return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
	};

	const eventFromFields = ({
		label,
		day,
		dir
	}: {
		label: string;
		day: string;
		dir: MarketEventDirection;
	}): MarketEvent | undefined => {
		const trimmed = label.trim();
		const parsedDay = parseDay(day);

		if (trimmed.length === 0 || parsedDay === undefined) {
			return;
		}

		return {
			label: trimmed,
			day: parsedDay,
			dir
		};
	};

	const buildInput = (): MarketMetadataInput => {
		const why = whyText.trim();
		const text = resolutionText.trim();
		const source = resolutionSource.trim();
		const settle = Number(settlesAtMs);
		const events = [
			eventFromFields({ label: eventOneLabel, day: eventOneDay, dir: eventOneDir }),
			eventFromFields({ label: eventTwoLabel, day: eventTwoDay, dir: eventTwoDir })
		].filter((event): event is MarketEvent => event !== undefined);

		return {
			...(why.length > 0 && { whyNow: { kind: whyKind, text: why } }),
			events,
			...(text.length > 0 &&
				source.length > 0 && {
					resolution: {
						text,
						source,
						...(Number.isFinite(settle) && settle > 0 && { settlesAtMs: settle })
					}
				})
		};
	};

	const save = async () => {
		status = 'pending';
		error = undefined;

		try {
			const metadata = await upsertMarketMetadata({
				seriesId: market.id,
				data: buildInput()
			});
			savedAt = metadata.updatedAt;
		} catch (err) {
			console.warn('Market metadata save failed:', err);
			error = t({ locale: $localeStore, key: 'market.metadata.error.save' });
		} finally {
			status = 'enabled';
		}
	};

	onMount(async () => {
		try {
			const metadata = await getMarketMetadata(market.id);

			if (metadata?.whyNow) {
				whyKind = metadata.whyNow.kind;
				whyText = metadata.whyNow.text;
			}

			if (metadata?.resolution) {
				resolutionText = metadata.resolution.text;
				resolutionSource = metadata.resolution.source;
				settlesAtMs = metadata.resolution.settlesAtMs?.toString() ?? '';
			}

			const [eventOne, eventTwo] = metadata?.events ?? [];

			if (eventOne) {
				eventOneLabel = eventOne.label;
				eventOneDay = String(eventOne.day);
				eventOneDir = eventOne.dir;
			}

			if (eventTwo) {
				eventTwoLabel = eventTwo.label;
				eventTwoDay = String(eventTwo.day);
				eventTwoDir = eventTwo.dir;
			}
		} catch (err) {
			console.warn('Market metadata load failed:', err);
			error = t({ locale: $localeStore, key: 'market.metadata.error.load' });
		} finally {
			loaded = true;
		}
	});
</script>

{#if canEdit}
	<Card class="market-metadata-card" padding="lg">
		<div class="market-metadata-head">
			<div>
				<p class="eyebrow">{t({ locale: $localeStore, key: 'market.metadata.eyebrow' })}</p>
				<h3>{t({ locale: $localeStore, key: 'market.metadata.title' })}</h3>
			</div>
			{#if savedAt}
				<span class="num market-metadata-saved"
					>{t({ locale: $localeStore, key: 'market.metadata.saved' })}</span
				>
			{/if}
		</div>

		{#if !loaded}
			<p class="market-metadata-muted">
				{t({ locale: $localeStore, key: 'market.metadata.loading' })}
			</p>
		{:else}
			{#if error}
				<p class="market-metadata-error">{error}</p>
			{/if}

			<div class="market-metadata-grid">
				<label>
					<span>{t({ locale: $localeStore, key: 'market.metadata.why_now' })}</span>
					<select bind:value={whyKind}>
						{#each Object.values(MarketWhyNowKind) as kind (kind)}
							<option value={kind}>{kind}</option>
						{/each}
					</select>
					<input
						placeholder={t({
							locale: $localeStore,
							key: 'market.metadata.placeholder.closing_soon'
						})}
						bind:value={whyText}
					/>
				</label>

				<label>
					<span>{t({ locale: $localeStore, key: 'market.metadata.resolution_text' })}</span>
					<textarea
						placeholder={t({
							locale: $localeStore,
							key: 'market.metadata.placeholder.resolution_text'
						})}
						bind:value={resolutionText}
					></textarea>
				</label>

				<label>
					<span>{t({ locale: $localeStore, key: 'market.metadata.source' })}</span>
					<input
						placeholder={t({
							locale: $localeStore,
							key: 'market.metadata.placeholder.official_source'
						})}
						bind:value={resolutionSource}
					/>
				</label>

				<label>
					<span>{t({ locale: $localeStore, key: 'market.metadata.settles_at' })}</span>
					<input inputmode="numeric" placeholder="1767225600000" bind:value={settlesAtMs} />
				</label>

				<div class="market-metadata-events">
					<span>{t({ locale: $localeStore, key: 'market.metadata.events' })}</span>
					<div class="event-row">
						<input
							inputmode="numeric"
							placeholder={t({ locale: $localeStore, key: 'market.metadata.placeholder.day' })}
							bind:value={eventOneDay}
						/>
						<select bind:value={eventOneDir}>
							<option value={MarketEventDirection.UP}>+</option>
							<option value={MarketEventDirection.DOWN}>-</option>
						</select>
						<input
							placeholder={t({
								locale: $localeStore,
								key: 'market.metadata.placeholder.event_one'
							})}
							bind:value={eventOneLabel}
						/>
					</div>
					<div class="event-row">
						<input
							inputmode="numeric"
							placeholder={t({ locale: $localeStore, key: 'market.metadata.placeholder.day' })}
							bind:value={eventTwoDay}
						/>
						<select bind:value={eventTwoDir}>
							<option value={MarketEventDirection.UP}>+</option>
							<option value={MarketEventDirection.DOWN}>-</option>
						</select>
						<input
							placeholder={t({
								locale: $localeStore,
								key: 'market.metadata.placeholder.event_two'
							})}
							bind:value={eventTwoLabel}
						/>
					</div>
				</div>
			</div>

			<Button onclick={save} {status}
				>{t({ locale: $localeStore, key: 'market.metadata.save' })}</Button
			>
		{/if}
	</Card>
{/if}

<style lang="postcss">
	.market-metadata-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.market-metadata-head h3 {
		margin: 0.25rem 0 0;
		font-size: var(--t-20);
		font-weight: 600;
	}

	.market-metadata-saved,
	.market-metadata-muted {
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.market-metadata-error {
		margin: 0 0 1rem;
		color: var(--no);
		font-size: var(--t-13);
	}

	.market-metadata-grid {
		display: grid;
		gap: 0.875rem;
		margin-bottom: 1rem;
	}

	.market-metadata-grid label,
	.market-metadata-events {
		display: grid;
		gap: 0.4rem;
	}

	.market-metadata-grid label > span,
	.market-metadata-events > span {
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.market-metadata-grid input,
	.market-metadata-grid select,
	.market-metadata-grid textarea {
		width: 100%;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		color: var(--text-base);
		padding: 0.65rem 0.75rem;
		font: inherit;
	}

	.market-metadata-grid textarea {
		min-height: 6rem;
		resize: vertical;
	}

	.event-row {
		display: grid;
		grid-template-columns: 4rem 4rem minmax(0, 1fr);
		gap: 0.5rem;
	}
</style>
