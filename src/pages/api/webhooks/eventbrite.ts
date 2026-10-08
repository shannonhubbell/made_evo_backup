import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';

/**
 * Eventbrite Webhook Relay
 *
 * GitHub Actions has no way to receive a third-party webhook directly - it only
 * accepts events it already knows about (push, schedule, repository_dispatch, ...).
 * So this endpoint is what Eventbrite's webhook actually POSTs to; it verifies the
 * request, then triggers the "Sync Eventbrite Events to Contentful" GitHub Actions
 * workflow (.github/workflows/eventbrite-sync.yml) via GitHub's repository_dispatch
 * API, which runs `npm run push:eventbrite-to-contentful -- --prune-orphaned`.
 *
 * The sync itself runs in GitHub Actions rather than here because it's a long,
 * sequential chain of rate-limited Contentful Management API calls (create an image
 * asset, poll until processed, publish, create a CallToAction, create the event entry,
 * publish, repeat per event) - a workload suited to a long-lived runner, not a Worker's
 * request/response model.
 *
 * Setup (see docs/EVENTBRITE_WEBHOOK_SETUP.md for the full walkthrough):
 * 1. Set EVENTBRITE_WEBHOOK_SECRET and GITHUB_DISPATCH_TOKEN in Cloudflare env vars.
 * 2. In Eventbrite's webhook settings, add this endpoint as the webhook URL:
 *    https://<your-domain>/api/webhooks/eventbrite?secret=<EVENTBRITE_WEBHOOK_SECRET>
 */
export const prerender = false;

const GITHUB_OWNER = 'Museum-of-Art-and-Digital-Entertainment';
const GITHUB_REPO = 'made_evo';
const DISPATCH_EVENT_TYPE = 'eventbrite-webhook';

/** Same pattern used in lib/contentful.ts / lib/contentful/locales.ts for reading
 * secrets across both the Cloudflare Workers runtime and local/build-time environments. */
function getEnvVar(locals: App.Locals, key: string): string | undefined {
  const runtimeValue = (locals as any)?.runtimeEnv?.[key] ?? (locals as any)?.runtime?.env?.[key];
  if (runtimeValue) return runtimeValue;

  try {
    const secretValue = getSecret(key);
    if (secretValue) return secretValue;
  } catch {
    // getSecret unavailable in this context - fall through
  }

  return import.meta.env[key];
}

export const POST: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const providedSecret = url.searchParams.get('secret');
  const expectedSecret = getEnvVar(locals, 'EVENTBRITE_WEBHOOK_SECRET');

  if (!expectedSecret) {
    console.error('[webhooks/eventbrite] EVENTBRITE_WEBHOOK_SECRET is not configured');
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Invalid or missing secret' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const githubToken = getEnvVar(locals, 'GITHUB_DISPATCH_TOKEN');
  if (!githubToken) {
    console.error('[webhooks/eventbrite] GITHUB_DISPATCH_TOKEN is not configured');
    return new Response(JSON.stringify({ error: 'Dispatch not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Eventbrite's webhook body just identifies which action/object fired (e.g.
  // "event.updated"); we don't need its contents since the sync script re-fetches
  // everything from Eventbrite anyway - it's only logged here for troubleshooting.
  let eventbritePayload: unknown;
  try {
    eventbritePayload = await request.json();
  } catch {
    eventbritePayload = null;
  }
  console.log('[webhooks/eventbrite] Received webhook:', JSON.stringify(eventbritePayload));

  try {
    const dispatchRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          // GitHub's REST API rejects requests with no User-Agent (returns a 403
          // "Request forbidden by administrative rules") - Cloudflare Workers' fetch
          // doesn't send a default one, unlike a browser.
          'User-Agent': `${GITHUB_REPO}-eventbrite-webhook`,
        },
        body: JSON.stringify({ event_type: DISPATCH_EVENT_TYPE }),
      }
    );

    if (!dispatchRes.ok) {
      const text = await dispatchRes.text();
      console.error(`[webhooks/eventbrite] GitHub dispatch failed: ${dispatchRes.status} ${text}`);
      return new Response(JSON.stringify({ error: 'Failed to trigger sync workflow' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[webhooks/eventbrite] Triggered eventbrite-sync workflow');
    return new Response(JSON.stringify({ ok: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[webhooks/eventbrite] Error dispatching to GitHub:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
