<template>
  <div class="pa-4" data-cy="seasons-v2">
    <div class="toolbar">
      <h2 class="title">Seasons (V2)</h2>
      <div class="row">
        <router-link :to="{ name: 'SettingsTeeSheetsSides', params: { teeSheetId: route.params.teeSheetId } }" class="btn sm" data-cy="back-to-calendar">Back to Calendar</router-link>
        <v-btn variant="text" class="create-btn" :disabled="busy" @click="createSeason" data-cy="season-new-btn">Create new season</v-btn>
      </div>
    </div>

    <div v-if="busy" class="muted" data-cy="seasons-loading">Loading…</div>
    <div v-else-if="!seasons.length" class="muted" data-cy="seasons-empty">No seasons yet</div>

    <div v-else class="cards">
      <v-card
        v-for="s in seasons"
        :key="s.id"
        variant="outlined"
        class="season-card"
        @click="openDetail(s)"
        :data-cy="`season-card-${shortId(s.id)}`"
      >
        <div class="color-bar" />
        <div class="season-card__body">
          <div class="season-card__header">
            <div class="season-card__title">{{ s.name || `Season ${shortId(s.id)}` }}</div>
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="mdi-dots-vertical" variant="text" density="comfortable" @click.stop></v-btn>
              </template>
              <v-list density="compact">
                <v-list-item :data-cy="`season-menu-delete-${shortId(s.id)}`" @click.stop="remove(s)">
                  <v-list-item-title>Delete</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
          <div class="season-card__row">
            <span class="pill" :class="{ archived: s.status !== 'draft' }">{{ s.status }}</span>
            <span class="sep">•</span>
            <span>{{ seasonDates(s) }}</span>
          </div>
        </div>
      </v-card>
    </div>

    <v-dialog v-model="detailOpen" max-width="1200">
      <v-card>
        <v-card-title class="text-subtitle-1">Season Settings</v-card-title>
        <v-card-text>
          <div class="section">
            <div class="section__header">Season Details</div>
            <div class="section__grid">
              <div class="field w-420"><v-text-field v-model="seasonName" label="Name" variant="outlined" density="comfortable" hide-details /></div>
              <div class="field w-420"><v-text-field v-model="startDate" type="date" label="Start date" variant="outlined" density="comfortable" hide-details /></div>
              <div class="field w-420"><v-text-field v-model="endDate" type="date" label="End date (exclusive)" variant="outlined" density="comfortable" hide-details /></div>
            </div>
          </div>

          <div class="section">
            <div class="section__header schedule">Schedule</div>
            <div class="weekday-rows">
              <div class="weekday-row" v-for="wd in weekdays" :key="wd.value">
                <div class="day-label">{{ wd.title }}</div>
                <div class="weekday-col" v-if="expandedByWeekday[wd.value]">
                  <div
                    class="window-grid"
                    v-for="(w, idx) in windowsForDay(wd.value)"
                    :key="w.id || `${wd.value}-${idx}`"
                  >
                    <div class="field w-64">
                      <v-select class="icon-select" :items="startModeItems" v-model="w.start_mode" item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details>
                        <template #selection="{ item }">
                          <v-icon :icon="item?.raw?.icon" size="18" />
                        </template>
                        <template #item="{ props, item }">
                          <v-list-item v-bind="props" density="compact">
                            <template #prepend>
                              <v-icon :icon="item?.raw?.icon" size="18" />
                            </template>
                          </v-list-item>
                        </template>
                      </v-select>
                    </div>
                    <div class="field w-160">
                      <v-text-field
                        v-if="w.start_mode === 'sunrise_offset'"
                        v-model.number="w.start_offset_mins"
                        type="number"
                        label="Offset (mins)"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                      />
                      <v-text-field
                        v-else
                        v-model="w.start_time_local"
                        type="time"
                        label="Start time"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                      />
                    </div>

                    <div class="field w-64">
                      <v-select class="icon-select" :items="endModeItems" v-model="w.end_mode" item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details>
                        <template #selection="{ item }">
                          <v-icon :icon="item?.raw?.icon" size="18" />
                        </template>
                        <template #item="{ props, item }">
                          <v-list-item v-bind="props" density="compact">
                            <template #prepend>
                              <v-icon :icon="item?.raw?.icon" size="18" />
                            </template>
                          </v-list-item>
                        </template>
                      </v-select>
                    </div>
                    <div class="field w-160">
                      <v-text-field
                        v-if="w.end_mode === 'sunset_offset'"
                        v-model.number="w.end_offset_mins"
                        type="number"
                        label="Offset (mins)"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                      />
                      <v-text-field
                        v-else
                        v-model="w.end_time_local"
                        type="time"
                        label="End time"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                      />
                    </div>
                    <div class="field w-240">
                      <v-select :items="templateVersionOptions" item-title="label" item-value="id" v-model="w.template_version_id" label="Template Version" variant="outlined" density="comfortable" hide-details />
                    </div>
                    <div class="actions">
                      <v-btn
                        v-if="idx === 0"
                        icon="mdi-plus"
                        variant="text"
                        :disabled="busy"
                        @click="selectedSeason && addPendingForWeekday(selectedSeason.id, wd.value)"
                      />
                      <v-btn
                        icon="mdi-trash-can-outline"
                        variant="text"
                        :disabled="busy"
                        @click="selectedSeason && deleteWindow(selectedSeason.id, w)"
                      />
                    </div>
                  </div>
                  <!-- Pending (unsaved) windows -->
                  <div
                    class="window-grid"
                    v-for="(p, pidx) in pendingForDay(wd.value)"
                    :key="`pending-${wd.value}-${pidx}-${p._key}`"
                  >
                    <div class="field w-64">
                      <v-select class="icon-select" :items="startModeItems" v-model="p.start_mode" item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details>
                        <template #selection="{ item }">
                          <v-icon :icon="item?.raw?.icon" size="18" />
                        </template>
                        <template #item="{ props, item }">
                          <v-list-item v-bind="props" density="compact">
                            <template #prepend>
                              <v-icon :icon="item?.raw?.icon" size="18" />
                            </template>
                          </v-list-item>
                        </template>
                      </v-select>
                    </div>
                    <div class="field w-160">
                      <v-text-field
                        v-if="p.start_mode === 'sunrise_offset'"
                        v-model.number="p.start_offset_mins"
                        type="number"
                        label="Offset (mins)"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                      />
                      <v-text-field
                        v-else
                        v-model="p.start_time_local"
                        type="time"
                        label="Start time"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                      />
                    </div>

                    <div class="field w-64">
                      <v-select class="icon-select" :items="endModeItems" v-model="p.end_mode" item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details>
                        <template #selection="{ item }">
                          <v-icon :icon="item?.raw?.icon" size="18" />
                        </template>
                        <template #item="{ props, item }">
                          <v-list-item v-bind="props" density="compact">
                            <template #prepend>
                              <v-icon :icon="item?.raw?.icon" size="18" />
                            </template>
                          </v-list-item>
                        </template>
                      </v-select>
                    </div>
                    <div class="field w-160">
                      <v-text-field
                        v-if="p.end_mode === 'sunset_offset'"
                        v-model.number="p.end_offset_mins"
                        type="number"
                        label="Offset (mins)"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                      />
                      <v-text-field
                        v-else
                        v-model="p.end_time_local"
                        type="time"
                        label="End time"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                      />
                    </div>
                    <div class="field w-240">
                      <v-select :items="templateVersionOptions" item-title="label" item-value="id" v-model="p.template_version_id" label="Template Version" variant="outlined" density="comfortable" hide-details />
                    </div>
                    <div class="actions">
                      <v-btn
                        icon="mdi-trash-can-outline"
                        variant="text"
                        :disabled="busy"
                        @click="selectedSeason && removePendingForWeekday(selectedSeason.id, wd.value, pidx)"
                      />
                    </div>
                  </div>
                </div>
                <div v-else class="weekday-col">
                  <div class="window-grid">
                    <div></div>
                    <div class="add-placeholder" v-if="!hasWindowsForDay(wd.value)" @click="createFirstPending(wd.value)">Add window</div>
                    <div v-else></div>
                    <div></div>
                    <div></div>
                    <v-btn
                      icon="mdi-plus"
                      variant="text"
                      @click="createFirstPending(wd.value)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen=false">Close</v-btn>
          <v-btn variant="text" :disabled="busy || !selectedSeason" @click="selectedSeason && saveAll(selectedSeason.id)">Save</v-btn>
          <v-btn variant="flat" color="primary" :disabled="busy" @click="selectedSeason && publish(selectedSeason.id)">Publish</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
