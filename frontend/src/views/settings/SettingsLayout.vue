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
              </button>
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
.content { padding: 16px; }
</style>


