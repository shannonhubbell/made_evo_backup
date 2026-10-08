/**
 * Google Forms API – fetch form structure (questions and types).
 * Uses custom JWT + fetch instead of googleapis (Worker-friendly).
 */

import type { APIContext } from 'astro';
import { getServiceAccount, getAccessTokenFromServiceAccount } from './google-auth';

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'date'
  | 'time'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'range'
  | 'rating';

export interface FormFieldSchema {
  id: string;
  title: string;
  type: FormFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
}

export interface FormStructure {
  formId: string;
  title?: string;
  description?: string;
  fields: FormFieldSchema[];
  linkedSheetId?: string;
  /** When true, form collects email via RESPONDER_INPUT – ensure email field uses type="email" */
  requiresEmail?: boolean;
}

function isLikelyEmailQuestion(title: string): boolean {
  const t = (title || '').toLowerCase().trim();
  return /email|e-mail|correo|your\s+email|respondent/i.test(t) || t === 'email';
}

function hasEmailField(fields: FormFieldSchema[]): boolean {
  return fields.some((f) => f.type === 'email');
}

/** Standard title for synthetic email field – matches typical Google Forms sheet column */
export const RESPONDENT_EMAIL_FIELD_ID = 'respondentEmail';
export const RESPONDENT_EMAIL_FIELD_TITLE = 'Email address';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractQuestionItems(items: any[], requiresEmail: boolean): FormFieldSchema[] {
  const fields: FormFieldSchema[] = [];

  for (const item of items ?? []) {
    if (item.questionItem?.question) {
      const q = item.questionItem.question;
      const questionId = q.questionId || item.itemId || '';
      const title = item.title || q.rowQuestion?.title || 'Question';
      const required = !!q.required;

      if (q.textQuestion) {
        const isEmail = requiresEmail && isLikelyEmailQuestion(title);
        fields.push({
          id: questionId,
          title,
          type: isEmail ? 'email' : (q.textQuestion.paragraph ? 'textarea' : 'text'),
          required: isEmail ? true : required,
        });
      } else if (q.choiceQuestion) {
        const type = q.choiceQuestion.type;
        let inputType: FormFieldType = 'radio';
        if (type === 'CHECKBOX') inputType = 'checkbox';
        else if (type === 'DROP_DOWN') inputType = 'select';
        else inputType = 'radio';

        const options =
          q.choiceQuestion.options?.map((opt: { value?: string }) => ({
            value: opt.value ?? '',
            label: opt.value ?? '',
          })) ?? [];

        fields.push({
          id: questionId,
          title,
          type: inputType,
          required,
          options,
        });
      } else if (q.scaleQuestion) {
        fields.push({
          id: questionId,
          title,
          type: 'range',
          required,
          min: q.scaleQuestion.low ?? 0,
          max: q.scaleQuestion.high ?? 10,
          lowLabel: q.scaleQuestion.lowLabel,
          highLabel: q.scaleQuestion.highLabel,
        });
      } else if (q.dateQuestion) {
        fields.push({
          id: questionId,
          title,
          type: 'date',
          required,
        });
      } else if (q.timeQuestion) {
        fields.push({
          id: questionId,
          title,
          type: 'time',
          required,
        });
      } else if (q.ratingQuestion) {
        fields.push({
          id: questionId,
          title,
          type: 'rating',
          required,
          min: 1,
          max: q.ratingQuestion.ratingScaleLevel ?? 5,
        });
      } else if (q.rowQuestion) {
        // Part of a question group – simplified as text for now
        fields.push({
          id: questionId,
          title,
          type: 'text',
          required,
        });
      } else {
        fields.push({
          id: questionId,
          title,
          type: 'text',
          required,
        });
      }
    } else if (item.questionGroupItem?.questions) {
      for (const q of item.questionGroupItem.questions) {
        const questionId = q.questionId || '';
        const title = q.rowQuestion?.title || item.title || 'Question';
        const required = !!q.required;
        if (q.choiceQuestion) {
          const type = q.choiceQuestion.type;
          let inputType: FormFieldType = type === 'CHECKBOX' ? 'checkbox' : 'radio';
          if (type === 'DROP_DOWN') inputType = 'select';
          const options =
            q.choiceQuestion.options?.map((opt: { value?: string }) => ({
              value: opt.value ?? '',
              label: opt.value ?? '',
            })) ?? [];
          fields.push({ id: questionId, title, type: inputType, required, options });
        } else {
          fields.push({ id: questionId, title, type: 'text', required });
        }
      }
    }
  }

  return fields;
}

/**
 * Fetches form structure from Google Forms API.
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON and the form shared with the service account.
 */
export async function fetchFormStructure(
  context: APIContext,
  formId: string
): Promise<FormStructure | null> {
  try {
    const serviceAccount = await getServiceAccount(context);
    if (!serviceAccount) return null;

    const accessToken = await getAccessTokenFromServiceAccount(serviceAccount, [
      'https://www.googleapis.com/auth/forms.body.readonly',
    ]);

    const url = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(
      formId
    )}?fields=formId,info,items,linkedSheetId,settings`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[google-forms] forms.get failed:', res.status, text);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = (await res.json()) as any;
    const settings = form?.settings as { emailCollectionType?: string } | undefined;
    const requiresEmail = settings?.emailCollectionType === 'RESPONDER_INPUT';

    let fields = extractQuestionItems(form?.items ?? [], requiresEmail);

    // When form requires email but no email field found, add one (Google may not expose it in items)
    if (requiresEmail && !hasEmailField(fields)) {
      fields = [
        {
          id: RESPONDENT_EMAIL_FIELD_ID,
          title: RESPONDENT_EMAIL_FIELD_TITLE,
          type: 'email' as FormFieldType,
          required: true,
        },
        ...fields,
      ];
    }

    return {
      formId: form?.formId ?? formId,
      title: (form?.info as { title?: string })?.title,
      description: (form?.info as { description?: string })?.description,
      fields,
      linkedSheetId: form?.linkedSheetId ?? undefined,
      requiresEmail,
    };
  } catch (err) {
    console.error('[google-forms] Error fetching form structure:', err);
    return null;
  }
}
