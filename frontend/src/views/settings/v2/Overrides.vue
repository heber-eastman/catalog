<template>
  <div class="pa-4">
    <h2>Overrides (V2)</h2>
    <div class="mb-4">
      <button @click="createOverride" class="btn">New Override</button>
    </div>
    <ul>
      <li v-for="o in overrides" :key="o.id">
        <strong>{{ o.date }}</strong> — status: {{ o.status }}
        <button @click="addVersion(o.id)">Add Version</button>
        <button @click="publish(o.id)">Publish</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const overrides = ref([]);

async function load() {
  const teeSheetId = route.params.teeSheetId;
  if (!teeSheetId) { overrides.value = []; return; }
  const { data } = await settingsAPI.v2.listOverrides(teeSheetId);
  overrides.value = data || [];
}

async function createOverride() {
  const teeSheetId = route.params.teeSheetId;
  await settingsAPI.v2.createOverride(teeSheetId, { date: '2025-07-02' });
  await load();
}

async function addVersion(overrideId) {
  const teeSheetId = route.params.teeSheetId;
  await settingsAPI.v2.createOverrideVersion(teeSheetId, overrideId, { notes: 'v1' });
  await load();
}

async function publish(overrideId) {
  const teeSheetId = route.params.teeSheetId;
  await settingsAPI.v2.publishOverride(teeSheetId, overrideId, {});
  await load();
}

onMounted(load);
</script>

<style scoped>
.btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
</style>


