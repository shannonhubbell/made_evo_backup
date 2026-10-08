<script setup lang="ts">
import { ref, watch, computed } from 'vue';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldSchema {
  id: string;
  title: string;
  type: string;
  required?: boolean;
  options?: FormFieldOption[];
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
}

export interface GoogleFormData {
  id: string;
  name?: string;
  slug?: string;
  formId?: string;
  embedUrl?: string;
  fields?: FormFieldSchema[];
  /** When true, form collects email – email field uses type="email" and validation */
  requiresEmail?: boolean;
}

const props = defineProps<{
  form: GoogleFormData;
}>();

const values = ref<Record<string, string | string[]>>({});
const submitting = ref(false);
const submitStatus = ref<'idle' | 'success' | 'error'>('idle');
const submitError = ref('');

const fields = computed(() => props.form.fields ?? []);

watch(
  () => props.form.fields,
  (f) => {
    const next: Record<string, string | string[]> = {};
    for (const field of f ?? []) {
      next[field.id] = field.type === 'checkbox' ? [] : '';
    }
    values.value = next;
  },
  { immediate: true }
);

function getValue(id: string): string | string[] {
  return values.value[id] ?? '';
}

function setValue(id: string, v: string | string[]) {
  values.value = { ...values.value, [id]: v };
}

function inputType(field: FormFieldSchema): string {
  switch (field.type) {
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'number':
    case 'range':
    case 'rating':
      return 'number';
    case 'email':
      return 'email';
    default:
      return 'text';
  }
}

async function submit() {
  if (submitting.value || !props.form.slug) return;

  submitting.value = true;
  submitStatus.value = 'idle';
  submitError.value = '';

  try {
    const r = await fetch(`/api/google/forms/${encodeURIComponent(props.form.slug)}/submit.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: values.value }),
    });
    const data = await r.json();

    if (!r.ok) {
      submitStatus.value = 'error';
      submitError.value = data.error || data.message || 'Submission failed';
      return;
    }

    submitStatus.value = 'success';
    values.value = Object.fromEntries(
      (props.form.fields ?? []).map((f) => [f.id, f.type === 'checkbox' ? [] : ''])
    );
  } catch (e) {
    submitStatus.value = 'error';
    submitError.value = e instanceof Error ? e.message : 'Submission failed';
  } finally {
    submitting.value = false;
  }
}

// For checkbox: treat value as string when single, string[] when multiple
function getCheckboxValues(fieldId: string): string[] {
  const v = values.value[fieldId];
  return Array.isArray(v) ? v : v ? [v] : [];
}

function toggleCheckbox(fieldId: string, optionValue: string) {
  const current = getCheckboxValues(fieldId);
  const next = current.includes(optionValue)
    ? current.filter((x) => x !== optionValue)
    : [...current, optionValue];
  setValue(fieldId, next);
}
</script>

<template>
  <div class="google-form">
    <!-- Custom form with typed inputs -->
    <form v-if="fields.length" @submit.prevent="submit" class="space-y-5">
      <fieldset
        v-for="field in fields"
        :key="field.id"
        class="flex flex-col gap-1.5"
      >
        <label
          :for="`gf-${field.id}`"
          class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {{ field.title }}
          <span v-if="field.required" class="text-red-500">*</span>
        </label>

        <!-- Text / Textarea / Email / Date / Time / Number -->
        <input
          v-if="['text', 'email', 'date', 'time', 'number'].includes(field.type)"
          :id="`gf-${field.id}`"
          :type="inputType(field)"
          :value="getValue(field.id) as string"
          :required="field.required"
          @input="setValue(field.id, (($event.target as HTMLInputElement).value))"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        <textarea
          v-else-if="field.type === 'textarea'"
          :id="`gf-${field.id}`"
          :value="getValue(field.id) as string"
          :required="field.required"
          rows="4"
          @input="setValue(field.id, (($event.target as HTMLTextAreaElement).value))"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        <!-- Range -->
        <div v-else-if="field.type === 'range'" class="flex items-center gap-3">
          <span v-if="field.lowLabel" class="text-xs text-gray-500">{{ field.lowLabel }}</span>
          <input
            :id="`gf-${field.id}`"
            type="range"
            :min="field.min ?? 0"
            :max="field.max ?? 10"
            :value="getValue(field.id) || (field.min ?? 0)"
            @input="setValue(field.id, ($event.target as HTMLInputElement).value)"
            class="flex-1"
          />
          <span v-if="field.highLabel" class="text-xs text-gray-500">{{ field.highLabel }}</span>
        </div>

        <!-- Rating (numeric 1–5 etc) -->
        <input
          v-else-if="field.type === 'rating'"
          :id="`gf-${field.id}`"
          type="number"
          :min="field.min ?? 1"
          :max="field.max ?? 5"
          :value="getValue(field.id) || ''"
          :required="field.required"
          @input="setValue(field.id, ($event.target as HTMLInputElement).value)"
          class="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        <!-- Select -->
        <select
          v-else-if="field.type === 'select'"
          :id="`gf-${field.id}`"
          :value="getValue(field.id) as string"
          :required="field.required"
          @change="setValue(field.id, ($event.target as HTMLSelectElement).value)"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Select…</option>
          <option
            v-for="opt in (field.options ?? [])"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label || opt.value }}
          </option>
        </select>

        <!-- Radio -->
        <div v-else-if="field.type === 'radio'" class="flex flex-col gap-2">
          <label
            v-for="opt in (field.options ?? [])"
            :key="opt.value"
            class="flex items-center gap-2"
          >
            <input
              type="radio"
              :name="`gf-${field.id}`"
              :value="opt.value"
              :checked="(getValue(field.id) as string) === opt.value"
              @change="setValue(field.id, opt.value)"
            />
            <span>{{ opt.label || opt.value }}</span>
          </label>
        </div>

        <!-- Checkbox -->
        <div v-else-if="field.type === 'checkbox'" class="flex flex-col gap-2">
          <label
            v-for="opt in (field.options ?? [])"
            :key="opt.value"
            class="flex items-center gap-2"
          >
            <input
              type="checkbox"
              :value="opt.value"
              :checked="getCheckboxValues(field.id).includes(opt.value)"
              @change="toggleCheckbox(field.id, opt.value)"
            />
            <span>{{ opt.label || opt.value }}</span>
          </label>
        </div>
      </fieldset>

      <div class="flex flex-col gap-2 pt-2">
        <button
          type="submit"
          :disabled="submitting"
          class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {{ submitting ? 'Submitting…' : 'Submit' }}
        </button>
        <p v-if="submitStatus === 'success'" class="text-sm text-green-600 dark:text-green-400">
          Thank you! Your response has been submitted.
        </p>
        <p v-else-if="submitStatus === 'error'" class="text-sm text-red-600 dark:text-red-400">
          {{ submitError }}
        </p>
      </div>
    </form>

    <!-- Fallback: iframe embed when no fields from API -->
    <div v-else-if="form.embedUrl" class="google-form-embed">
      <iframe
        :src="form.embedUrl"
        width="100%"
        height="600"
        frameborder="0"
        marginheight="0"
        marginwidth="0"
        class="min-h-[400px] w-full rounded-md border border-gray-200 dark:border-gray-600"
        title="Google Form"
      >
        Loading…
      </iframe>
    </div>

    <div
      v-else
      class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
    >
      No form configuration. Set formId in Contentful for slug &quot;{{ form.slug || form.id }}&quot;
      and ensure the form is shared with the service account.
    </div>
  </div>
</template>
