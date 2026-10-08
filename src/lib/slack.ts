/**
 * Slack notification helpers – send messages via Incoming Webhooks.
 *
 * Set SLACK_WEBHOOK_URL in your environment to enable notifications.
 * Create a webhook at https://api.slack.com/messaging/webhooks
 */

export interface SlackPayload {
  /** Fallback text for notifications and search. */
  text: string;
  /** Block Kit blocks for rich formatting (optional). */
  blocks?: SlackBlock[];
  /** Override default username (optional). */
  username?: string;
  /** Override default icon (optional). */
  icon_emoji?: string;
}

export type SlackBlock =
  | { type: 'section'; text: { type: 'mrkdwn'; text: string } }
  | { type: 'divider' }
  | { type: 'context'; elements: { type: 'mrkdwn'; text: string }[] };

/**
 * Send a message to Slack via Incoming Webhook.
 * @param webhookUrl - Slack Incoming Webhook URL (from Slack app config).
 * @param payload - Message payload (text required, blocks optional).
 * @returns true if sent successfully, false otherwise.
 */
export async function sendToSlack(
  webhookUrl: string,
  payload: SlackPayload
): Promise<boolean> {
  if (!webhookUrl?.trim()) return false;
  try {
    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[slack] Webhook error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[slack] Failed to send:', err);
    return false;
  }
}

/**
 * Build a Slack payload for a form submission notification.
 */
export function formatFormSubmissionPayload(options: {
  formName: string;
  slug: string;
  answersByTitle: Map<string, string>;
}): SlackPayload {
  const { formName, slug, answersByTitle } = options;
  const title = formName || slug;
  const lines = Array.from(answersByTitle.entries())
    .map(([label, value]) => `*${label}*: ${value || '_empty_'}`)
    .join('\n');

  const text = `Form submission: ${title}\n\n${lines}`;
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*New form submission*\n*Form:* ${title} (\`${slug}\`)`,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: lines || '_No answers_',
      },
    },
  ];

  return { text, blocks };
}

/**
 * Send a form submission notification to Slack.
 * @param webhookUrl - Slack Incoming Webhook URL.
 * @param options - Form name, slug, and answers by label.
 * @returns true if sent successfully, false otherwise.
 */
export async function notifyFormSubmission(
  webhookUrl: string,
  options: {
    formName: string;
    slug: string;
    answersByTitle: Map<string, string>;
  }
): Promise<boolean> {
  const payload = formatFormSubmissionPayload(options);
  return sendToSlack(webhookUrl, payload);
}
