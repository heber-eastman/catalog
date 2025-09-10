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
          <select v-model="teeSheetId" @change="onSheetChange">
            <option v-for="s in teeSheets" :value="s.id" :key="s.id">{{ s.name }}</option>
          </select>
          <div class="calendar">
            <div class="cal-header">
              <button class="cal-nav" @click="prevMonth" aria-label="Previous month">‹</button>
              <span class="cal-title">{{ monthYear }}</span>
              <button class="cal-nav" @click="nextMonth" aria-label="Next month">›</button>
            </div>
            <div class="cal-grid">
              <div class="dow" v-for="d in dows" :key="d">{{ d }}</div>
              <div class="day" v-for="n in leadingBlanks" :key="'b'+n"></div>
              <button
                class="day"
                v-for="d in daysInMonth"
                :key="'d'+d"
                :class="{ selected: isSelected(d) }"
                @click="selectDay(d)"
              >
                {{ d }}
                <span class="dots">
                  <span v-if="hasOverride(d)" class="dot override" title="Override"></span>
                  <span v-else-if="hasSeason(d)" class="dot season" title="Season"></span>
                </span>
              </button>
            </div>
            <div class="cal-actions">
              <button class="btn sm" @click="goOverrides" :disabled="!selectedDateISO">Overrides</button>
              <button class="btn sm" @click="goSeasons" :disabled="!selectedDateISO">Seasons</button>
              <button class="btn sm" @click="regenSelected" :disabled="!selectedDateISO">Regenerate</button>
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
import { settingsAPI } from '@/services/api';
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
    // lightweight feedback
    console.log('Regeneration queued for', selectedDateISO.value);
  } catch (e) {
    console.warn('Failed to queue regeneration', e);
  }
}

onMounted(loadSheets);

// URL always wins: keep local state in sync with route param
watch(() => route.params.teeSheetId, (newId) => {
  if (typeof newId === 'string' && newId && teeSheetId.value !== newId) {
    teeSheetId.value = newId;
  }
});
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
.content { padding: 16px; }
</style>


