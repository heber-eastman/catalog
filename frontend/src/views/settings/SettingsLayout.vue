<template>
  <div class="settings" :class="{ 'has-third': isTeeSheet }">
    <aside class="subnav-icons">
      <v-list nav density="compact">
        <v-tooltip location="end" :text="'General Settings'">
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              :to="{ name: 'SettingsGeneral' }"
              :prepend-icon="'mdi-cog'"
              class="narrow-nav-item"
              data-cy="subnav-general"
            />
          </template>
        </v-tooltip>
        <v-tooltip location="end" :text="'Tee Sheet Settings'">
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              :to="{ name: 'SettingsTeeSheetEntry' }"
              :prepend-icon="'mdi-calendar'"
              :class="['narrow-nav-item', { 'v-list-item--active': isTeeSheet }]"
              data-cy="subnav-tee-sheet-settings"
            />
          </template>
        </v-tooltip>
      </v-list>
    </aside>
    <aside class="nav" v-if="isTeeSheet">
        <div class="scoping">
          <label class="lbl">Tee Sheet</label>
          <select v-model="teeSheetId" @change="onSheetChange" data-cy="tee-sheet-select" aria-label="Select tee sheet">
            <option v-for="s in teeSheets" :value="s.id" :key="s.id">{{ s.name }}</option>
          </select>
          <div class="calendar" tabindex="0" @keydown.prevent="onCalendarKeydown" aria-label="Calendar navigation region">
            <div class="cal-header">
              <button class="cal-nav" @click="prevMonth" aria-label="Previous month">‹</button>
              <span class="cal-title">{{ monthYear }}</span>
              <button class="cal-nav" @click="nextMonth" aria-label="Next month">›</button>
            </div>
            <div class="cal-grid" role="grid" aria-label="Tee sheet calendar">
              <div class="dow" v-for="d in dows" :key="d">{{ d }}</div>
              <div class="day" v-for="n in leadingBlanks" :key="'b'+n"></div>
              <button
                class="day"
                v-for="d in daysInMonth"
                :key="'d'+d"
                :class="{ selected: isSelected(d) }"
                :aria-label="ariaFor(d)"
                @click="selectDay(d)"
                data-cy="cal-day"
              >
                {{ d }}
                <span class="dots">
                  <span v-if="hasOverride(d)" class="dot override" title="Override"></span>
                  <span v-else-if="hasSeason(d)" class="dot season" title="Season"></span>
                </span>
              </button>
            </div>
            <div class="cal-legend" aria-label="Calendar legend" data-cy="cal-legend">
              <span><span class="dot override" aria-hidden="true"></span> Override</span>
              <span><span class="dot season" aria-hidden="true"></span> Season</span>
            </div>
            <div class="cal-actions">
              <button class="btn sm" @click="goOverrides" :disabled="!selectedDateISO" data-cy="cal-btn-overrides" aria-label="Go to Overrides">Overrides</button>
              <button class="btn sm" @click="goSeasons" :disabled="!selectedDateISO" data-cy="cal-btn-seasons" aria-label="Go to Seasons">Seasons</button>
              <button class="btn sm" @click="regenSelected" :disabled="!selectedDateISO" data-cy="cal-btn-regenerate" aria-label="Regenerate selected date">Regenerate</button>
              <button class="btn sm" @click="openRangeDialog" :disabled="!teeSheetId" data-cy="cal-btn-regenerate-range" aria-label="Regenerate date range">Range…</button>
            </div>
            <div class="cal-preview" v-if="selectedDateISO" data-cy="cal-preview">
              <div class="row head">
                <strong>Availability Preview</strong>
                <span class="muted" v-if="previewLoading">Loading…</span>
                <span class="muted" v-else>{{ previewSlots.length }} slots</span>
              </div>
              <div class="row controls">
                <label class="ml-2">Group size</label>
                <select v-model.number="groupSize" @change="loadPreview" data-cy="preview-group-size">
                  <option :value="1">1</option>
                  <option :value="2">2</option>
                  <option :value="3">3</option>
                  <option :value="4">4</option>
                </select>
                <template v-for="(side, sid) in sidesById" :key="sid">
                  <label class="ml-2">
                    <input type="checkbox" :value="sid" v-model="enabledSides" @change="noop" :data-cy="`preview-side-${sid}`" />
                    {{ side.name || `Side ${String(sid).slice(0,6)}` }}
                  </label>
                </template>
              </div>
              <div v-if="previewError" class="err">{{ previewError }}</div>
              <div v-else class="preview-list">
                <div v-for="(items, sideId) in groupedBySideFiltered" :key="sideId" class="preview-side">
                  <div class="side-title">{{ sideName(sideId) }}</div>
                  <div class="times">
                    <span v-for="t in items.slice(0,3)" :key="t.id" class="time">{{ formatTime(t.start_time) }}</span>
                    <span v-if="items.length > 3" class="more">+{{ items.length - 3 }} more</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="showRangeDialog" class="dialog" role="dialog" aria-modal="true" aria-label="Regenerate Date Range" data-cy="regen-range-dialog">
            <div class="dlg-body">
              <div class="row">
                <label>Start</label>
                <input type="date" v-model="rangeStart" data-cy="regen-range-start" />
                <label class="ml-2">End</label>
                <input type="date" v-model="rangeEnd" data-cy="regen-range-end" />
              </div>
              <div class="row mt-2">
                <button class="btn sm" @click="queueRange" :disabled="!isValidRange" data-cy="regen-range-queue">Queue</button>
                <button class="btn sm ml-2" @click="closeRangeDialog" data-cy="regen-range-cancel">Cancel</button>
              </div>
            </div>
          </div>
        </div>
        <router-link :to="{ name: 'SettingsTeeSheetsSides', params:{ teeSheetId } }"><i class="mdi mdi-table-large nav-ico"></i><span>Sides</span></router-link>
        <router-link :to="{ name: 'SettingsDayTemplates', params:{ teeSheetId } }">Day Templates</router-link>
        <router-link :to="{ name: 'SettingsTimeframes', params:{ teeSheetId } }">Timeframes</router-link>
        <router-link :to="{ name: 'SettingsCalendar', params:{ teeSheetId } }">Calendar</router-link>
        <router-link :to="{ name: 'SettingsClosures', params:{ teeSheetId } }">Closures</router-link>
        <router-link :to="{ name: 'SettingsBookingClasses', params:{ teeSheetId } }">Booking Classes</router-link>
    </aside>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { settingsAPI, teeTimesAPI } from '@/services/api';