const busy = ref(false);
const detailOpen = ref(false);
const selectedSeason = ref(null);
const seasonName = ref('');
const startDate = ref('');
const endDate = ref('');
const rowStateByWeekday = reactive({
  0: { startMode: 'sunrise_offset', startOffset: 0, startTime: '07:00', endMode: 'sunset_offset', endOffset: -150, endTime: '10:00', templateVersionId: '' },
  1: { startMode: 'sunrise_offset', startOffset: 0, startTime: '07:00', endMode: 'sunset_offset', endOffset: -150, endTime: '10:00', templateVersionId: '' },
  2: { startMode: 'sunrise_offset', startOffset: 0, startTime: '07:00', endMode: 'sunset_offset', endOffset: -150, endTime: '10:00', templateVersionId: '' },
  3: { startMode: 'sunrise_offset', startOffset: 0, startTime: '07:00', endMode: 'sunset_offset', endOffset: -150, endTime: '10:00', templateVersionId: '' },
  4: { startMode: 'sunrise_offset', startOffset: 0, startTime: '07:00', endMode: 'sunset_offset', endOffset: -150, endTime: '10:00', templateVersionId: '' },
  5: { startMode: 'sunrise_offset', startOffset: 0, startTime: '07:00', endMode: 'sunset_offset', endOffset: -150, endTime: '10:00', templateVersionId: '' },
  6: { startMode: 'sunrise_offset', startOffset: 0, startTime: '07:00', endMode: 'sunset_offset', endOffset: -150, endTime: '10:00', templateVersionId: '' },
});
const expandedByWeekday = reactive({ 0: true, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false });
const templateVersionOptions = ref([]);
const windowsBySeason = reactive({});
const orderDirtyBySeason = reactive({});
let dragState = { seasonId: null, fromIndex: -1 };
const currentVersionId = ref('');
const weekdays = [
  { value: 0, title: 'Sunday' },
  { value: 1, title: 'Monday' },
  { value: 2, title: 'Tuesday' },
  { value: 3, title: 'Wednesday' },
  { value: 4, title: 'Thursday' },
  { value: 5, title: 'Friday' },
  { value: 6, title: 'Saturday' },
];
const canAddWindow = ref(false);
// Pending (unsaved) windows keyed by seasonId then weekday
const pendingBySeason = reactive({});

