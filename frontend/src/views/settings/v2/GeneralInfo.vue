<template>
  <div class="general pa-4" data-cy="settings-tee-sheet-general-info">
    <h2 class="title">General Info</h2>
    <p class="muted mb-4">Summary for this tee sheet.</p>

    <v-card variant="outlined" class="gi-card">
      <div class="gi-grid">
        <v-text-field
          :model-value="teeSheet?.name || ''"
          label="Tee sheet name"
          variant="outlined"
          density="comfortable"
          hide-details
          readonly
          class="field span-2"
        />
        <v-text-field
          :model-value="teeSheet?.id || ''"
          label="Tee sheet ID"
          variant="outlined"
          density="comfortable"
          hide-details
          readonly
          class="field span-2"
        />
      </div>

    </v-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const teeSheet = ref(null);
const courseTimezone = ref('');
const courseLat = ref('');
const courseLon = ref('');

async function load(){
  try {
    const { data } = await settingsAPI.listTeeSheets();
    const id = route.params.teeSheetId;
    const found = Array.isArray(data) ? data.find(s => String(s.id) === String(id)) : null;
    teeSheet.value = found || null;
    courseTimezone.value = found?.timezone || '';
    courseLat.value = found?.latitude ?? '';
    courseLon.value = found?.longitude ?? '';
  } catch {
    teeSheet.value = null;
  }
}

onMounted(load);
</script>

<style scoped>
.title{ font-weight:800; font-size:28px; margin-bottom:6px; }
.general .muted{ color:#6b778c; font-size:14px; }
.gi-card{ padding:12px; border-radius:8px; }
.gi-grid{ display:grid; grid-template-columns: repeat(2, minmax(280px, 1fr)); gap:16px; }
.field :deep(.v-field){ border-radius:6px; }
.span-2{ grid-column: span 2; }
.mb-4{ margin-bottom:16px; }
.mt-3{ margin-top:12px; }
.pa-4{ padding:16px; }
</style>