const route = useRoute();
const router = useRouter();
const teeSheetRouteNames = new Set([
  'SettingsTeeSheetsSides',
  'SettingsDayTemplates',
  'SettingsTimeframes',
  'SettingsCalendar',
  'SettingsClosures',
  'SettingsBookingClasses',
]);
const isTeeSheet = computed(() => teeSheetRouteNames.has(route.name));
const teeSheets = ref([]);
const teeSheetId = ref(route.params.teeSheetId || '');

async function loadSheets(){
  try { const { data } = await settingsAPI.listTeeSheets(); teeSheets.value = data || []; }
  catch { teeSheets.value = []; }
  if (!teeSheetId.value && teeSheets.value[0]) teeSheetId.value = teeSheets.value[0].id;
}

function onSheetChange(){
  try { localStorage.setItem('teeSheet:lastSheet', teeSheetId.value); } catch {}
  if (route.name && teeSheetRouteNames.has(route.name)){
    router.replace({ name: route.name, params: { teeSheetId: teeSheetId.value } });
  }
}

// calendar basics
let current = ref(new Date());
const dows = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const monthYear = computed(()=> current.value.toLocaleString(undefined,{ month:'long', year:'numeric' }));
const leadingBlanks = computed(()=> new Date(current.value.getFullYear(), current.value.getMonth(), 1).getDay());
const daysInMonth = computed(()=> new Date(current.value.getFullYear(), current.value.getMonth()+1, 0).getDate());
const selectedDay = ref(null);
const overrideDates = ref(new Set());
const seasonDates = ref(new Set());
const previewLoading = ref(false);
const previewError = ref('');
const previewSlots = ref([]);
const sidesById = ref({});
const groupSize = ref(2);
const enabledSides = ref([]);
const showRangeDialog = ref(false);
const rangeStart = ref('');
const rangeEnd = ref('');
const isValidRange = computed(() => {
  if (!rangeStart.value || !rangeEnd.value) return false;
  return rangeStart.value <= rangeEnd.value;
});

function prevMonth(){
  const d = new Date(current.value);
  d.setMonth(d.getMonth() - 1);
  current.value = d;
}
function nextMonth(){
  const d = new Date(current.value);
  d.setMonth(d.getMonth() + 1);
  current.value = d;
}
function selectDay(d){
  selectedDay.value = d;
}
function isSelected(d){
  return selectedDay.value === d;
}

