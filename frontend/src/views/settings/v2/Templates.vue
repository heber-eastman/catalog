<template>
  <div class="pa-4">
    <h2>Templates (V2)</h2>
    <div class="mb-4 row">
      <button @click="createTemplate" class="btn" :disabled="busy">New Template</button>
      <div class="ml-2">
        <label>Regenerate date</label>
        <input v-model="regenDate" type="date" />
        <button @click="regenerateDate" class="btn sm" :disabled="busy || !regenDate">Go</button>
      </div>
      <div class="ml-2">
        <label>Regenerate range</label>
        <input v-model="regenStart" type="date" />
        <input v-model="regenEnd" type="date" />
        <button @click="regenerateRange" class="btn sm" :disabled="busy || !regenStart || !regenEnd || regenStart > regenEnd">Go</button>
      </div>
    </div>
    <ul>
      <li v-for="t in templates" :key="t.id" class="mb-2">
        <div>
          <strong>{{ t.id }}</strong> — status: {{ t.status }} — interval: {{ t.interval_mins }}
        </div>
        <div class="row">
          <input v-model="versionNotes[t.id]" placeholder="Version notes" />
          <button @click="createVersion(t.id)" class="btn sm" :disabled="busy">Add Version</button>
          <button @click="publish(t.id)" class="btn sm" :disabled="busy">Publish</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { onMounted, ref, reactive, computed } from 'vue';
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
  } catch (e) {
    alert('Failed to create template');
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
  } catch (e) {
    alert('Failed to create template version');
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
  } catch (e) {
    alert('Failed to publish template');
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
  } catch (e) {
    alert('Failed to regenerate date');
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
  } catch (e) {
    alert('Failed to regenerate range');
  } finally {
    busy.value = false;
  }
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


