<template>
  <div class="general pa-4" data-cy="settings-tee-sheet-general-info">
    <h2 class="title">General Info</h2>
    <p class="muted mb-4">Tee sheet ID: {{ teeSheet?.id || '—' }}</p>

    <v-card variant="outlined" class="gi-card">
      <div class="gi-toolbar">
        <v-btn color="primary" :disabled="!canSave || saving" @click="save">{{ saving ? 'Saving…' : 'Save' }}</v-btn>
        <v-btn variant="text" :disabled="saving || name===teeSheet?.name" @click="reset">Cancel</v-btn>
      </div>
      <div class="gi-grid">
        <v-text-field
          v-model="name"
          label="Tee sheet name"
          variant="outlined"
          density="comfortable"
          hide-details
          :readonly="saving"
          class="field span-2"
        />
    <v-text-field
      v-model="dailyRelease"
      label="Daily release time (HH:MM)"
      variant="outlined"
      density="comfortable"
      :rules="timeRules"
      hint="Local time when booking opens each day (e.g., 07:00)"
      persistent-hint
      :readonly="saving"
      class="field"
      placeholder="07:00"
      @blur="normalizeTime"
    />
      </div>

    </v-card>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const teeSheet = ref(null);
const name = ref('');
const courseTimezone = ref('');
const courseLat = ref('');
const courseLon = ref('');
const saving = ref(false);
const dailyRelease = ref('07:00');
const timeRules = [
  (v) => /^\d{2}:\d{2}$/.test(String(v || '')) || 'Use HH:MM (24-hour)',
  (v) => {
    const m = String(v || '').match(/^(\d{2}):(\d{2})$/);
    if (!m) return true;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    return (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) || 'Invalid time';
  },
];

function normalizeTime(){
  const v = String(dailyRelease.value || '').trim();
  // Accept H:MM and HH:M formats and pad to HH:MM
  const m = v.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return; // leave as-is; rules will show error if needed
  let hh = String(m[1]).padStart(2, '0');
  let mm = String(m[2]).padStart(2, '0');
  const hhn = Number(hh);
  const mmn = Number(mm);
  if (!(hhn >= 0 && hhn <= 23 && mmn >= 0 && mmn <= 59)) return;
  dailyRelease.value = `${hh}:${mm}`;
}
const canSave = computed(() => {
  if (!teeSheet.value) return false;
  const nameChanged = name.value.trim() !== (teeSheet.value?.name || '');
  const drChanged = (dailyRelease.value || '').trim() !== (teeSheet.value?.daily_release_local || '07:00');
  return name.value.trim().length >= 2 && (nameChanged || drChanged);
});

async function load(){
  try {
    const { data } = await settingsAPI.listTeeSheets();
    const id = route.params.teeSheetId;
    const found = Array.isArray(data) ? data.find(s => String(s.id) === String(id)) : null;
    teeSheet.value = found || null;
    name.value = found?.name || '';
    courseTimezone.value = found?.timezone || '';
    courseLat.value = found?.latitude ?? '';
    courseLon.value = found?.longitude ?? '';
  dailyRelease.value = (found?.daily_release_local || '07:00');
  } catch {
    teeSheet.value = null;
  }
}

async function save(){
  if (!teeSheet.value) return;
  try{
    saving.value = true;
    const payload = { name: name.value.trim(), description: teeSheet.value?.description || '', is_active: teeSheet.value?.is_active ?? true, daily_release_local: (dailyRelease.value || '07:00').trim() };
    const { data } = await settingsAPI.updateTeeSheet(teeSheet.value.id, payload);
    teeSheet.value = data || { ...teeSheet.value, name: payload.name };
    // reflect updated daily release locally if response is partial
    teeSheet.value.daily_release_local = data?.daily_release_local || payload.daily_release_local;
    try { window.dispatchEvent(new CustomEvent('tee-sheet-updated', { detail: { id: teeSheet.value.id, name: payload.name } })); } catch {}
  } finally {
    saving.value = false;
  }
}

function reset(){
  name.value = teeSheet.value?.name || '';
  dailyRelease.value = teeSheet.value?.daily_release_local || '07:00';
}

onMounted(load);
</script>

<style scoped>
.title{ font-weight:800; font-size:28px; margin-bottom:6px; }
.general .muted{ color:#6b778c; font-size:14px; }
.gi-card{ padding:12px; border-radius:8px; }
.gi-toolbar{ display:flex; justify-content:flex-end; gap:8px; margin-bottom:8px; }
.gi-grid{ display:grid; grid-template-columns: repeat(2, minmax(280px, 1fr)); gap:16px; }
.field :deep(.v-field){ border-radius:6px; }
.span-2{ grid-column: span 2; }
.mb-4{ margin-bottom:16px; }
.mt-3{ margin-top:12px; }
.pa-4{ padding:16px; }
</style>