function pad(n){ return n < 10 ? `0${n}` : String(n); }
function ariaFor(d){
  try {
    const y = (current.value instanceof Date) ? current.value.getFullYear() : new Date().getFullYear();
    const m = (current.value instanceof Date) ? current.value.getMonth() + 1 : (new Date().getMonth() + 1);
    return `Select ${y}-${pad(m)}-${pad(d)}`;
  } catch { return `Select day ${d}`; }
}

function onCalendarKeydown(ev){
  const key = ev.key;
  let day = selectedDay.value ?? 1;
  let y = current.value.getFullYear();
  let m = current.value.getMonth();
  const curMonthDays = daysInMonth.value;
  const adjust = (delta) => {
    day += delta;
    if (day < 1){
      // go to previous month
      const prev = new Date(y, m, 0); // last day of previous month
      y = prev.getFullYear();
      m = prev.getMonth();
      day = prev.getDate();
      current.value = new Date(y, m, 1);
    } else if (day > curMonthDays){
      // next month
      const next = new Date(y, m + 1, 1);
      y = next.getFullYear();
      m = next.getMonth();
      day = 1;
      current.value = new Date(y, m, 1);
    }
    selectedDay.value = day;
  };
  switch (key){
    case 'ArrowLeft': adjust(-1); break;
    case 'ArrowRight': adjust(1); break;
    case 'ArrowUp': adjust(-7); break;
    case 'ArrowDown': adjust(7); break;
    case 'PageUp': prevMonth(); break;
    case 'PageDown': nextMonth(); break;
    case 'Home': selectedDay.value = 1; break;
    case 'End': selectedDay.value = curMonthDays; break;
    case 'Enter': // noop; click is not necessary since selectDay sets it
      break;
  }
}
const selectedDateISO = computed(() => {
  if (!selectedDay.value) return '';
  const y = current.value.getFullYear();
  const m = pad(current.value.getMonth() + 1);
  const d = pad(selectedDay.value);
  return `${y}-${m}-${d}`;
});

provide('settings:selectedDate', selectedDateISO);

function isoForDay(d){
  const y = current.value.getFullYear();
  const m = pad(current.value.getMonth() + 1);
  const dd = pad(d);
  return `${y}-${m}-${dd}`;
}
function hasOverride(d){ return overrideDates.value.has(isoForDay(d)); }
function hasSeason(d){ return seasonDates.value.has(isoForDay(d)); }

async function loadCalendarFlags(){
  seasonDates.value = new Set();
  overrideDates.value = new Set();
  if (!teeSheetId.value) return;
  try {
    const [ovRes, seaRes] = await Promise.all([
      settingsAPI.v2.listOverrides(teeSheetId.value),
      settingsAPI.v2.listSeasons(teeSheetId.value),
    ]);
    const y = current.value.getFullYear();
    const m = current.value.getMonth();
    const startOfMonth = new Date(y, m, 1);
    const endOfMonth = new Date(y, m + 1, 0);
    // Overrides: direct dates
    (ovRes.data || []).forEach(o => {
      if (!o?.date) return;
      const od = new Date(o.date + 'T00:00:00');
      if (od >= startOfMonth && od <= endOfMonth) {
        overrideDates.value.add(o.date);
      }
    });
    // Seasons: use published_version or latest version range
    (seaRes.data || []).forEach(s => {
      const pv = s.published_version || (s.versions && s.versions[s.versions.length - 1]);
      if (!pv?.start_date || !pv?.end_date_exclusive) return;
      const sd = new Date(pv.start_date + 'T00:00:00');
      const ed = new Date(pv.end_date_exclusive + 'T00:00:00');
      // Iterate days within month and within [sd, ed)
      for (let d = 1; d <= endOfMonth.getDate(); d++) {
        const cur = new Date(y, m, d);
        if (cur >= sd && cur < ed) {
          const iso = `${y}-${pad(m+1)}-${pad(d)}`;
          if (!overrideDates.value.has(iso)) seasonDates.value.add(iso);
        }
      }
    });
  } catch (_) {
    // ignore flags on failure
  }
}

watch([teeSheetId, current], loadCalendarFlags, { immediate: true });

