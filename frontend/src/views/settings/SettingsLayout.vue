<template>
  <div class="settings" :class="{ 'has-third': isTeeSheet }">
    <aside class="subnav-icons">
      <v-list nav density="compact">
        <v-tooltip location="end" :text="'General Settings'">
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              :to="{ name: 'SettingsGeneral' }"
              :prepend-icon="'fa:fal fa-gear'"
              class="narrow-nav-item"
              data-cy="subnav-general"
            />
          </template>
        </v-tooltip>
        <v-tooltip location="end" :text="'Tee Sheet Settings'">
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              :to="teeSheetNavTo"
              :prepend-icon="'fa:fal fa-calendar'"
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
              <v-tooltip
                v-for="d in daysInMonth"
                :key="'d'+d"
                location="top"
                :text="tooltipFor(d)"
              >
                <template #activator="{ props }">
                  <button
                    class="day"
                    v-bind="props"
                    :class="[ isSelected(d) ? 'selected' : '', hasOverride(d) ? 'ov-day' : (hasSeason(d) ? 'sea-day' : '') ]"
                    :style="styleForDay(d)"
                    :aria-label="ariaFor(d)"
                    @click="selectDay(d); openDetailForDate(d)"
                    data-cy="cal-day"
                  >
                    {{ d }}
                  </button>
                </template>
              </v-tooltip>
            </div>
            
          </div>
          
        </div>
        <router-link :to="{ name: 'SettingsV2GeneralInfo', params:{ teeSheetId } }" data-cy="subnav-general-info"><i class="fa-light fa-circle-info nav-ico"></i><span>General Info</span></router-link>
        <router-link :to="{ name: 'SettingsTeeSheetsSides', params:{ teeSheetId } }" data-cy="subnav-sides"><i class="fa-light fa-table-cells-large nav-ico"></i><span>Sides</span></router-link>
        <router-link :to="{ name: 'SettingsV2Seasons', params:{ teeSheetId } }" data-cy="subnav-seasons"><i class="fa-light fa-calendar-days nav-ico"></i><span>Seasons</span></router-link>
        <router-link :to="{ name: 'SettingsV2Templates', params:{ teeSheetId } }" data-cy="subnav-templates"><i class="fa-light fa-shapes nav-ico"></i><span>Templates</span></router-link>
        <router-link :to="{ name: 'SettingsV2Overrides', params:{ teeSheetId } }" data-cy="subnav-overrides"><i class="fa-light fa-sliders nav-ico"></i><span>Overrides</span></router-link>
    </aside>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, provide, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { settingsAPI, teeTimesAPI } from '@/services/api';
const route = useRoute();
const router = useRouter();
const teeSheetRouteNames = new Set([
  'SettingsTeeSheetsSides',
  'SettingsV2GeneralInfo',
  'SettingsV2Seasons',
  'SettingsV2Templates',
  'SettingsV2Overrides',
]);
const isTeeSheet = computed(() => teeSheetRouteNames.has(route.name));
const teeSheets = ref([]);
const teeSheetId = ref(route.params.teeSheetId || '');
const teeSheetNavTo = computed(() => {
  const id = teeSheetId.value;
  return id
    ? { name: 'SettingsTeeSheetsSides', params: { teeSheetId: id } }
    : { name: 'SettingsTeeSheetEntry' };
});

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
const dateToOverride = ref({}); // { iso: { id, name } }
const dateToSeasons = ref({}); // { iso: [{ id, name }] }
const seasonDateToColor = ref({}); // { 'YYYY-MM-DD': '#hex' } - optional tint for seasons
const overrideDateToColor = ref({}); // { 'YYYY-MM-DD': '#hex' }
const previewLoading = ref(false);
const previewError = ref('');
const previewSlots = ref([]);
const customerSlots = ref([]);
const compareCustomer = ref(false);
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
  persistSelected();
}
function nextMonth(){
  const d = new Date(current.value);
  d.setMonth(d.getMonth() + 1);
  current.value = d;
  persistSelected();
}
function selectDay(d){
  selectedDay.value = d;
  persistSelected();
}
function isSelected(d){
  return selectedDay.value === d;
}
function textColorOn(bg){
  try {
    const hex = (bg||'').replace('#','');
    const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
    const yiq = (r*299 + g*587 + b*114)/1000;
    return yiq >= 128 ? '#1b1b1b' : '#ffffff';
  } catch { return '#1b1b1b'; }
}
function styleForDay(d){
  const iso = isoForDay(d);
  const color = overrideDateToColor.value[iso] || seasonDateToColor.value[iso];
  if (color) return { background: color, color: textColorOn(color) };
  return {};
}

