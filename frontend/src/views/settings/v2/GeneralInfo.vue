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
const canSave = computed(() => !!teeSheet.value && name.value.trim().length >= 2 && name.value.trim() !== (teeSheet.value?.name || ''));

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
  } catch {
    teeSheet.value = null;
  }
}

async function save(){
  if (!teeSheet.value) return;
  try{
    saving.value = true;
    const payload = { name: name.value.trim(), description: teeSheet.value?.description || '', is_active: teeSheet.value?.is_active ?? true };
    const { data } = await settingsAPI.updateTeeSheet(teeSheet.value.id, payload);
    teeSheet.value = data || { ...teeSheet.value, name: payload.name };
    try { window.dispatchEvent(new CustomEvent('tee-sheet-updated', { detail: { id: teeSheet.value.id, name: payload.name } })); } catch {}
  } finally {
    saving.value = false;
  }
}

function reset(){
  name.value = teeSheet.value?.name || '';
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


