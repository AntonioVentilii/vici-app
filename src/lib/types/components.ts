export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Represents the interactive status of a button.
 *
 * enabled  – The button is clickable and ready for user interaction.
 * disabled – The action is not allowed; the button cannot be clicked.
 * loading  – The system is determining whether the action is available
 *            (e.g. fetching permissions, balances, or other prerequisites).
 * pending  – The user triggered the action and it is currently being processed.
 */
export type ButtonStatus = 'enabled' | 'disabled' | 'loading' | 'pending';