const startModeItems = [
  { title: 'Sunrise', value: 'sunrise_offset', icon: 'mdi-weather-sunset-up' },
  { title: 'Time', value: 'fixed', icon: 'mdi-clock-outline' },
];
const endModeItems = [
  { title: 'Sunset', value: 'sunset_offset', icon: 'mdi-weather-sunset-down' },
  { title: 'Time', value: 'fixed', icon: 'mdi-clock-outline' },
];

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
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    if (!teeSheetId) { seasons.value = []; return; }
    const { data } = await settingsAPI.v2.listSeasons(teeSheetId);
    seasons.value = data || [];
    await loadTemplateVersions();
  } catch (e) {
    notify('Failed to load seasons', 'error');
  } finally {
    busy.value = false;
  }
}

function shortId(id){ return (id || '').slice(0,6); }
function seasonDates(s){
  const v = (s.published_version || (s.versions && s.versions[s.versions.length-1])) || null;
  if (!v) return 'No dates';
  return `${v.start_date || '—'} to ${v.end_date_exclusive || '—'}`;
}

function displayWindow(w){
  const wd = (weekdays.find(x=>x.value===w.weekday)?.title) || `WD ${w.weekday}`;
  const start = w.start_mode === 'sunrise_offset'
    ? `Sunrise ${w.start_offset_mins>=0?'+':''}${w.start_offset_mins}m`
    : (w.start_time_local || '').slice(0,5);
  const end = w.end_mode === 'sunset_offset'
    ? `Sunset ${w.end_offset_mins>=0?'+':''}${w.end_offset_mins}m`
    : (w.end_time_local || '').slice(0,5);
  return `${wd}: ${start} - ${end} (tv: ${(w.template_version_id||'').slice(0,8)})`;
}