async function loadSides(){
  if (!teeSheetId.value) { sidesById.value = {}; return; }
  try {
    const { data } = await settingsAPI.listSides(teeSheetId.value);
    const map = {};
    (data || []).forEach(s => { map[s.id] = s; });
    sidesById.value = map;
  } catch (_) {
    sidesById.value = {};
  }
}

function sideName(sideId){
  return sidesById.value[sideId]?.name || `Side ${String(sideId).slice(0,6)}`;
}

function formatTime(ts){
  try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  catch { return String(ts); }
}

const groupedBySide = computed(() => {
  const groups = {};
  for (const s of previewSlots.value) {
    const arr = groups[s.side_id] || (groups[s.side_id] = []);
    arr.push(s);
  }
  return groups;
});

const groupedBySideFiltered = computed(() => {
  const enabled = enabledSides.value;
  if (!enabled || enabled.length === 0) return groupedBySide.value;
  const out = {};
  for (const [sid, items] of Object.entries(groupedBySide.value)) {
    if (enabled.includes(sid)) out[sid] = items;
  }
  return out;
});

async function loadPreview(){
  previewError.value = '';
  previewSlots.value = [];
  if (!teeSheetId.value || !selectedDateISO.value) return;
  previewLoading.value = true;
  try {
    const { data } = await teeTimesAPI.available({ date: selectedDateISO.value, teeSheets: teeSheetId.value, groupSize: groupSize.value || 2 });
    previewSlots.value = Array.isArray(data) ? data : [];
  } catch (e) {
    previewError.value = 'Failed to load availability';
  } finally {
    previewLoading.value = false;
  }
}

watch([teeSheetId, selectedDateISO], () => { loadSides(); loadPreview(); }, { immediate: true });
watch(sidesById, () => {
  enabledSides.value = Object.keys(sidesById.value || {});
});

function noop(){ }

// Persist preview controls
watch(groupSize, (v) => {
  try { localStorage.setItem('settings:previewGroupSize', String(v)); } catch {}
});

watch(enabledSides, (v) => {
  try {
    if (teeSheetId.value) localStorage.setItem(`settings:enabledSides:${teeSheetId.value}`, JSON.stringify(v));
  } catch {}
}, { deep: true });

function goOverrides(){
  if (!teeSheetId.value) return;
  router.push({ name: 'SettingsV2Overrides', params: { teeSheetId: teeSheetId.value } });
}
function goSeasons(){
  if (!teeSheetId.value) return;
  router.push({ name: 'SettingsV2Seasons', params: { teeSheetId: teeSheetId.value } });
}
async function regenSelected(){
  if (!teeSheetId.value || !selectedDateISO.value) return;
  try {
    await settingsAPI.v2.regenerateDate(teeSheetId.value, selectedDateISO.value);
    try { window.dispatchEvent(new CustomEvent('snack', { detail: { color: 'success', text: `Regeneration queued for ${selectedDateISO.value}` } })); } catch {}
  } catch (e) {
    try { window.dispatchEvent(new CustomEvent('snack', { detail: { color: 'error', text: 'Failed to queue regeneration' } })); } catch {}
  }
}

function openRangeDialog(){
  // prefill from selected date
  try {
    if (selectedDateISO.value) {
      rangeStart.value = selectedDateISO.value;
      const dt = new Date(selectedDateISO.value + 'T00:00:00');
      dt.setDate(dt.getDate() + 1);
      const pad2 = (n)=> (n<10?`0${n}`:`${n}`);
      rangeEnd.value = `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`;
    }
  } catch {}
  showRangeDialog.value = true;
}

function closeRangeDialog(){ showRangeDialog.value = false; }

async function queueRange(){
  if (!teeSheetId.value || !isValidRange.value) return;
  try {
    await settingsAPI.v2.regenerateRange(teeSheetId.value, rangeStart.value, rangeEnd.value);
    try { window.dispatchEvent(new CustomEvent('snack', { detail: { color: 'success', text: `Regeneration queued for ${rangeStart.value} → ${rangeEnd.value}` } })); } catch {}
  } catch (e) {
    try { window.dispatchEvent(new CustomEvent('snack', { detail: { color: 'error', text: 'Failed to queue range regeneration' } })); } catch {}
  } finally {
    showRangeDialog.value = false;
  }
}

onMounted(loadSheets);