function tooltipFor(d){
  const iso = isoForDay(d);
  const parts = [];
  const ov = dateToOverride.value[iso];
  if (ov) parts.push(`Override: ${ov.name || 'Untitled Override'}`);
  const seas = dateToSeasons.value[iso] || [];
  if (seas.length) parts.push(`Season: ${seas.map(s=>s.name || 'Season').join(', ')}`);
  return parts.join(' \u2022 ');
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
    persistSelected();
  };
  switch (key){
    case 'ArrowLeft': adjust(-1); break;
    case 'ArrowRight': adjust(1); break;
    case 'ArrowUp': adjust(-7); break;
    case 'ArrowDown': adjust(7); break;
    case 'PageUp': prevMonth(); break;
    case 'PageDown': nextMonth(); break;
    case 'Home': selectedDay.value = 1; persistSelected(); break;
    case 'End': selectedDay.value = curMonthDays; persistSelected(); break;
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
  dateToOverride.value = {};
  dateToSeasons.value = {};
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
    overrideDateToColor.value = {};
    (ovRes.data || []).forEach(o => {
      if (!o?.date) return;
      if (o?.status && o.status !== 'published') return; // only published overrides mark the calendar
      const od = new Date(o.date + 'T00:00:00');
      if (od >= startOfMonth && od <= endOfMonth) {
        overrideDates.value.add(o.date);
        dateToOverride.value[o.date] = { id: o.id, name: o.name };
        // prefer API color, else fallback to stored color
        const apiColor = (typeof o.color === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(o.color)) ? (o.color.startsWith('#') ? o.color : `#${o.color}`) : '';
        if (apiColor) {
          overrideDateToColor.value[o.date] = apiColor;
        } else {
          try {
            const k = `override:color:${o.id}`;
            const c = localStorage.getItem(k);
            if (c) overrideDateToColor.value[o.date] = c;
          } catch {}
        }
      }
    });
    // Seasons: use published_version or latest version range
    seasonDateToColor.value = {};
    (seaRes.data || []).forEach(s => {
      const pv = s.published_version || (s.versions && s.versions[s.versions.length - 1]);
      if (!pv?.start_date || !pv?.end_date_exclusive) return;
      const sd = new Date(pv.start_date + 'T00:00:00');
      // Treat end as inclusive for display: include last day (subtract 1 day from exclusive)
      const edExc = new Date(pv.end_date_exclusive + 'T00:00:00');
      const ed = new Date(edExc.getFullYear(), edExc.getMonth(), edExc.getDate());
      ed.setDate(ed.getDate() - 1);
      // prefer API color; fallback to stored hex; then deterministic HSL
      let col = (typeof s.color === 'string' && s.color) ? s.color : '';
      if (!col) {
        try {
          const k = `season:color:${s.id}`;
          const v = localStorage.getItem(k) || '';
          col = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v) ? v : '';
        } catch { col = ''; }
      }
      if (!col) {
        // Deterministic fallback to keep season colors distinct across reloads
        try {
          const str = String(s.id || '');
          let hash = 0;
          for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
          const hue = Math.abs(hash) % 360; const sat = 70; const light = 65;
          col = `hsl(${hue} ${sat}% ${light}%)`;
        } catch { col = '#82b1ff'; }
      }
      // Iterate days within month and within [sd, ed)
      for (let d = 1; d <= endOfMonth.getDate(); d++) {
        const cur = new Date(y, m, d);
        if (cur >= sd && cur <= ed) {
          const iso = `${y}-${pad(m+1)}-${pad(d)}`;
          if (!overrideDates.value.has(iso)) seasonDates.value.add(iso);
          if (col && !overrideDateToColor.value[iso]) seasonDateToColor.value[iso] = col;
          const list = dateToSeasons.value[iso] || (dateToSeasons.value[iso] = []);
          if (!list.some(x => x.id === s.id)) list.push({ id: s.id, name: s.name });
        }
      }
    });
  } catch (_) {
    // ignore flags on failure
  }
}

