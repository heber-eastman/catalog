<template>
  <div class="pa-4">
    <h2>Templates (V2)</h2>
    <div class="mb-4">
      <button @click="createTemplate" class="btn">New Template</button>
    </div>
    <ul>
      <li v-for="t in templates" :key="t.id">
        <strong>{{ t.id }}</strong> — status: {{ t.status }} — interval: {{ t.interval_mins }}
        <button @click="createVersion(t.id)">Add Version</button>
        <button @click="publish(t.id)">Publish</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const templates = ref([]);

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
  await settingsAPI.v2.createTemplateVersion(teeSheetId, templateId, { notes: 'v1' });
  await load();
}

async function publish(templateId) {
  const teeSheetId = route.params.teeSheetId;
  await settingsAPI.v2.publishTemplate(teeSheetId, templateId, {});
  await load();
}

onMounted(load);
</script>

<style scoped>
.btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
</style>


