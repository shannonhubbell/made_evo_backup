/**
 * Google Sheets API helpers – credentials and fetch first row.
 *
 * Credentials are resolved in order:
 * 1. context.locals.runtime.env (Cloudflare Workers/Pages runtime)
 * 2. context.locals.runtime (in case env vars are on runtime itself)
 * 3. getSecret('GOOGLE_SERVICE_ACCOUNT_JSON') (Astro env/server)
 * 4. import.meta.env (local dev / build)
 * 5. File path (local only; not available on Cloudflare)
 */

import type { APIContext } from 'astro';
import { getServiceAccount, getAccessTokenFromServiceAccount } from './google-auth';

async function getRawCredentials(context: APIContext): Promise<string | undefined> {
  const locals = context.locals as {
    runtime?: { env?: Record<string, string>; [key: string]: unknown };
  };
  const runtime = locals?.runtime;
  // 1) Cloudflare: runtime.env (Astro docs)
  const fromEnv = runtime?.env?.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (fromEnv) return fromEnv;
  // 2) Cloudflare: some setups put vars on runtime directly
  const fromRuntime =
    runtime && typeof (runtime as Record<string, unknown>).GOOGLE_SERVICE_ACCOUNT_JSON === 'string'
      ? (runtime as Record<string, string>).GOOGLE_SERVICE_ACCOUNT_JSON
      : undefined;
  if (fromRuntime) return fromRuntime;
  // 3) Astro getSecret (works with astro:env on Cloudflare when configured)
  try {
    const { getSecret } = await import('astro:env/server');
    const secret = getSecret('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (secret) return secret;
  } catch {
    // getSecret not available or not configured
  }
  // 4) import.meta.env (local .env / .dev.vars)
  const fromMeta = import.meta.env.GOOGLE_SERVICE_ACCOUNT_JSON as string | undefined;
  if (fromMeta) return fromMeta;
  return undefined;
}

export async function getGoogleCredentials(
  context: APIContext
): Promise<Record<string, unknown> | null> {
  const raw = await getRawCredentials(context);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // 5) Local only: treat as file path (Cloudflare has no fs)
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      try {
        const path = await import('node:path');
        const fs = await import('node:fs/promises');
        const resolved = path.resolve(process.cwd(), raw.trim());
        const content = await fs.readFile(resolved, 'utf-8');
        return JSON.parse(content) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Fetch the first row from a spreadsheet as string labels.
 * @param context - Astro API context (for credentials)
 * @param spreadsheetId - Google Spreadsheet ID
 * @param sheetName - Optional sheet/tab name; if omitted, uses first sheet
 * @param maxCols - Max columns to read (default 26)
 */
export async function fetchFirstRow(
  context: APIContext,
  spreadsheetId: string,
  sheetName?: string | null,
  maxCols = 26
): Promise<string[]> {
  const serviceAccount = await getServiceAccount(context);
  if (!serviceAccount) return [];

  const accessToken = await getAccessTokenFromServiceAccount(serviceAccount, [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ]);

  const col = String.fromCharCode(64 + Math.min(maxCols, 26)); // A-Z
  const a1Range = sheetName
    ? `${sheetName.replace(/'/g, "''")}!A1:${col}1`
    : `A1:${col}1`;
  const encodedRange = encodeURIComponent(a1Range);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodedRange}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[google-sheets] values.get failed:', res.status, text);
    return [];
  }

  const json = (await res.json()) as { values?: unknown[][] };
  const row = (json.values?.[0] as unknown[]) ?? [];
  return row.map((v) => (v != null ? String(v) : ''));
}