async function openDetail(s){
  selectedSeason.value = s;
  seasonName.value = s?.name || 'Untitled Season';
  detailOpen.value = true;
  // Restore latest version dates and template from windows if present
  try {
    // Ensure template options are fresh before setting selected id
    await loadTemplateVersions();
    // Versions are ordered ASC by created_at from the backend include, so last is latest
    const latest = (s.published_version || (s.versions && s.versions[s.versions.length-1])) || null;
    if (latest) {
      currentVersionId.value = latest.id || '';
      startDate.value = latest.start_date || '';
      endDate.value = latest.end_date_exclusive || '';
      // Load windows to recover template version selection
      const teeSheetId = route.params.teeSheetId;
      const { data: windows } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, s.id, latest.id);
      // Initialize per-day state from existing windows (use first window per weekday for defaults)
      const seen = new Set();
      for (const w of (windows || [])) {
        if (seen.has(w.weekday)) continue;
        seen.add(w.weekday);
        rowStateByWeekday[w.weekday].startMode = w.start_mode || 'sunrise_offset';
        rowStateByWeekday[w.weekday].endMode = w.end_mode || 'sunset_offset';
        rowStateByWeekday[w.weekday].startTime = (w.start_time_local || '07:00:00').slice(0,5);
        rowStateByWeekday[w.weekday].endTime = (w.end_time_local || '10:00:00').slice(0,5);
        rowStateByWeekday[w.weekday].startOffset = typeof w.start_offset_mins === 'number' ? w.start_offset_mins : 0;
        rowStateByWeekday[w.weekday].endOffset = typeof w.end_offset_mins === 'number' ? w.end_offset_mins : -150;
        rowStateByWeekday[w.weekday].templateVersionId = w.template_version_id || rowStateByWeekday[w.weekday].templateVersionId;
      }
      // Ensure template options include any referenced ids
      const tvIds = new Set((windows||[]).map(w=>w.template_version_id).filter(Boolean));
      if ([...tvIds].some(id => !(templateVersionOptions.value||[]).some(o=>o.id===id))) {
        await loadTemplateVersions();
      }
      // Fill local preview list
      windowsBySeason[s.id] = (windows || []).slice();
      // Expand rows with existing windows; default expand Sunday only otherwise
      expandedByWeekday[0] = true;
      for (let i = 1; i <= 6; i++) expandedByWeekday[i] = false;
      for (const w of (windows || [])) expandedByWeekday[w.weekday] = true;
    } else {
      startDate.value = '';
      endDate.value = '';
      windowsBySeason[s.id] = [];
      currentVersionId.value = '';
      expandedByWeekday[0] = true; for (let i = 1; i <= 6; i++) expandedByWeekday[i] = false;
    }
  } catch {}
}

function canAddWindowFor(wd){
  const rs = rowStateByWeekday[wd];
  const startOk = rs.startMode === 'fixed' ? !!rs.startTime : true;
  const endOk = rs.endMode === 'fixed' ? !!rs.endTime : true;
  const hasTemplate = !!rs.templateVersionId;
  return !!(startDate.value && endDate.value && hasTemplate && startOk && endOk);
}

function hasWindowsForDay(wd){
  const s = selectedSeason.value; if (!s) return false;
  const list = windowsBySeason[s.id] || [];
  return list.some(w => w.weekday === wd);
}

function windowsForDay(wd){
  const s = selectedSeason.value; if (!s) return [];
  return (windowsBySeason[s.id] || []).filter(w => w.weekday === wd);
}

function pendingForDay(wd){
  const s = selectedSeason.value; if (!s) return [];
  const bag = pendingBySeason[s.id] || {};
  return bag[wd] || [];
}

function shortWindowText(w){
  const start = w.start_mode === 'sunrise_offset'
    ? `Sunrise ${w.start_offset_mins>=0?'+':''}${w.start_offset_mins}m`
    : (w.start_time_local || '').slice(0,5);
  const end = w.end_mode === 'sunset_offset'
    ? `Sunset ${w.end_offset_mins>=0?'+':''}${w.end_offset_mins}m`
    : (w.end_time_local || '').slice(0,5);
  return `${start} – ${end}`;
}

