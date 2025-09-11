<template>
  <div class="pa-4" data-cy="templates-v2">
    <h2>Templates (V2)</h2>
    <div class="mb-4 row">
      <button @click="createTemplate" class="btn" :disabled="busy" data-cy="template-new-btn">New Template</button>
      <div class="ml-2">
        <label>Regenerate date</label>
        <input v-model="regenDate" type="date" data-cy="regen-date-input" />
        <button @click="regenerateDate" class="btn sm" :disabled="busy || !regenDate" data-cy="regen-date-go">Go</button>
      </div>
      <div class="ml-2">
        <label>Regenerate range</label>
        <input v-model="regenStart" type="date" data-cy="regen-start-input" />
        <input v-model="regenEnd" type="date" data-cy="regen-end-input" />
        <button @click="regenerateRange" class="btn sm" :disabled="busy || !regenStart || !regenEnd || regenStart > regenEnd" data-cy="regen-range-go">Go</button>
      </div>
    </div>
    <div v-if="busy" class="muted" data-cy="templates-loading">Loading…</div>
    <div v-else-if="!templates.length" class="muted" data-cy="templates-empty">No templates yet</div>
    <ul v-else>
      <li v-for="t in templates" :key="t.id" class="mb-2">
        <div>
          <strong>{{ t.id }}</strong> — status: {{ t.status }} — interval: {{ t.interval_mins }}
        </div>
        <div class="row">
          <input v-model="versionNotes[t.id]" placeholder="Version notes" :data-cy="`template-notes-${t.id}`" />
          <button @click="createVersion(t.id)" class="btn sm" :disabled="busy" :data-cy="`template-add-version-${t.id}`">Add Version</button>
          <button @click="publish(t.id)" class="btn sm" :disabled="busy" :data-cy="`template-publish-${t.id}`">Publish</button>
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
import { onMounted, ref, reactive, computed, inject, watch } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const templates = ref([]);
const versionNotes = reactive({});
const regenDate = ref('');
const regenStart = ref('');
const regenEnd = ref('');
const busy = ref(false);
const invalidRange = computed(() => !!regenStart.value && !!regenEnd.value && regenStart.value > regenEnd.value);
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
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    if (!teeSheetId) { templates.value = []; return; }
    const { data } = await settingsAPI.v2.listTemplates(teeSheetId);
    templates.value = data || [];
  } catch (e) {
    alert('Failed to load templates');
  } finally {
    busy.value = false;
  }
}

async function createTemplate() {
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    await settingsAPI.v2.createTemplate(teeSheetId, { interval_mins: 10 });
    await load();
    notify('Template created');
  } catch (e) {
    notify('Failed to create template', 'error');
  } finally {
    busy.value = false;
  }
}

async function createVersion(templateId) {
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    const notes = versionNotes[templateId] || '';
    await settingsAPI.v2.createTemplateVersion(teeSheetId, templateId, { notes });
    await load();
    notify('Version created');
  } catch (e) {
    notify('Failed to create template version', 'error');
  } finally {
    busy.value = false;
  }
}

async function publish(templateId) {
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    await settingsAPI.v2.publishTemplate(teeSheetId, templateId, {});
    await load();
    notify('Template published');
  } catch (e) {
    notify('Failed to publish template', 'error');
  } finally {
    busy.value = false;
  }
}

async function regenerateDate() {
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    if (!regenDate.value) return;
    await settingsAPI.v2.regenerateDate(teeSheetId, regenDate.value);
    notify('Regeneration queued for date');
  } catch (e) {
    notify('Failed to regenerate date', 'error');
  } finally {
    busy.value = false;
  }
}

async function regenerateRange() {
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    if (!regenStart.value || !regenEnd.value || invalidRange.value) return;
    await settingsAPI.v2.regenerateRange(teeSheetId, regenStart.value, regenEnd.value);
    notify('Regeneration queued for range');
  } catch (e) {
    notify('Failed to regenerate range', 'error');
  } finally {
    busy.value = false;
  }
}

onMounted(load);

// Sync calendar-selected date
const selectedDate = inject('settings:selectedDate', ref(''));
watch(selectedDate, (v) => { if (v) regenDate.value = v; }, { immediate: true });
</script>

<style scoped>
.btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
.btn.sm { padding: 4px 8px; }
.row { display: flex; align-items: center; gap: 8px; }
.ml-2 { margin-left: 8px; }
.mb-2 { margin-bottom: 8px; }
</style>


