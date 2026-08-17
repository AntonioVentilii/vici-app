// Request metadata helpers.

/** The client IP behind the hosting proxy, or null when no forwarding header
 * is present (direct local requests, tests). */
export const clientIp = (request: Request): string | null =>
	request.headers.get('fly-client-ip') ??
	request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
	null;
