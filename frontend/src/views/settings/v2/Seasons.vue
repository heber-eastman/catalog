<template>
  <div class="pa-4">
    <h2>Seasons (V2)</h2>
    <div class="mb-4 row">
      <button @click="createSeason" class="btn">New Season</button>
      <div class="ml-2 row">
        <label>Version dates</label>
        <input v-model="startDate" type="date" />
        <input v-model="endDate" type="date" />
        <label class="ml-2">Weekday</label>
        <select v-model.number="weekday">
          <option v-for="w in 7" :key="w-1" :value="w-1">{{ w-1 }}</option>
        </select>
        <input v-model="startTime" type="time" />
        <input v-model="endTime" type="time" />
        <input v-model="templateVersionId" placeholder="template_version_id" />
      </div>
    </div>
    <ul>
      <li v-for="s in seasons" :key="s.id" class="mb-2">
        <div><strong>{{ s.id }}</strong> — status: {{ s.status }}</div>
        <div class="row">
          <button @click="addVersion(s.id)" class="btn sm">Add Version+Window</button>
          <button @click="publish(s.id)" class="btn sm">Publish</button>
        </div>
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
const startDate = ref('');
const endDate = ref('');
const weekday = ref(0);
const startTime = ref('07:00');
const endTime = ref('10:00');
const templateVersionId = ref('');

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
  const sd = startDate.value; const ed = endDate.value;
  if (!sd || !ed) return;
  const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: sd, end_date_exclusive: ed });
  const st = (startTime.value || '07:00') + ':00';
  const et = (endTime.value || '10:00') + ':00';
  if (!templateVersionId.value) return;
  await settingsAPI.v2.addSeasonWeekdayWindow(teeSheetId, seasonId, v.id, { weekday: Number(weekday.value) || 0, position: 0, start_mode: 'fixed', end_mode: 'fixed', start_time_local: st, end_time_local: et, template_version_id: templateVersionId.value });
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
.btn.sm { padding: 4px 8px; }
.row { display: flex; align-items: center; gap: 8px; }
.ml-2 { margin-left: 8px; }
.mb-2 { margin-bottom: 8px; }
</style>


