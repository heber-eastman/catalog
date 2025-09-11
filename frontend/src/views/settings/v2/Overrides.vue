<template>
  <div class="pa-4">
    <h2>Overrides (V2)</h2>
    <div class="mb-4 row">
      <button @click="createOverride" class="btn" data-cy="override-new-btn">New Override</button>
      <input v-model="overrideDate" type="date" data-cy="override-date-input" />
      <label class="ml-2">Template Version</label>
      <select v-model="templateVersionId" data-cy="override-tmplver-select">
        <option v-for="opt in templateVersionOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
      </select>
    </div>
    <ul>
      <li v-for="o in overrides" :key="o.id" class="mb-2">
        <div class="row">
          <strong>{{ o.date }}</strong> — status: {{ o.status }}
          <button @click="addVersion(o.id)" class="btn sm ml-2" :data-cy="`override-add-version-${o.id}`">Add Version</button>
          <button @click="publish(o.id)" class="btn sm ml-2" :data-cy="`override-publish-${o.id}`">Publish</button>
        </div>
        <div class="row mt-2">
          <label>Side</label>
          <select v-model="editor.sideId" data-cy="override-side-select">
            <option v-for="s in sideOptions" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <label class="ml-2">Mode</label>
          <select v-model="editor.mode" data-cy="override-mode-select">
            <option value="fixed">Fixed</option>
            <option value="sunrise_sunset">Sunrise/Sunset</option>
          </select>
          <template v-if="editor.mode === 'fixed'">
            <input v-model="editor.startTime" type="time" data-cy="override-start-time" />
            <input v-model="editor.endTime" type="time" data-cy="override-end-time" />
          </template>
          <template v-else>
            <input v-model.number="editor.startOffset" type="number" placeholder="start offset mins" data-cy="override-start-offset" />
            <input v-model.number="editor.endOffset" type="number" placeholder="end offset mins" data-cy="override-end-offset" />
          </template>
          <label class="ml-2">Template Version</label>
          <select v-model="templateVersionId" data-cy="override-editor-tmplver-select">
            <option v-for="opt in templateVersionOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
          </select>
          <button class="btn sm ml-2" @click="saveWindow(o.id)" :data-cy="`override-add-window-${o.id}`">Add Window</button>
        </div>
      </li>
    </ul>
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="2500">
      {{ snackbarMessage }}
      <template #actions>
        <v-btn color="white" variant="text" @click="showSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup>
import { onMounted, ref, inject, watch, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const overrides = ref([]);
const overrideDate = ref('');
const templateVersionId = ref('');
const templateVersionOptions = ref([]);
const sideOptions = ref([]);
const editor = reactive({ sideId: '', mode: 'fixed', startTime: '07:00', endTime: '10:00', startOffset: 0, endOffset: 0 });
const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

function notify(message, color = 'success') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  showSnackbar.value = true;
}

async function load() {
  try {
    const teeSheetId = route.params.teeSheetId;
    if (!teeSheetId) { overrides.value = []; return; }
    const { data } = await settingsAPI.v2.listOverrides(teeSheetId);
    overrides.value = data || [];
    await loadTemplateVersions();
    await loadSides();
  } catch (e) {
    notify('Failed to load overrides', 'error');
  }
}

async function createOverride() {
  try {
    const teeSheetId = route.params.teeSheetId;
    const d = overrideDate.value;
    if (!d) return;
    await settingsAPI.v2.createOverride(teeSheetId, { date: d });
    await load();
    notify('Override created');
  } catch (e) {
    notify('Failed to create override', 'error');
  }
}

async function addVersion(overrideId) {
  try {
    const teeSheetId = route.params.teeSheetId;
    await settingsAPI.v2.createOverrideVersion(teeSheetId, overrideId, { notes: 'v1' });
    await load();
    notify('Override version created');
  } catch (e) {
    notify('Failed to add override version', 'error');
  }
}

async function publish(overrideId) {
  try {
    const teeSheetId = route.params.teeSheetId;
    await settingsAPI.v2.publishOverride(teeSheetId, overrideId, {});
    await load();
    notify('Override published');
  } catch (e) {
    notify('Failed to publish override', 'error');
  }
}

onMounted(load);

// Sync calendar-selected date
const selectedDate = inject('settings:selectedDate', ref(''));
watch(selectedDate, (v) => { if (v) overrideDate.value = v; }, { immediate: true });

async function loadTemplateVersions() {
  const teeSheetId = route.params.teeSheetId;
  if (!teeSheetId) { templateVersionOptions.value = []; return; }
  try {
    const { data } = await settingsAPI.v2.listTemplates(teeSheetId);
    const opts = [];
    for (const t of data || []) {
      for (const v of (t.versions || [])) {
        const note = v.notes ? ` — ${v.notes}` : '';
        const tmplShort = (t.id || '').slice(0, 6);
        opts.push({ id: v.id, label: `Tmpl ${tmplShort} v${v.version_number}${note}` });
      }
    }
    templateVersionOptions.value = opts;
  } catch (_) {
    templateVersionOptions.value = [];
  }
}

async function loadSides() {
  const teeSheetId = route.params.teeSheetId;
  try {
    const { data } = await settingsAPI.listSides(teeSheetId);
    sideOptions.value = data || [];
    if (sideOptions.value.length && !editor.sideId) editor.sideId = sideOptions.value[0].id;
  } catch (_) {
    sideOptions.value = [];
  }
}

async function saveWindow(overrideId) {
  const teeSheetId = route.params.teeSheetId;
  if (!templateVersionId.value || !editor.sideId) { notify('Missing side or template', 'error'); return; }
  // ensure there is a version to attach the window
  const { data: ovv } = await settingsAPI.v2.createOverrideVersion(teeSheetId, overrideId, { notes: 'window' });
  const body = editor.mode === 'fixed'
    ? { side_id: editor.sideId, start_mode: 'fixed', end_mode: 'fixed', start_time_local: editor.startTime + ':00', end_time_local: editor.endTime + ':00', template_version_id: templateVersionId.value }
    : { side_id: editor.sideId, start_mode: 'sunrise_offset', end_mode: 'sunset_offset', start_offset_mins: Number(editor.startOffset)||0, end_offset_mins: Number(editor.endOffset)||0, template_version_id: templateVersionId.value };
  try {
    await settingsAPI.v2.addOverrideWindow(teeSheetId, overrideId, ovv.id, body);
    notify('Override window added');
  } catch (e) {
    notify('Failed to add override window', 'error');
  }
}
</script>

<style scoped>
.btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
.row { display: flex; align-items: center; gap: 8px; }
</style>


