/**
 * Google Form Submit API – receives form submissions
 *
 * POST /api/google/forms/[slug]/submit.json
 * Body: { answers: { [questionId]: string | string[] } }
 * Appends responses to the linked Google Sheet if available.
 * Sends a Slack notification when SLACK_WEBHOOK_URL is set.
 */

import type { APIRoute } from 'astro';
import { getGoogleFormBySlug } from '../../../../../lib/contentful';
import { adaptGoogleForm } from '../../../../../lib/adapters/google-form';
import { fetchFormStructure } from '../../../../../lib/google-forms';
import { getServiceAccount, getAccessTokenFromServiceAccount } from '../../../../../lib/google-auth';
import { notifyFormSubmission } from '../../../../../lib/slack';

function getEnv(
  context: Parameters<APIRoute>[0],
  key: string
): string | undefined {
  const env = (context.locals as { runtime?: { env?: Record<string, string | undefined> } })?.runtime?.env;
  const v = env?.[key] ?? (import.meta.env[key] as string | undefined);
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export const prerender = false;

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format submission time for Google Sheets Timestamp column.
 * "YYYY-MM-DD HH:mm:ss" is widely parsed by Sheets as datetime with USER_ENTERED.
 */
function formatSubmissionTimestamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

export const POST: APIRoute = async (context) => {
  const slug = context.params?.slug;

  if (!slug) {
    return new Response(
      JSON.stringify({ error: 'Slug parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    let body: { answers?: Record<string, string | string[]> };
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const answers = body?.answers ?? {};
    if (typeof answers !== 'object' || Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: 'answers must be an object' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const entry = await getGoogleFormBySlug(slug);
    const formData = adaptGoogleForm(entry);
    if (!formData?.formId) {
      return new Response(
        JSON.stringify({ error: 'GoogleForm not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const structure = await fetchFormStructure(context, formData.formId);
    const linkedSheetId = structure?.linkedSheetId;
    const fields = structure?.fields ?? [];

    const answersByTitle = new Map(
      fields.map((f) => {
        const val = answers[f.id];
        const s = val == null ? '' : Array.isArray(val) ? val.join(', ') : String(val);
        return [normalizeHeader(f.title), s];
      })
    );

    if (linkedSheetId) {
      const serviceAccount = await getServiceAccount(context);
      if (serviceAccount) {
        const accessToken = await getAccessTokenFromServiceAccount(serviceAccount, [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ]);

        // Fetch header row to align columns with the sheet
        let headers: string[] = [];
        let sheetName = 'Form Responses 1';
        for (const name of ['Form Responses 1', 'Sheet1']) {
          try {
            const headerRange = `${name}!1:1`;
            const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
              linkedSheetId
            )}/values/${encodeURIComponent(headerRange)}`;

            const headerRes = await fetch(headerUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!headerRes.ok) continue;
            const headerJson = (await headerRes.json()) as { values?: unknown[][] };
            const row1 = (headerJson.values?.[0] as unknown[]) ?? [];
            if (row1.length) {
              headers = row1.map((h) => (h != null ? String(h).trim() : ''));
              sheetName = name;
              break;
            }
          } catch {
            continue;
          }
        }

        let row: string[];
        if (headers.length > 0) {
          // Column A is always Timestamp in Google Forms response sheets
          row = headers.map((header, i) => {
            if (i === 0) return formatSubmissionTimestamp();
            const norm = normalizeHeader(header);
            return answersByTitle.get(norm) ?? '';
          });
        } else {
          // Fallback: timestamp + values in field order
          const values = fields.map((f) => answersByTitle.get(normalizeHeader(f.title)) ?? '');
          row = [formatSubmissionTimestamp(), ...values];
        }

        const appendRange = `${sheetName}!A:Z`;
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          linkedSheetId
        )}/values/${encodeURIComponent(
          appendRange
        )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

        await fetch(appendUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [row] }),
        });
      }
    }

    const webhookUrl = getEnv(context, 'SLACK_WEBHOOK_URL');
    if (webhookUrl) {
      const ok = await notifyFormSubmission(webhookUrl, {
        formName: formData.name ?? structure?.title ?? '',
        slug,
        answersByTitle,
      });
      if (!ok) {
        console.error('[api/google/forms/submit] Failed to send Slack notification');
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Response submitted' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[api/google/forms/submit] Error for slug "${slug}":`, err);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: import.meta.env.DEV ? err.message : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
