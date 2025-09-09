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
        <button @click="addVersion(o.id)" class="btn sm">Add Version</button>
        <button @click="publish(o.id)" class="btn sm">Publish</button>
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
import { onMounted, ref, inject, watch } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const overrides = ref([]);
const overrideDate = ref('');
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
</script>

<style scoped>
.btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
.row { display: flex; align-items: center; gap: 8px; }
</style>


