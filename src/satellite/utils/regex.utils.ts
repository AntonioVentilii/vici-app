/** Escape a value for safe interpolation into a `listDocsStore` key regex. */
export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
