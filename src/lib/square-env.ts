/**
 * Get Square API config from environment.
 * In Cloudflare Workers, env vars are in context.locals.runtime.env (not import.meta.env).
 * Locally, import.meta.env works.
 */
export function getSquareEnv(context?: {
  locals?: { runtime?: { env?: Record<string, string | undefined> } };
}) {
  const env = context?.locals?.runtime?.env;
  return {
    squareApplicationId:
      env?.SQUARE_APPLICATION_ID ?? (import.meta.env?.SQUARE_APPLICATION_ID as string | undefined) ?? '',
    squareAccessToken:
      env?.SQUARE_ACCESS_TOKEN ?? (import.meta.env?.SQUARE_ACCESS_TOKEN as string | undefined),
    squareLocationId:
      env?.SQUARE_LOCATION_ID ?? (import.meta.env?.SQUARE_LOCATION_ID as string | undefined) ?? '',
    squareEnvironment:
      (env?.SQUARE_ENVIRONMENT ?? (import.meta.env?.SQUARE_ENVIRONMENT as string | undefined)) ||
      'sandbox',
  };
}