async function createSeason() {
  const teeSheetId = route.params.teeSheetId;
  const { data: season } = await settingsAPI.v2.createSeason(teeSheetId, { name: 'Untitled Season' });
  // Create default version + Sunday window
  // Default dates: today to +6 months (fallback 1 day if invalid)
  const today = new Date();
  const pad = (n)=> (n<10?`0${n}`:`${n}`);
  const iso = (d)=> `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const start = iso(today);
  const six = new Date(today); six.setMonth(six.getMonth()+6);
  const end = iso(six);
  try {
    const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, season.id, { start_date: start, end_date_exclusive: end });
    const defaultTvId = await getDefaultTemplateVersionId();
    if (defaultTvId) {
      await settingsAPI.v2.addSeasonWeekdayWindow(teeSheetId, season.id, v.id, {
        weekday: 0,
        start_mode: 'sunrise_offset',
        end_mode: 'sunset_offset',
        start_time_local: null,
        end_time_local: null,
        start_offset_mins: 0,
        end_offset_mins: -150,
        template_version_id: defaultTvId,
      });
    }
  } catch {}
  await load();
  notify('Season created');
}

async function addVersion(seasonId) {
  const teeSheetId = route.params.teeSheetId;
  const sd = startDate.value; const ed = endDate.value;
  if (!sd || !ed) return;
  try {
    const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: sd, end_date_exclusive: ed });
    // No-op in multi-row UI; use addWindowForWeekday instead
    notify('Version created. Use Add on a weekday row to add windows.');
  } catch (e) {
    notify('Failed to add version/window', 'error');
  }
}

async function addWindowForWeekday(seasonId, wd){
  const teeSheetId = route.params.teeSheetId;
  const sd = startDate.value; const ed = endDate.value;
  if (!sd || !ed) return;
  const rs = rowStateByWeekday[wd];
  try {
    if (!currentVersionId.value) {
      const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: sd, end_date_exclusive: ed });
      currentVersionId.value = v.id;
    }
    const payload = {
      weekday: Number(wd) || 0,
      start_mode: rs.startMode,
      end_mode: rs.endMode,
      start_time_local: rs.startMode === 'fixed' ? (rs.startTime || '07:00') + ':00' : null,
      end_time_local: rs.endMode === 'fixed' ? (rs.endTime || '10:00') + ':00' : null,
      start_offset_mins: rs.startMode === 'sunrise_offset' ? Number(rs.startOffset) || 0 : null,
      end_offset_mins: rs.endMode === 'sunset_offset' ? Number(rs.endOffset) || 0 : null,
      template_version_id: rs.templateVersionId,
    };
    if (!rs.templateVersionId) return;
    const { data: createdWindow } = await settingsAPI.v2.addSeasonWeekdayWindow(teeSheetId, seasonId, currentVersionId.value, payload);
    // Refresh from backend to render inline rows immediately
    const { data: windows } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, seasonId, currentVersionId.value);
    windowsBySeason[seasonId] = Array.isArray(windows) ? windows : [];
    notify('Window added');
  } catch (e) {
    notify('Failed to add version/window', 'error');
  }
}

function canSaveWindow(w){
  if (!w) return false;
  const startOk = w.start_mode === 'fixed' ? !!w.start_time_local : true;
  const endOk = w.end_mode === 'fixed' ? !!w.end_time_local : true;
  return !!(w.template_version_id && startOk && endOk);
}

async function saveWindow(seasonId, w){
  try {
    const teeSheetId = route.params.teeSheetId;
    if (!currentVersionId.value) return;
    const payload = {
      weekday: Number(w.weekday) || 0,
      start_mode: w.start_mode,
      end_mode: w.end_mode,
      start_time_local: w.start_mode === 'fixed' ? (String(w.start_time_local || '07:00').slice(0,5) + ':00') : null,
      end_time_local: w.end_mode === 'fixed' ? (String(w.end_time_local || '10:00').slice(0,5) + ':00') : null,
      start_offset_mins: w.start_mode === 'sunrise_offset' ? (typeof w.start_offset_mins === 'number' ? w.start_offset_mins : 0) : null,
      end_offset_mins: w.end_mode === 'sunset_offset' ? (typeof w.end_offset_mins === 'number' ? w.end_offset_mins : 0) : null,
      template_version_id: w.template_version_id,
    };
    await settingsAPI.v2.updateSeasonWeekdayWindow(teeSheetId, seasonId, currentVersionId.value, w.id, payload);
    const { data: windows } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, seasonId, currentVersionId.value);
    windowsBySeason[seasonId] = Array.isArray(windows) ? windows : [];
    notify('Window saved');
  } catch (e) {
    notify('Failed to save window', 'error');
  }
}

function ensurePendingBag(seasonId){
  if (!pendingBySeason[seasonId]) pendingBySeason[seasonId] = {};
}

function createFirstPending(wd){
  if (!selectedSeason.value) return;
  expandedByWeekday[wd] = true;
  addPendingForWeekday(selectedSeason.value.id, wd);
}

function addPendingForWeekday(seasonId, wd){
  ensurePendingBag(seasonId);
  if (!pendingBySeason[seasonId][wd]) pendingBySeason[seasonId][wd] = [];
  // Seed from row state defaults
  const rs = rowStateByWeekday[wd];
  const p = {
    _key: cryptoRandom(),
    weekday: Number(wd) || 0,
    start_mode: rs.startMode,
    end_mode: rs.endMode,
    start_time_local: rs.startMode === 'fixed' ? (rs.startTime || '07:00') : null,
    end_time_local: rs.endMode === 'fixed' ? (rs.endTime || '10:00') : null,
    start_offset_mins: rs.startMode === 'sunrise_offset' ? (Number(rs.startOffset) || 0) : null,
    end_offset_mins: rs.endMode === 'sunset_offset' ? (Number(rs.endOffset) || 0) : null,
    template_version_id: rs.templateVersionId || '',
  };
  pendingBySeason[seasonId][wd].push(p);
}

function removePendingForWeekday(seasonId, wd, index){
  const bag = pendingBySeason[seasonId];
  if (!bag || !bag[wd]) return;
  bag[wd].splice(index, 1);
}

async function deleteWindow(seasonId, w){
  try {
    const teeSheetId = route.params.teeSheetId;
    if (!currentVersionId.value || !w?.id) return;
    await settingsAPI.v2.deleteSeasonWeekdayWindow(teeSheetId, seasonId, currentVersionId.value, w.id);
    const { data: windows } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, seasonId, currentVersionId.value);
    windowsBySeason[seasonId] = Array.isArray(windows) ? windows : [];
    notify('Window deleted');
  } catch (e) {
    notify('Failed to delete window', 'error');
  }
}

async function publish(seasonId) {
  try {
    const teeSheetId = route.params.teeSheetId;
    // Use latest version for this season unless already published
    const s = (seasons.value || []).find(x => x.id === seasonId) || selectedSeason.value;
    const versionId = s?.published_version?.id || (s?.versions && s.versions[s.versions.length - 1]?.id);
    if (!versionId) { notify('No season version to publish', 'error'); return; }
    await settingsAPI.v2.publishSeason(teeSheetId, seasonId, { version_id: versionId, apply_now: false });
    await load();
    notify('Season published');
  } catch (e) {
    notify('Failed to publish season', 'error');
  }
}

async function saveSeasonName(seasonId){
  try {
    const teeSheetId = route.params.teeSheetId;
    const name = (seasonName.value || '').trim() || 'Untitled Season';
    await settingsAPI.v2.updateSeason(teeSheetId, seasonId, { name });
    await load();
    notify('Season saved');
  } catch (e) {
    notify('Failed to save season', 'error');
  }
}

// Save-all handler: updates season name and upserts all visible windows
async function saveAll(seasonId){
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    // 1) Save season name
    const name = (seasonName.value || '').trim() || 'Untitled Season';
    await settingsAPI.v2.updateSeason(teeSheetId, seasonId, { name });

    // 2) Persist each existing window that has an id via PUT
    const list = (windowsBySeason[seasonId] || []).slice();
    if (currentVersionId.value) {
      for (const w of list) {
        if (!w?.id) continue;
        const payload = {
          weekday: Number(w.weekday) || 0,
          start_mode: w.start_mode,
          end_mode: w.end_mode,
          start_time_local: w.start_mode === 'fixed' ? (String(w.start_time_local || '07:00').slice(0,5) + ':00') : null,
          end_time_local: w.end_mode === 'fixed' ? (String(w.end_time_local || '10:00').slice(0,5) + ':00') : null,
          start_offset_mins: w.start_mode === 'sunrise_offset' ? (typeof w.start_offset_mins === 'number' ? w.start_offset_mins : 0) : null,
          end_offset_mins: w.end_mode === 'sunset_offset' ? (typeof w.end_offset_mins === 'number' ? w.end_offset_mins : 0) : null,
          template_version_id: w.template_version_id,
        };
        if (!payload.template_version_id) continue;
        await settingsAPI.v2.updateSeasonWeekdayWindow(teeSheetId, seasonId, currentVersionId.value, w.id, payload);
      }
    }

    // 3) Create pending windows via POST
    if (!currentVersionId.value && startDate.value && endDate.value) {
      const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: startDate.value, end_date_exclusive: endDate.value });
      currentVersionId.value = v.id;
    }
    if (currentVersionId.value) {
      const bag = pendingBySeason[seasonId] || {};
      for (const wdStr of Object.keys(bag)) {
        const wd = Number(wdStr);
        for (const p of bag[wd] || []) {
          const payload = {
            weekday: wd,
            start_mode: p.start_mode,
            end_mode: p.end_mode,
            start_time_local: p.start_mode === 'fixed' ? (String(p.start_time_local || '07:00').slice(0,5) + ':00') : null,
            end_time_local: p.end_mode === 'fixed' ? (String(p.end_time_local || '10:00').slice(0,5) + ':00') : null,
            start_offset_mins: p.start_mode === 'sunrise_offset' ? (typeof p.start_offset_mins === 'number' ? p.start_offset_mins : 0) : null,
            end_offset_mins: p.end_mode === 'sunset_offset' ? (typeof p.end_offset_mins === 'number' ? p.end_offset_mins : 0) : null,
            template_version_id: p.template_version_id,
          };
          if (!payload.template_version_id) continue;
          await settingsAPI.v2.addSeasonWeekdayWindow(teeSheetId, seasonId, currentVersionId.value, payload);
        }
      }
    }

    // 3) Reload
    await load();
    // Clear pending cache for this season
    if (pendingBySeason[seasonId]) pendingBySeason[seasonId] = {};
    notify('Season saved');
  } catch (e) {
    notify('Failed to save season', 'error');
  } finally {
    busy.value = false;
  }
}

async function remove(s) {
  try {
    const teeSheetId = route.params.teeSheetId;
    await settingsAPI.v2.deleteSeason(teeSheetId, s.id);
    await load();
    notify('Season deleted');
  } catch (e) {
    notify(e?.response?.data?.error || 'Failed to delete season', 'error');
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
  orderDirtyBySeason[seasonId] = true;
}

function onItemKeydown(seasonId, index, ev){
  const list = windowsBySeason[seasonId] || [];
  if (!list.length) return;
  if (ev.key === ' ' || ev.key === 'Spacebar'){
    // toggle grabbed
    ev.preventDefault();
    dragState = (dragState.seasonId === seasonId && dragState.fromIndex === index)
      ? { seasonId: null, fromIndex: -1 }
      : { seasonId, fromIndex: index };
    return;
  }
  if (dragState.seasonId === seasonId && dragState.fromIndex === index){
    let newIndex = index;
    if (ev.key === 'ArrowUp') newIndex = Math.max(0, index - 1);
    if (ev.key === 'ArrowDown') newIndex = Math.min(list.length - 1, index + 1);
    if (newIndex !== index){
      const [moved] = list.splice(index, 1);
      list.splice(newIndex, 0, moved);
      dragState = { seasonId, fromIndex: newIndex };
      orderDirtyBySeason[seasonId] = true;
    }
  }
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
    orderDirtyBySeason[seasonId] = false;
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

async function loadTemplateVersions() {
  const teeSheetId = route.params.teeSheetId;
  if (!teeSheetId) { templateVersionOptions.value = []; return; }
  try {
    const { data } = await settingsAPI.v2.listTemplates(teeSheetId);
    const opts = [];
    for (const t of data || []) {
      const tmplName = t.name || 'Template';
      for (const v of (t.versions || [])) {
        const note = v.notes ? ` — ${v.notes}` : '';
        opts.push({ id: v.id, label: `${tmplName} v${v.version_number}${note}` });
      }
    }
    templateVersionOptions.value = opts;
  } catch (_) {
    templateVersionOptions.value = [];
  }
}

async function getDefaultTemplateVersionId() {
  try {
    const teeSheetId = route.params.teeSheetId;
    const { data } = await settingsAPI.v2.listTemplates(teeSheetId);
    const list = Array.isArray(data) ? data : [];
    if (!list.length) return '';
    const last = list[list.length - 1];
    const pub = last.published_version?.id;
    if (pub) return pub;
    const versions = Array.isArray(last.versions) ? last.versions : [];
    return versions.length ? versions[versions.length - 1].id : '';
  } catch {
    return '';
  }
}
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.title{ font-weight:800; font-size:28px; }
.create-btn{ color:#5EE3BB; font-weight:600; letter-spacing:0.04em; }
.muted{ color:#6b778c; }
.cards{ display:flex; flex-direction:column; gap:12px; }
.season-card{ padding:10px 12px; cursor:pointer; width:100%; display:flex; align-items:stretch; }
.season-card__header{ display:flex; align-items:center; justify-content:space-between; }
.season-card__title{ font-weight:700; font-size:18px; }
.season-card__row{ color:#6b778c; margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.color-bar{ width:6px; background:#82b1ff; border-radius:4px; margin-right:10px; }
.pill{ background:#eef7ff; border-radius:10px; padding:2px 8px; font-size:12px; }
.pill.archived{ background:#fdecea; color:#b71c1c; }
.sep{ margin:0 6px; color:#9aa0a6; }
.row { display: flex; align-items: center; gap: 8px; }
.dnd-list { list-style: none; padding: 0; margin: 0; }
.dnd-item { padding: 6px 8px; border: 1px dashed #ccc; border-radius: 6px; margin-bottom: 6px; cursor: grab; }
.dnd-item[aria-grabbed="true"] { outline: 2px solid #1976d2; cursor: grabbing; }
.dnd-item:focus { outline: 2px solid #90caf9; }
.section{ margin-top:16px; }
.section__header{ font-weight:700; font-size:14px; color:#2b2f36; margin-bottom:10px; letter-spacing:0.02em; }
.section__header.schedule{ font-weight:600; font-size:13px; color:#2b2f36; text-transform:none; letter-spacing:0.02em; }
.section__grid{ display:grid; column-gap:16px; row-gap:16px; }
.section__grid.two-cols{ grid-template-columns: repeat(2, minmax(160px,1fr)); }
.mt-2{ margin-top:8px; }
.btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }
.btn.sm { padding: 4px 8px; }
.window-row{ display:flex; align-items:center; gap:8px; flex-wrap:nowrap; }
.window-grid{ display:grid; grid-template-columns: 56px 140px 56px 140px 230px 44px; gap:12px; align-items:center; }
.window-grid > .field, .window-grid > .actions{ margin-inline:2px !important; }
.window-grid :deep(.v-btn--icon){ width:36px; height:36px; border-radius:50%; padding:0; }
.weekday-rows{ display:flex; flex-direction:column; gap:12px; }
.weekday-row{ display:flex; align-items:flex-start; gap:12px; }
.weekday-col :deep(.v-field){ margin-right:0; }
.window-grid > *{ margin:0 !important; }
.day-label{ width:120px; font-weight:600; color:#434a54; white-space:nowrap; }
.weekday-col{ flex:1; display:flex; flex-direction:column; gap:10px; }
.weekday-col{ border-bottom:1px solid #e8eaed; padding-bottom:10px; }
.field{ display:flex; flex-direction:column; gap:6px; }
.field.grow{ flex:1; min-width:200px; }
.w-240{ width:240px; }
.w-420{ width:420px; max-width:100%; }
.actions{ display:flex; align-items:center; gap:4px; padding-right:4px; }
.w-160{ width:140px; }
.w-64{ width:64px; }
.w-140{ width:140px; }
.label{ font-size:12px; color:#5f6368; margin-left:2px; }
.mode-toggle :deep(.v-btn){ min-width:36px; }
.icon-select :deep(.v-field__input){ padding-top:6px; padding-bottom:6px; }
.icon-select :deep(.v-field){ margin:0; }
.icon-select :deep(.v-select__selection-text){ display:flex; align-items:center; }
.add-placeholder{ color:#1e88e5; cursor:pointer; align-self:center; }
</style>


