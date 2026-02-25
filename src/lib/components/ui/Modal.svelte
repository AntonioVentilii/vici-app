<script lang="ts">
	import { setDoc, uploadFile } from '@junobuild/core';
	import { nanoid } from 'nanoid';
	import Backdrop from '$lib/components/ui/Backdrop.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { userStore } from '$lib/stores/user.store';
	import type { Note } from '$lib/types/note';

	let showModal = $state(false);

	let inputText = $state('');
	let file: File | undefined = $state(undefined);

	let inputFile: HTMLInputElement | null = $state(null);

	let progress = $state(false);

	const valid = $derived(inputText !== '' && $userSignedIn);

	const reload = () => {
		const event = new CustomEvent('junoExampleReload');
		window.dispatchEvent(event);
	};

	const add = async () => {
		// Demo purpose therefore edge case not properly handled
		if ($userStore === undefined || $userStore === null) {
			return;
		}

		progress = true;

		try {
			let url;

			if (file !== undefined) {
				const filename = `${$userStore.key}-${file.name}`;

				const { downloadUrl } = await uploadFile({
					collection: 'images',
					data: file,
					filename
				});

				url = downloadUrl;
			}

			const key = nanoid();

			await setDoc<Note>({
				collection: 'notes',
				doc: {
					key,
					data: {
						text: inputText,
						...(url !== undefined && { url })
					}
				}
			});

			showModal = false;

			reload();
		} catch (err) {
			console.error(err);
		}

		progress = false;
	};

	const onChangeFile = ($event: Event) =>
		(file = ($event as unknown as { target: EventTarget & HTMLInputElement }).target?.files?.[0]);

	const openSelectFile = () => inputFile?.click();

	// eslint-disable-next-line require-await
	const openModal = async () => {
		if (inputFile !== null) {
			inputFile.value = '';
		}

		file = undefined;

		showModal = true;
	};
</script>

<Button onclick={openModal}>
	Add an entry
	<svg
		fill="currentColor"
		height="20"
		viewBox="0 -960 960 960"
		width="20"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M417-417H166v-126h251v-251h126v251h251v126H543v251H417v-251Z" />
	</svg>
</Button>

{#if showModal}
	<div class="animate-fade fixed inset-0 z-50 p-16 md:px-24 md:py-44" role="dialog">
		<div class="relative w-full max-w-xl">
			<textarea
				class="form-control m-0 block w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base shadow-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
				disabled={progress}
				placeholder="Your diary entry"
				rows={7}
				bind:value={inputText}
			></textarea>

			<div class="flex items-center justify-between" role="toolbar">
				<div>
					<button
						class="flex items-center gap-2 text-slate-600 transition-colors hover:text-indigo-600 active:text-indigo-700"
						aria-label="Attach a file to the entry"
						onclick={openSelectFile}
					>
						<svg
							fill="currentColor"
							viewBox="0 0 29 29"
							width="20"
							xmlns="http://www.w3.org/2000/svg"
						>
							<g>
								<rect class="opacity-25" fill="none" height="29" width="29" />
								<path
									d="M8.36,26.92c-2,0-3.88-.78-5.29-2.19C.15,21.81.15,17.06,3.06,14.14L12.57,4.64c.39-.39,1.02-.39,1.41,0s.39,1.02,0,1.41L4.48,15.56c-2.14,2.14-2.14,5.62,0,7.76,1.04,1.04,2.41,1.61,3.88,1.61s2.84-.57,3.88-1.61l12.79-12.79c1.47-1.47,1.47-3.87,0-5.34-1.47-1.47-3.87-1.47-5.34,0l-12.45,12.45c-.73.73-.73,1.91,0,2.64.73.73,1.91.73,2.64,0l9.17-9.17c.39-.39,1.02-.39,1.41,0s.39,1.02,0,1.41l-9.17,9.17c-1.51,1.51-3.96,1.51-5.47,0-1.51-1.51-1.51-3.96,0-5.47L18.26,3.77c2.25-2.25,5.92-2.25,8.17,0s2.25,5.92,0,8.17l-12.79,12.79c-1.41,1.41-3.29,2.19-5.29,2.19Z"
								/>
							</g>
						</svg>
						<span class="max-w-48 truncate">
							<small>{file !== undefined ? file.name : 'Attach file'}</small>
						</span>
					</button>

					<input
						bind:this={inputFile}
						class="fixed right-0 -bottom-24 opacity-0"
						disabled={progress}
						onchange={onChangeFile}
						type="file"
					/>
				</div>

				{#if progress}
					<div
						class="my-8 inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-current border-t-transparent text-indigo-600"
						aria-label="loading"
						role="status"
					>
						<span class="sr-only">Loading...</span>
					</div>
				{:else}
					<div class="my-4 flex">
						<button
							class="px-8 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
							onclick={() => (showModal = false)}
							type="button"
						>
							Close
						</button>

						<Button disabled={!valid} onclick={add}>Submit</Button>
					</div>
				{/if}
			</div>
		</div>
	</div>
	<Backdrop />
{/if}
