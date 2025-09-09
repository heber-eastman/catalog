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
        <div class="mt-2">
          <h4 class="mb-1">Weekday windows (local preview)</h4>
          <ul class="dnd-list">
            <li
              v-for="(w, index) in (windowsBySeason[s.id] || [])"
              :key="w.id || w.localId"
              class="dnd-item"
              draggable="true"
              @dragstart="onDragStart(s.id, index, $event)"
              @dragover.prevent
              @drop="onDrop(s.id, index, $event)"
            >
              {{ index }} — wd: {{ w.weekday }} {{ w.start_time_local }} - {{ w.end_time_local }} (tv: {{ w.template_version_id.slice(0,8) }})
            </li>
          </ul>
          <button class="btn sm" @click="saveOrder(s.id)" :disabled="!(windowsBySeason[s.id] && windowsBySeason[s.id].length)">Save order</button>
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
import { onMounted, ref, reactive, inject, watch } from 'vue';
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
const windowsBySeason = reactive({});
let dragState = { seasonId: null, fromIndex: -1 };

// Toast state
const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

function notify(message, color = 'success') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  showSnackbar.value = true;
}

function cryptoRandom() {
  try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2); }
}

async function load() {
  try {
    const teeSheetId = route.params.teeSheetId;
    if (!teeSheetId) { seasons.value = []; return; }
    const { data } = await settingsAPI.v2.listSeasons(teeSheetId);
    seasons.value = data || [];
  } catch (e) {
    notify('Failed to load seasons', 'error');
  }
}

async function createSeason() {
  const teeSheetId = route.params.teeSheetId;
  await settingsAPI.v2.createSeason(teeSheetId, {});
  await load();
  notify('Season created');
}

async function addVersion(seasonId) {
  const teeSheetId = route.params.teeSheetId;
  const sd = startDate.value; const ed = endDate.value;
  if (!sd || !ed) return;
  try {
    const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: sd, end_date_exclusive: ed });
    const st = (startTime.value || '07:00') + ':00';
    const et = (endTime.value || '10:00') + ':00';
    if (!templateVersionId.value) return;
    const { data: createdWindow } = await settingsAPI.v2.addSeasonWeekdayWindow(teeSheetId, seasonId, v.id, { weekday: Number(weekday.value) || 0, position: 0, start_mode: 'fixed', end_mode: 'fixed', start_time_local: st, end_time_local: et, template_version_id: templateVersionId.value });
    // Append to local list with real id for reorder
    const list = windowsBySeason[seasonId] || (windowsBySeason[seasonId] = []);
    list.push({ id: createdWindow.id, weekday: Number(weekday.value) || 0, start_time_local: st, end_time_local: et, template_version_id: templateVersionId.value });
    await load();
    notify('Window added');
  } catch (e) {
    notify('Failed to add version/window', 'error');
  }
}

async function publish(seasonId) {
  try {
    const teeSheetId = route.params.teeSheetId;
    await settingsAPI.v2.publishSeason(teeSheetId, seasonId, {});
    await load();
    notify('Season published');
  } catch (e) {
    notify('Failed to publish season', 'error');
  }
}

function onDragStart(seasonId, index, ev) {
  dragState.seasonId = seasonId;
  dragState.fromIndex = index;
  try { ev.dataTransfer.setData('text/plain', String(index)); } catch {}
}

function onDrop(seasonId, toIndex, ev) {
  const list = windowsBySeason[seasonId];
  if (!list) return;
  const fromIndex = dragState.seasonId === seasonId ? dragState.fromIndex : parseInt(ev.dataTransfer.getData('text/plain') || '-1', 10);
  if (fromIndex < 0 || fromIndex === toIndex) return;
  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);
  dragState = { seasonId: null, fromIndex: -1 };
}

async function saveOrder(seasonId) {
  const list = windowsBySeason[seasonId] || [];
  if (!list.length) return;
  const weekdayVal = list[0].weekday;
  const orderIds = list.map(w => w.id).filter(Boolean);
  if (!orderIds.length) { notify('No persisted windows to reorder yet.', 'error'); return; }
  try {
    const teeSheetId = route.params.teeSheetId;
    // Need latest version id to scope reorder; assume last created for now
    const { data: seasonsList } = await settingsAPI.v2.listSeasons(teeSheetId);
    const season = (seasonsList || []).find(s => s.id === seasonId);
    const versionId = season?.versions?.[season.versions.length - 1]?.id || season?.published_version?.id;
    if (!versionId) { notify('Missing season version to reorder', 'error'); return; }
    await settingsAPI.v2.reorderSeasonWeekdayWindows(teeSheetId, seasonId, versionId, { weekday: weekdayVal, order: orderIds });
    notify('Order saved');
  } catch (e) {
    notify('Failed to save order', 'error');
  }
}

onMounted(load);

// Sync calendar-selected date
const selectedDate = inject('settings:selectedDate', ref(''));
watch(selectedDate, (v) => {
  if (!v) return;
  // Default start to selected date and end to +1 day
  startDate.value = v;
  try {
    const dt = new Date(v + 'T00:00:00');
    dt.setDate(dt.getDate() + 1);
    const pad = (n)=> (n<10?`0${n}`:`${n}`);
    endDate.value = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
  } catch {}
}, { immediate: true });
</script>

<style scoped>
.btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
.btn.sm { padding: 4px 8px; }
.row { display: flex; align-items: center; gap: 8px; }
.ml-2 { margin-left: 8px; }
.mb-2 { margin-bottom: 8px; }
</style>


