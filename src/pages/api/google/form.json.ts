/**
 * Google Sheets API – fetch first row cells (service account)
 *
 * Returns the first 10 cells (A1:J1) of the top row from a given spreadsheet.
 * Uses GOOGLE_SERVICE_ACCOUNT_JSON: path to JSON key file, or the raw JSON string.
 * Share the spreadsheet with the service account email (Viewer or Editor).
 *
 * GET /api/google/form.json?spreadsheetId=xxx
 */

import type { APIRoute } from 'astro';
import { getServiceAccount, getAccessTokenFromServiceAccount } from '../../../lib/google-auth';

export const GET: APIRoute = async (context) => {
  const spreadsheetId = context.url.searchParams.get('spreadsheetId');
  if (!spreadsheetId) {
    return new Response(
      JSON.stringify({ error: 'Missing spreadsheetId query parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const serviceAccount = await getServiceAccount(context);
  if (!serviceAccount) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const range = 'A1:J1';

  try {
    const accessToken = await getAccessTokenFromServiceAccount(serviceAccount, [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ]);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Google Sheets fetch error:', res.status, text);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch spreadsheet' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const json = (await res.json()) as { values?: unknown[][] };
    const row = (json.values?.[0] as unknown[]) ?? [];
    const values = row.slice(0, 10).map((v) => (v != null ? String(v) : ''));

    return new Response(
      JSON.stringify({ range, values }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err
      ? String((err as { message: string }).message)
      : 'Failed to fetch spreadsheet';
    console.error('Google Sheets fetch error:', err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
