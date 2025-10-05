<template>
  <div class="general pa-4" data-cy="settings-course-general">
    <h2 class="mb-2">General Settings</h2>
    <p class="muted mb-4">Course-level settings.</p>

    <div v-if="!hasAnyTeeSheet" class="cta mb-3">
      <p class="muted">No tee sheets yet. Create one to configure sides, seasons, templates and overrides.</p>
      <button
        class="btn primary"
        :disabled="creating"
        @click="createTeeSheet"
        data-cy="create-tee-sheet"
        aria-label="Create tee sheet"
      >
        {{ creating ? 'Creating…' : 'Create Tee Sheet' }}
      </button>
    </div>

    <div class="card">
      <div class="row">
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

      <p class="muted mt-3">Editing coming soon.</p>
    </div>
  </div>
  
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const router = useRouter();
const teeSheet = ref(null);
const courseTimezone = ref('');
const courseLat = ref('');
const courseLon = ref('');
const hasAnyTeeSheet = ref(true);
const creating = ref(false);

async function load(){
  try {
    const { data } = await settingsAPI.listTeeSheets();
    hasAnyTeeSheet.value = Array.isArray(data) ? data.length > 0 : false;
    const id = route.params.teeSheetId;
    const found = Array.isArray(data) ? data.find(s => String(s.id) === String(id)) : null;
    teeSheet.value = found || null;
    // Best-effort: Some backends include course fields on tee sheet; otherwise leave blank
    courseTimezone.value = found?.timezone || '';
    courseLat.value = found?.latitude ?? '';
    courseLon.value = found?.longitude ?? '';
  } catch {
    teeSheet.value = null;
    hasAnyTeeSheet.value = false;
  }
}

async function createTeeSheet(){
  try {
    creating.value = true;
    const payload = { name: 'Main', description: 'Primary tee sheet', is_active: true };
    const { data } = await settingsAPI.createTeeSheet(payload);
    try { localStorage.setItem('teeSheet:lastSheet', data.id); } catch {}
    router.push({ name: 'SettingsTeeSheetsSides', params: { teeSheetId: data.id } });
  } catch (e) {
    // Best-effort notify
    try { window.dispatchEvent(new CustomEvent('snack', { detail: { color: 'error', text: 'Failed to create tee sheet' } })); } catch {}
  } finally {
    creating.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.general .muted{ color:#6b778c; font-size:14px; }
.cta{ border:1px dashed #b3e5fc; background:#f5fcff; padding:12px; border-radius:8px; }
.btn{ border:none; padding:8px 12px; border-radius:6px; cursor:pointer; }
.btn.primary{ background:#1976d2; color:#fff; }
.btn.primary[disabled]{ opacity:0.7; cursor:default; }
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


