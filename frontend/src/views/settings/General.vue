<template>
  <div class="general pa-4" data-cy="settings-general-info">
    <h2 class="mb-2">General Info</h2>
    <p class="muted mb-4">Summary for the selected tee sheet.</p>

    <div class="card">
      <div class="row">
        <div class="col">
          <label class="lbl" for="gi-name">Tee sheet name</label>
          <input id="gi-name" :value="teeSheet?.name || ''" disabled aria-label="Tee sheet name" />
        </div>
        <div class="col">
          <label class="lbl" for="gi-id">Tee sheet ID</label>
          <input id="gi-id" :value="teeSheet?.id || ''" disabled aria-label="Tee sheet ID" />
        </div>
      </div>

      <div class="row mt-2">
        <div class="col">
          <label class="lbl" for="gi-timezone">Timezone</label>
          <input id="gi-timezone" :value="courseTimezone" disabled aria-label="Course timezone" />
        </div>
        <div class="col two">
          <label class="lbl" for="gi-lat">Latitude</label>
          <input id="gi-lat" :value="courseLat" disabled aria-label="Course latitude" />
        </div>
        <div class="col two">
          <label class="lbl" for="gi-lon">Longitude</label>
          <input id="gi-lon" :value="courseLon" disabled aria-label="Course longitude" />
        </div>
      </div>

      <p class="muted mt-3">Editing coming soon. Manage seasons, templates, and overrides from the sidebar.</p>
    </div>
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
    // Best-effort: Some backends include course fields on tee sheet; otherwise leave blank
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
.general .muted{ color:#6b778c; font-size:14px; }
.card{ border:1px solid #e0e0e0; border-radius:8px; padding:12px; }
.row{ display:flex; gap:12px; align-items:flex-start; }
.col{ flex:1; display:flex; flex-direction:column; }
.col.two{ max-width:180px; }
.lbl{ font-size:12px; color:#6b778c; margin-bottom:6px; }
input{ width:100%; padding:8px; border:1px solid #e0e0e0; border-radius:6px; background:#fafafa; }
.mb-2{ margin-bottom:8px; }
.mb-4{ margin-bottom:16px; }
.mt-2{ margin-top:8px; }
.mt-3{ margin-top:12px; }
.pa-4{ padding:16px; }
</style>


