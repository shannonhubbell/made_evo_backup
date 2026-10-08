<script setup lang="ts">
import { ref, watch } from 'vue';

export interface SheetFormField {
  key: string;
  label: string;
}

export interface GoogleSheetFormData {
  id: string;
  name?: string;
  slug?: string;
  spreadsheetId?: string;
  tableName?: string;
  fields: SheetFormField[];
}

const props = defineProps<{
  form: GoogleSheetFormData;
}>();

const values = ref<Record<string, string>>({});

watch(
  () => props.form.fields,
  (fields) => {
    values.value = Object.fromEntries((fields ?? []).map((f) => [f.key, '']));
  },
  { immediate: true }
);

function getValue(key: string): string {
  return values.value[key] ?? '';
}

function setValue(key: string, v: string) {
  values.value = { ...values.value, [key]: v };
}
</script>

<template>
  <form class="space-y-4">
    <fieldset v-for="field in form.fields" :key="field.key" class="flex flex-col gap-1">
      <label :for="`gsf-${field.key}`" class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ field.label }}
      </label>
      <input
        :id="`gsf-${field.key}`"
        type="text"
        :value="getValue(field.key)"
        @input="(e) => setValue(field.key, (e.target as HTMLInputElement).value)"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
    </fieldset>
  </form>
</template>