function openDetailForDate(d){
  const iso = isoForDay(d);
  const ov = dateToOverride.value[iso];
  if (ov && ov.id) {
    goOverrides();
    setTimeout(() => { try { window.dispatchEvent(new CustomEvent('open-override', { detail: { id: ov.id } })); } catch {} }, 50);
    return;
  }
  const seas = dateToSeasons.value[iso] || [];
  if (seas.length) {
    const id = seas[0].id;
    if (id) {
      goSeasons();
      setTimeout(() => { try { window.dispatchEvent(new CustomEvent('open-season', { detail: { id } })); } catch {} }, 50);
    }
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
function isInCustomer(t){
  if (!customerSlots.value?.length) return false;
  return customerSlots.value.some(cs => cs.id === t.id);
}
function countCustomerForSide(sideId){
  if (!customerSlots.value?.length) return 0;
  return customerSlots.value.filter(cs => String(cs.side_id) === String(sideId)).length;
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
  customerSlots.value = [];
  if (!teeSheetId.value || !selectedDateISO.value) return;
  previewLoading.value = true;
  try {
    const params = { date: selectedDateISO.value, teeSheets: teeSheetId.value, groupSize: groupSize.value || 2 };
    if (enabledSides.value && enabledSides.value.length) {
      params['sides[]'] = enabledSides.value;
    }
    const { data } = await teeTimesAPI.available(params);
    previewSlots.value = Array.isArray(data) ? data : [];
    if (compareCustomer.value){
      const custParams = { ...params, customerView: true };
      const { data: custData } = await teeTimesAPI.available(custParams);
      customerSlots.value = Array.isArray(custData) ? custData : [];
    }
  } catch (e) {
    previewError.value = 'Failed to load availability';
  } finally {
    previewLoading.value = false;
  }
}

watch([teeSheetId, selectedDateISO, compareCustomer], () => { loadSides(); loadPreview(); }, { immediate: true });
watch(sidesById, () => {
  enabledSides.value = Object.keys(sidesById.value || {});
});

function noop(){ }
function enableAllSides(){ enabledSides.value = Object.keys(sidesById.value || {}); }
function enableNoSides(){ enabledSides.value = []; }

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

function goToday(){
  const now = new Date();
  current.value = new Date(now.getFullYear(), now.getMonth(), 1);
  selectedDay.value = now.getDate();
  persistSelected();
}

async function createStarterPreset(){
  if (!teeSheetId.value) return;
  try {
    await settingsAPI.v2.starterPreset(teeSheetId.value);
    try { window.dispatchEvent(new CustomEvent('snack', { detail: { color: 'success', text: 'Starter preset created and published' } })); } catch {}
    // refresh flags and preview
    await loadCalendarFlags();
    await loadPreview();
  } catch (e) {
    try { window.dispatchEvent(new CustomEvent('snack', { detail: { color: 'error', text: 'Failed to create starter preset' } })); } catch {}
  }
}

function persistSelected(){
  try {
    const key = 'settings:selectedDate';
    if (selectedDateISO.value) localStorage.setItem(key, selectedDateISO.value);
  } catch {}
}

onMounted(() => {
  loadSheets();
  // Refresh calendar colors when overrides broadcast an update
  const handler = () => { loadCalendarFlags(); };
  try { window.addEventListener('override-color-updated', handler); } catch {}
  onBeforeUnmount(() => { try { window.removeEventListener('override-color-updated', handler); } catch {} });
  // When a tee sheet is updated elsewhere (e.g., renamed), refresh list and keep selection
  const tsHandler = (e) => {
    const id = (e && e.detail && e.detail.id) ? e.detail.id : teeSheetId.value;
    loadSheets().then(() => {
      if (id) teeSheetId.value = id;
    });
  };
  try { window.addEventListener('tee-sheet-updated', tsHandler); } catch {}
  onBeforeUnmount(() => { try { window.removeEventListener('tee-sheet-updated', tsHandler); } catch {} });
  try {
    const saved = localStorage.getItem('settings:selectedDate');
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
      const dt = new Date(saved + 'T00:00:00');
      current.value = new Date(dt.getFullYear(), dt.getMonth(), 1);
      selectedDay.value = dt.getDate();
    }
  } catch {}
});

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
.settings { display: grid; grid-template-columns: 64px 1fr; min-height: calc(100vh - 64px); font-size: calc(16px * 1.18); --fs-scale: 1.18; /* local type scale for this screen */ --font-body: calc(16px * var(--fs-scale)); --font-label: calc(16px * var(--fs-scale)); }
.settings.has-third { grid-template-columns: 64px 220px 1fr; }
.subnav-icons { border-right: 1px solid #eee; padding-top: 6px; }
.subnav-icons :deep(.v-list){ padding:12px 0 0 0; display:flex; flex-direction:column; align-items:center; gap:0; }
.subnav-icons :deep(.narrow-nav-item){ width:40px; height:40px; border-radius:8px; justify-content:center; padding:0 !important; margin:0 auto; }
.subnav-icons :deep(.narrow-nav-item .v-list-item__prepend .v-icon){ font-size: calc(20px * var(--fs-scale)) !important; width:20px; height:20px; }
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
.nav .nav-ico{ font-size: calc(18px * var(--fs-scale)); color:#6b778c; }
.nav a.router-link-active { font-weight: 600; }
.nav .scoping{ padding:8px 8px 10px; border-bottom:1px solid #eee; margin-bottom:6px; }
.nav .scoping .lbl{ display:block; font-size: calc(12px * var(--fs-scale)); color:#6b778c; margin-bottom:6px; }
.nav .scoping select{ width:100%; padding:6px 8px; border:1px solid #e0e0e0; border-radius:6px; margin-bottom:8px; }
.calendar{ border:1px solid #e0e0e0; border-radius:8px; padding:8px; margin-bottom:8px; }
.cal-header{ font-weight:600; margin-bottom:6px; text-align:center; display:flex; align-items:center; justify-content:space-between; }
.cal-title{ flex:1; text-align:center; }
.cal-nav{ border:none; background:transparent; cursor:pointer; padding:4px 8px; border-radius:4px; }
.cal-nav:hover{ background:#eaf4ff; }
.cal-grid{ display:grid; grid-template-columns: repeat(7, 1fr); gap:2px; }
.dow{ font-size: calc(11px * var(--fs-scale)); color:#6b778c; text-align:center; padding:2px 0; }
.day{ text-align:center; padding:10px 0; border-radius:8px; transition:background-color .15s ease; }
.day.selected{ outline: 2px solid #222; outline-offset: -3px; font-weight:700; }
/* Full-day background colors */
.ov-day{ background:#dcfce7; color:#1b5e20; }
.sea-day{ background:#e3f2fd; color:#0d47a1; }
.day:hover{ filter:brightness(0.97); }
.dialog{ position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; }
.dialog .dlg-body{ background:#fff; padding:12px; border-radius:8px; min-width:300px; }
.content { padding: 16px; }
.time { display:inline-block; padding:2px 6px; border:1px solid #ddd; border-radius:6px; margin-right:4px; }
.time-badge { color:#d32f2f; margin-left:4px; font-size: calc(14px * var(--fs-scale)); line-height:1; vertical-align:middle; }
.time-tag { margin-left:6px; font-size: calc(11px * var(--fs-scale)); color:#8d6e63; background:#fbe9e7; border:1px solid #ffccbc; border-radius:4px; padding:1px 4px; }
.time-tag.blocked { color:#b71c1c; background:#ffebee; border-color:#ffcdd2; }
</style>