// URL always wins: keep local state in sync with route param
watch(() => route.params.teeSheetId, (newId) => {
  if (typeof newId === 'string' && newId && teeSheetId.value !== newId) {
    teeSheetId.value = newId;
    // load persisted side filters for this sheet
    try {
      const raw = localStorage.getItem(`settings:enabledSides:${newId}`);
      if (raw) enabledSides.value = JSON.parse(raw);
    } catch {}
  }
});

// initialize persisted group size
try {
  const gs = Number(localStorage.getItem('settings:previewGroupSize'));
  if (gs >= 1 && gs <= 4) groupSize.value = gs;
} catch {}
</script>

<style scoped>
.settings { display: grid; grid-template-columns: 64px 1fr; min-height: calc(100vh - 64px); }
.settings.has-third { grid-template-columns: 64px 220px 1fr; }
.subnav-icons { border-right: 1px solid #eee; padding-top: 6px; }
.subnav-icons :deep(.v-list){ padding:12px 0 0 0; display:flex; flex-direction:column; align-items:center; gap:0; }
.subnav-icons :deep(.narrow-nav-item){ width:40px; height:40px; border-radius:8px; justify-content:center; padding:0 !important; margin:0 auto; }
.subnav-icons :deep(.narrow-nav-item .v-list-item__prepend .v-icon){ font-size:20px !important; width:20px; height:20px; }
.subnav-icons :deep(.narrow-nav-item:hover),
.subnav-icons :deep(.narrow-nav-item.v-list-item--active){ background:#ccf9ff !important; }

.subnav-icons :deep(.narrow-nav-item.v-list-item--active .v-list-item__overlay){
  background:#ccf9ff !important;
  opacity:1 !important;
}

/* Icon colors on hover/active to match selected state */
.subnav-icons :deep(.narrow-nav-item .v-list-item__prepend .v-icon){ color:#333333 !important; opacity:1 !important; }
.subnav-icons :deep(.narrow-nav-item:hover .v-list-item__prepend .v-icon),
.subnav-icons :deep(.narrow-nav-item.v-list-item--active .v-list-item__prepend .v-icon){
  color:#003D7A !important; opacity:1 !important;
}
.subnav-icons :deep(.v-list-item .v-list-item__prepend){ margin-inline-end:0; }
.nav { border-right: 1px solid #eee; padding: 6px 8px; display: grid; gap: 2px; align-content: start; grid-auto-rows: min-content; }
.nav a { color: #2c3e50; text-decoration: none; display:flex; align-items:center; gap:8px; padding: 6px 8px; line-height: 1.1; border-radius: 6px; }
.nav a:hover{ background: #eaf4ff; }
.nav .nav-ico{ font-size: 18px; color:#6b778c; }
.nav a.router-link-active { font-weight: 600; }
.nav .scoping{ padding:8px 8px 10px; border-bottom:1px solid #eee; margin-bottom:6px; }
.nav .scoping .lbl{ display:block; font-size:12px; color:#6b778c; margin-bottom:6px; }
.nav .scoping select{ width:100%; padding:6px 8px; border:1px solid #e0e0e0; border-radius:6px; margin-bottom:8px; }
.calendar{ border:1px solid #e0e0e0; border-radius:8px; padding:8px; margin-bottom:8px; }
.cal-header{ font-weight:600; margin-bottom:6px; text-align:center; display:flex; align-items:center; justify-content:space-between; }
.cal-title{ flex:1; text-align:center; }
.cal-nav{ border:none; background:transparent; cursor:pointer; padding:4px 8px; border-radius:4px; }
.cal-nav:hover{ background:#eaf4ff; }
.cal-grid{ display:grid; grid-template-columns: repeat(7, 1fr); gap:2px; }
.dow{ font-size:11px; color:#6b778c; text-align:center; padding:2px 0; }
.day{ text-align:center; padding:6px 0; border-radius:4px; }
.day.selected{ background:#ccf9ff; font-weight:600; }
.day .dots{ display:block; height:4px; margin-top:2px; }
.dot{ display:inline-block; width:6px; height:6px; border-radius:50%; margin:0 1px; vertical-align:middle; }
.dot.override{ background:#d32f2f; }
.dot.season{ background:#1976d2; }
.cal-legend{ display:flex; gap:12px; font-size:12px; color:#6b778c; margin:6px 0; }
.dialog{ position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; }
.dialog .dlg-body{ background:#fff; padding:12px; border-radius:8px; min-width:300px; }
.content { padding: 16px; }
</style>


