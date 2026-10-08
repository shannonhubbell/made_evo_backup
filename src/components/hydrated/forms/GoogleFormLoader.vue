<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import GoogleForm from './GoogleForm.vue';
import type { GoogleFormData } from './GoogleForm.vue';

const props = defineProps<{
  slug: string;
}>();

const form = ref<GoogleFormData | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  form.value = null;
  try {
    const r = await fetch(`/api/google/forms/${encodeURIComponent(props.slug)}.json`);
    const data = await r.json();
    if (data.error) {
      error.value = data.error;
    } else {
      form.value = data;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load form';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.slug, load);
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="text-gray-500 dark:text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-600 dark:text-red-400 text-sm">{{ error }}</div>
    <GoogleForm v-else-if="form" :form="form" />
  </div>
</template>
