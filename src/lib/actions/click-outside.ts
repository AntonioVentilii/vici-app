/**
 * Svelte action to detect clicks outside of an element.
 */
// eslint-disable-next-line local-rules/prefer-object-params
export const clickOutside = (node: HTMLElement, callback: () => void) => {
	const handleClick = (event: MouseEvent) => {
		if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
			callback();
		}
	};

	document.addEventListener('click', handleClick, true);

	return {
		destroy: () => {
			document.removeEventListener('click', handleClick, true);
		}
	};
};
