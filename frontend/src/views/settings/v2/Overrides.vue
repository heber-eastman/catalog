<template>
  <div class="pa-4">
    <h2>Overrides (V2)</h2>
    <div class="mb-4 row">
      <button @click="createOverride" class="btn">New Override</button>
      <input v-model="overrideDate" type="date" />
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
const overrideDate = ref('');

async function load() {
  try {
    const teeSheetId = route.params.teeSheetId;
    if (!teeSheetId) { overrides.value = []; return; }
    const { data } = await settingsAPI.v2.listOverrides(teeSheetId);
    overrides.value = data || [];
  } catch (e) {
    alert('Failed to load overrides');
  }
}

async function createOverride() {
  try {
    const teeSheetId = route.params.teeSheetId;
    const d = overrideDate.value;
    if (!d) return;
    await settingsAPI.v2.createOverride(teeSheetId, { date: d });
    await load();
  } catch (e) {
    alert('Failed to create override');
  }
}

async function addVersion(overrideId) {
  try {
    const teeSheetId = route.params.teeSheetId;
    await settingsAPI.v2.createOverrideVersion(teeSheetId, overrideId, { notes: 'v1' });
    await load();
  } catch (e) {
    alert('Failed to add override version');
  }
}

async function publish(overrideId) {
  try {
    const teeSheetId = route.params.teeSheetId;
    await settingsAPI.v2.publishOverride(teeSheetId, overrideId, {});
    await load();
  } catch (e) {
    alert('Failed to publish override');
  }
}

onMounted(load);
</script>

<style scoped>
.btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
.row { display: flex; align-items: center; gap: 8px; }
</style>


