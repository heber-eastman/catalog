<template>
  <div class="pa-4">
    <h2>Seasons (V2)</h2>
    <div class="mb-4">
      <button @click="createSeason" class="btn">New Season</button>
    </div>
    <ul>
      <li v-for="s in seasons" :key="s.id">
        <strong>{{ s.id }}</strong> — status: {{ s.status }}
        <button @click="addVersion(s.id)">Add Version</button>
        <button @click="publish(s.id)">Publish</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const seasons = ref([]);

async function load() {
  const teeSheetId = route.params.teeSheetId;
  if (!teeSheetId) { seasons.value = []; return; }
  const { data } = await settingsAPI.v2.listSeasons(teeSheetId);
  seasons.value = data || [];
}

async function createSeason() {
  const teeSheetId = route.params.teeSheetId;
  await settingsAPI.v2.createSeason(teeSheetId, {});
  await load();
}

async function addVersion(seasonId) {
  const teeSheetId = route.params.teeSheetId;
  const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: '2025-07-01', end_date_exclusive: '2025-08-01' });
  await settingsAPI.v2.addSeasonWeekdayWindow(teeSheetId, seasonId, v.id, { weekday: 3, position: 0, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '07:00:00', end_time_local: '10:00:00', template_version_id: '00000000-0000-0000-0000-000000000000' });
  await load();
}

async function publish(seasonId) {
  const teeSheetId = route.params.teeSheetId;
  await settingsAPI.v2.publishSeason(teeSheetId, seasonId, {});
  await load();
}

onMounted(load);
</script>

<style scoped>
.btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
</style>


