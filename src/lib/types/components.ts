export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * `loading` is the pre-interaction state (fetching permissions / prerequisites);
 * `pending` is the post-click in-flight state. They render differently.
 */
export type ButtonStatus = 'enabled' | 'disabled' | 'loading' | 'pending';
