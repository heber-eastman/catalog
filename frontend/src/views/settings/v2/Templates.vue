<template>
  <div class="pa-4">
    <h2>Templates (V2)</h2>
    <div class="mb-4 row">
      <button @click="createTemplate" class="btn">New Template</button>
      <div class="ml-2">
        <label>Regenerate date</label>
        <input v-model="regenDate" type="date" />
        <button @click="regenerateDate" class="btn sm">Go</button>
      </div>
      <div class="ml-2">
        <label>Regenerate range</label>
        <input v-model="regenStart" type="date" />
        <input v-model="regenEnd" type="date" />
        <button @click="regenerateRange" class="btn sm">Go</button>
      </div>
    </div>
    <ul>
      <li v-for="t in templates" :key="t.id" class="mb-2">
        <div>
          <strong>{{ t.id }}</strong> — status: {{ t.status }} — interval: {{ t.interval_mins }}
        </div>
        <div class="row">
          <input v-model="versionNotes[t.id]" placeholder="Version notes" />
          <button @click="createVersion(t.id)" class="btn sm">Add Version</button>
          <button @click="publish(t.id)" class="btn sm">Publish</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { onMounted, ref, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const templates = ref([]);
const versionNotes = reactive({});
const regenDate = ref('');
const regenStart = ref('');
const regenEnd = ref('');

async function load() {
  const teeSheetId = route.params.teeSheetId;
  if (!teeSheetId) { templates.value = []; return; }
  const { data } = await settingsAPI.v2.listTemplates(teeSheetId);
  templates.value = data || [];
}

async function createTemplate() {
  const teeSheetId = route.params.teeSheetId;
  await settingsAPI.v2.createTemplate(teeSheetId, { interval_mins: 10 });
  await load();
}

async function createVersion(templateId) {
  const teeSheetId = route.params.teeSheetId;
  const notes = versionNotes[templateId] || '';
  await settingsAPI.v2.createTemplateVersion(teeSheetId, templateId, { notes });
  await load();
}

async function publish(templateId) {
  const teeSheetId = route.params.teeSheetId;
  await settingsAPI.v2.publishTemplate(teeSheetId, templateId, {});
  await load();
}

async function regenerateDate() {
  const teeSheetId = route.params.teeSheetId;
  if (!regenDate.value) return;
  await settingsAPI.v2.regenerateDate(teeSheetId, regenDate.value);
}

async function regenerateRange() {
  const teeSheetId = route.params.teeSheetId;
  if (!regenStart.value || !regenEnd.value) return;
  await settingsAPI.v2.regenerateRange(teeSheetId, regenStart.value, regenEnd.value);
}

onMounted(load);
</script>

<style scoped>
.btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
.btn.sm { padding: 4px 8px; }
.row { display: flex; align-items: center; gap: 8px; }
.ml-2 { margin-left: 8px; }
.mb-2 { margin-bottom: 8px; }
</style>


