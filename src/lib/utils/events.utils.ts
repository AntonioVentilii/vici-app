/**
 * Dispatches a bubbling `CustomEvent` on `document` for cross-component coordination.
 */
export const emit = <T>({ message, detail }: { message: string; detail?: T | undefined }) => {
	const $event: CustomEvent<T> = new CustomEvent<T>(message, { detail, bubbles: true });
	document.dispatchEvent($event);
};
