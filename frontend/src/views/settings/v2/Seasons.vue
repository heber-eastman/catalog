<template>
  <div class="pa-4" data-cy="seasons-v2">
    <div class="toolbar">
      <h2 class="title">Seasons</h2>
      <div class="row">
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
        <div class="color-bar" :style="{ background: (s.color || colorForSeason(s.id) || fallbackColorForSeason(s.id)) }" />
        <div class="season-card__body">
          <div class="season-card__header">
            <div class="season-card__title">{{ s.name || `Season ${shortId(s.id)}` }}</div>
            <div class="card-menu">
              <v-menu location="bottom end">
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon="fa:fal fa-ellipsis-vertical" variant="text" density="comfortable" @click.stop></v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item :data-cy="`season-menu-delete-${shortId(s.id)}`" @click.stop="remove(s)">
                    <v-list-item-title>Delete</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>
          <div class="season-card__row">
            <v-icon
              :icon="s.status === 'draft' ? 'fa:fal fa-pen-to-square' : 'fa:fal fa-rocket-launch'"
              :class="['status-icon', s.status === 'draft' ? 'draft' : 'published']"
              size="16"
              :title="s.status === 'draft' ? 'Draft' : 'Published'"
              aria-hidden="false"
              :aria-label="s.status === 'draft' ? 'Draft' : 'Published'"
            />
            <span class="sep">•</span>
            <span>{{ seasonDates(s) }}</span>
          </div>
        </div>
      </v-card>
    </div>

    <!-- Side Panel: Season Settings -->
    <div v-if="detailOpen" class="drawer-backdrop" @click="detailOpen=false"></div>
    <aside class="drawer right" :class="{ open: detailOpen }" aria-label="Season Settings">
      <div class="drawer-header">
        <div class="drawer-title">Season Settings</div>
        <v-btn class="close" variant="text" @click="detailOpen=false">✕</v-btn>
      </div>
      <div class="drawer-body">
        <v-tabs v-model="activeTab" density="comfortable" class="mb-2" ref="tabsRef">
          <v-tab value="draft">Draft</v-tab>
          <v-tab value="published">Published</v-tab>
        </v-tabs>
        <!-- Removed fallback toggle to avoid duplicate tabs in drawer -->
        <div class="drawer-content">
          <div class="section">
            <div class="section__header">Season Details</div>
            <div class="section__grid">
              <div class="field w-220"><v-text-field v-model="seasonName" label="Name" variant="outlined" density="comfortable" hide-details /></div>
              <div class="field w-220"><v-text-field v-model="startDate" type="date" label="Start date" variant="outlined" density="comfortable" hide-details /></div>
              <div class="field w-220"><v-text-field v-model="endDate" type="date" label="End date" variant="outlined" density="comfortable" hide-details /></div>
              <div class="field w-64">
                <input type="color" v-model="seasonColor" class="color-input" aria-label="Season color" />
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section__header schedule">Schedule</div>
            <div class="weekday-rows">
              <div class="weekday-row" v-for="wd in weekdays" :key="wd.value">
                <div class="day-label">{{ wd.title }}</div>
                <div class="weekday-col" v-if="expandedByWeekday[wd.value]">
                  <!-- Published, read-only view -->
                  <template v-if="activeTab==='published'">
                    <div
                      class="window-grid"
                      v-for="(w, idx) in windowsForDayPublished(wd.value)"
                      :key="w.id || `${wd.value}-pub-${idx}`"
                    >
                      <div class="field w-64">
                        <v-select class="icon-select" :items="startModeItems" v-model="w.start_mode" disabled item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details>
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
                        <v-text-field v-if="w.start_mode === 'sunrise_offset'" v-model.number="w.start_offset_mins" disabled type="number" label="Offset (mins)" variant="outlined" density="comfortable" hide-details />
                        <v-text-field v-else v-model="w.start_time_local" disabled type="time" label="Start time" variant="outlined" density="comfortable" hide-details />
                      </div>
                      <div class="field w-64">
                        <v-select class="icon-select" :items="endModeItems" v-model="w.end_mode" disabled item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details>
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
                        <v-text-field v-if="w.end_mode === 'sunset_offset'" v-model.number="w.end_offset_mins" disabled type="number" label="Offset (mins)" variant="outlined" density="comfortable" hide-details />
                        <v-text-field v-else v-model="w.end_time_local" disabled type="time" label="End time" variant="outlined" density="comfortable" hide-details />
                      </div>
                      <div class="field w-240">
                        <v-select :items="templateVersionOptions" item-title="label" item-value="id" v-model="w.template_version_id" disabled label="Template Version" variant="outlined" density="comfortable" hide-details />
                      </div>
                      <div class="actions"></div>
                    </div>
                  </template>
                  
                  <!-- Draft, editable view -->
                  <template v-else>
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
                        icon="fa:fal fa-plus"
                        variant="text"
                        :disabled="busy"
                        @click="selectedSeason && addPendingForWeekday(selectedSeason.id, wd.value)"
                      />
                      <v-btn
                        icon="fa:fal fa-trash-can"
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
                        icon="fa:fal fa-trash-can"
                        variant="text"
                        :disabled="busy"
                        @click="selectedSeason && removePendingForWeekday(selectedSeason.id, wd.value, pidx)"
                      />
                    </div>
                  </div>
                  <!-- If no existing or pending windows, show inline add affordance in expanded view -->
                  <div v-if="windowsForDay(wd.value).length === 0 && pendingForDay(wd.value).length === 0" class="window-grid">
                    <div></div>
                    <div class="add-placeholder" @click="createFirstPending(wd.value)">Add window</div>
                    <div></div>
                    <div></div>
                    <v-btn
                      icon="fa:fal fa-plus"
                      variant="text"
                      :disabled="busy"
                      @click="createFirstPending(wd.value)"
                    />
                  </div>
                  </template>
                </div>
                <div v-else class="weekday-col">
                  <div class="window-grid">
                    <div></div>
                    <div class="add-placeholder" v-if="activeTab==='draft' && !hasWindowsForDay(wd.value)" @click="createFirstPending(wd.value)">Add window</div>
                    <div v-else></div>
                    <div></div>
                    <div></div>
                    <v-btn v-if="activeTab==='draft'"
                      icon="fa:fal fa-plus"
                      variant="text"
                      @click="createFirstPending(wd.value)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      <div class="drawer-actions">
        <v-spacer />
        <v-btn v-if="activeTab==='draft'" variant="text" :disabled="busy || !selectedSeason" @click="selectedSeason && saveAll(selectedSeason.id)">Save</v-btn>
        <v-btn v-if="activeTab==='draft'" variant="flat" color="primary" :disabled="busy" data-cy="season-publish-btn" @click="selectedSeason && publish(selectedSeason.id)">Publish</v-btn>
      </div>
    </aside>

    <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="2500">
      {{ snackbarMessage }}
      <template #actions>
        <v-btn color="white" variant="text" @click="showSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup>
import { onMounted, ref, reactive, inject, watch, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const seasons = ref([]);
const busy = ref(false);
const detailOpen = ref(false);
const selectedSeason = ref(null);
const seasonName = ref('');
const startDate = ref('');
const endDate = ref(''); // UI: inclusive end date
const initialStartDate = ref('');
const initialEndDate = ref('');
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
// ADDED: tabs and published cache
const activeTab = ref('draft');
const tabsRef = ref(null);
const showFallbackTabs = ref(false);
const windowsPublishedBySeason = reactive({});

const startModeItems = [
  { title: 'Sunrise', value: 'sunrise_offset', icon: 'fa:fal fa-sunrise' },
  { title: 'Time', value: 'fixed', icon: 'fa:fal fa-clock' },
];
const endModeItems = [
  { title: 'Sunset', value: 'sunset_offset', icon: 'fa:fal fa-sunset' },
  { title: 'Time', value: 'fixed', icon: 'fa:fal fa-clock' },
];

// Toast state
const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

// Season colors: persisted in localStorage by season id
const seasonColor = ref('#82b1ff');
const seasonColors = ref({}); // { [seasonId]: '#hex' }

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
    // Initialize per-season colors for cards from localStorage (or deterministic fallback)
    try {
      for (const s of seasons.value) {
        const key = `season:color:${s.id}`;
        const c = localStorage.getItem(key);
        if (c) seasonColors.value[s.id] = c; else if (!seasonColors.value[s.id]) seasonColors.value[s.id] = fallbackColorForSeason(s.id);
      }
    } catch {}
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
  // Display end date inclusively (v.end_date_exclusive - 1 day)
  const endInc = safeMinusDays(v.end_date_exclusive, 1);
  return `${formatHuman(v.start_date)} - ${formatHuman(endInc)}`;
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
  // Load stored color for this season
  try {
    // Prefer persisted API color; fall back to stored hex; then deterministic
    const apiColor = (s && typeof s.color === 'string' && s.color) ? s.color : '';
    const stored = getStoredSeasonColor(s.id);
    seasonColor.value = apiColor || stored || '#82b1ff';
  } catch { seasonColor.value = s?.color || '#82b1ff'; }
  detailOpen.value = true;
  activeTab.value = 'draft';
  // Detect if the Vuetify tabs rendered; if not, show fallback toggle
  nextTick(() => {
    try {
      const el = (tabsRef.value && (tabsRef.value.$el || tabsRef.value)) || null;
      const visible = !!(el && el.offsetHeight > 0 && el.querySelector('.v-tab'));
      showFallbackTabs.value = !visible;
    } catch { showFallbackTabs.value = true; }
  });
  // Restore latest version dates and template from windows if present
  try {
    // Ensure template options are fresh before setting selected id
    await loadTemplateVersions();
    // Prefer the last created version (draft) over published for editing
    const latest = ((s.versions && s.versions[s.versions.length-1]) || s.published_version) || null;
    const teeSheetId = route.params.teeSheetId;
    const pubId = s?.published_version?.id || null;
    if (latest) {
      currentVersionId.value = latest.id || '';
      startDate.value = latest.start_date || '';
      // Convert exclusive -> inclusive for UI
      endDate.value = safeMinusDays(latest.end_date_exclusive || '', 1);
      initialStartDate.value = startDate.value;
      initialEndDate.value = endDate.value;

      // If we would be editing the published version, create a new draft and copy published windows into it
      if (pubId && latest.id === pubId) {
        try {
          const { data: newVer } = await settingsAPI.v2.createSeasonVersion(teeSheetId, s.id, { start_date: startDate.value || latest.start_date, end_date_exclusive: endDate.value ? safePlusDays(endDate.value, 1) : latest.end_date_exclusive });
          currentVersionId.value = newVer.id;
          // Load published windows and copy into the new draft version
          let publishedWindows = [];
          try {
            const { data: pubWins } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, s.id, pubId);
            publishedWindows = Array.isArray(pubWins) ? pubWins : [];
          } catch { publishedWindows = []; }
          for (const w of publishedWindows) {
            await settingsAPI.v2.addSeasonWeekdayWindow(teeSheetId, s.id, newVer.id, {
              weekday: Number(w.weekday) || 0,
              start_mode: w.start_mode,
              end_mode: w.end_mode,
              start_time_local: w.start_time_local,
              end_time_local: w.end_time_local,
              start_offset_mins: typeof w.start_offset_mins === 'number' ? w.start_offset_mins : null,
              end_offset_mins: typeof w.end_offset_mins === 'number' ? w.end_offset_mins : null,
              template_version_id: w.template_version_id,
            });
          }
          // Refresh draft windows and set published cache
          const { data: copied } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, s.id, newVer.id);
          windowsBySeason[s.id] = Array.isArray(copied) ? copied : [];
          windowsPublishedBySeason[s.id] = publishedWindows.slice();
          updateExpandedForSeason(s.id);
        } catch {
          windowsBySeason[s.id] = [];
          windowsPublishedBySeason[s.id] = [];
        }
      } else {
        // Load windows to recover template version selection
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
        // Load published windows for read-only tab
        let publishedWindows = [];
        if (pubId) {
          try {
            const { data: pubWins } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, s.id, pubId);
            publishedWindows = Array.isArray(pubWins) ? pubWins : [];
          } catch { publishedWindows = []; }
        }
        windowsPublishedBySeason[s.id] = publishedWindows.slice();
        updateExpandedForSeason(s.id);
        // If latest (draft) has no windows and published has some, copy them into latest
        if ((windows || []).length === 0 && (publishedWindows || []).length > 0 && pubId && pubId !== latest.id) {
          try {
            for (const w of publishedWindows) {
              await settingsAPI.v2.addSeasonWeekdayWindow(teeSheetId, s.id, latest.id, {
                weekday: Number(w.weekday) || 0,
                start_mode: w.start_mode,
                end_mode: w.end_mode,
                start_time_local: w.start_time_local,
                end_time_local: w.end_time_local,
                start_offset_mins: typeof w.start_offset_mins === 'number' ? w.start_offset_mins : null,
                end_offset_mins: typeof w.end_offset_mins === 'number' ? w.end_offset_mins : null,
                template_version_id: w.template_version_id,
              });
            }
            const { data: copied } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, s.id, latest.id);
            windowsBySeason[s.id] = Array.isArray(copied) ? copied : [];
            updateExpandedForSeason(s.id);
          } catch {}
        }
      }
      // Expand rows default behavior if none seen above
      expandedByWeekday[0] = true;
      for (let i = 1; i <= 6; i++) expandedByWeekday[i] = expandedByWeekday[i] || false;
    } else {
      startDate.value = '';
      endDate.value = '';
      initialStartDate.value = '';
      initialEndDate.value = '';
      windowsBySeason[s.id] = [];
      windowsPublishedBySeason[s.id] = [];
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

// Ensure rows with windows are expanded
function updateExpandedForSeason(seasonId){
  const list = windowsBySeason[seasonId] || [];
  const days = new Set(list.map(w => Number(w.weekday) || 0));
  for (let i = 0; i <= 6; i++) {
    if (days.has(i)) expandedByWeekday[i] = true;
  }
}
// ADDED: published helper
function windowsForDayPublished(wd){
  const s = selectedSeason.value; if (!s) return [];
  return (windowsPublishedBySeason[s.id] || []).filter(w => w.weekday === wd);
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
  try {
    const created = (seasons.value || []).find(s => String(s.id) === String(season?.id)) || null;
    if (created) await openDetail(created);
  } catch {}
}

async function addVersion(seasonId) {
  const teeSheetId = route.params.teeSheetId;
  const sd = startDate.value; const ed = endDate.value;
  if (!sd || !ed) return;
  try {
    const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: sd, end_date_exclusive: safePlusDays(ed, 1) });
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
      const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: sd, end_date_exclusive: safePlusDays(ed, 1) });
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
    updateExpandedForSeason(seasonId);
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
    updateExpandedForSeason(seasonId);
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
    updateExpandedForSeason(seasonId);
    notify('Window deleted');
  } catch (e) {
    notify('Failed to delete window', 'error');
  }
}

async function publish(seasonId) {
  try {
    const teeSheetId = route.params.teeSheetId;
    // Publish the most recent (draft) version if present, else published
    const s = (seasons.value || []).find(x => x.id === seasonId) || selectedSeason.value;
    const versionId = (s?.versions && s.versions[s.versions.length - 1]?.id) || s?.published_version?.id;
    if (!versionId) { notify('No season version to publish', 'error'); return; }
    await settingsAPI.v2.publishSeason(teeSheetId, seasonId, { version_id: versionId, apply_now: false });
    await load();
    // Refresh published windows and switch tab
    const refreshed = (seasons.value || []).find(x => x.id === seasonId) || null;
    if (refreshed?.published_version?.id) {
      try {
        const { data: pubWins } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, seasonId, refreshed.published_version.id);
        windowsPublishedBySeason[seasonId] = Array.isArray(pubWins) ? pubWins : [];
      } catch { windowsPublishedBySeason[seasonId] = []; }
    }
    activeTab.value = 'published';
    notify('Season published');
  } catch (e) {
    notify('Failed to publish season', 'error');
  }
}

async function saveSeasonName(seasonId){
  try {
    const teeSheetId = route.params.teeSheetId;
    const name = (seasonName.value || '').trim() || 'Untitled Season';
    await settingsAPI.v2.updateSeason(teeSheetId, seasonId, { name, color: seasonColor.value || null });
    // Update local cache for immediate UI
    try { seasonColors.value[seasonId] = seasonColor.value || '#82b1ff'; } catch {}
    try { window.dispatchEvent(new CustomEvent('override-color-updated')); } catch {}
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
    await settingsAPI.v2.updateSeason(teeSheetId, seasonId, { name, color: seasonColor.value || null });
    // 1b) Ensure a version exists or roll a new one if dates changed
    const sd = startDate.value; const ed = endDate.value;
    if (!currentVersionId.value && sd && ed) {
      const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: sd, end_date_exclusive: safePlusDays(ed, 1) });
      currentVersionId.value = v.id;
      initialStartDate.value = sd; initialEndDate.value = ed;
    } else if (currentVersionId.value && ((sd && sd !== initialStartDate.value) || (ed && ed !== initialEndDate.value))) {
      // Dates changed: create a new version and copy existing windows into it
      const oldVersionId = currentVersionId.value;
      const { data: newVer } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: sd || initialStartDate.value, end_date_exclusive: safePlusDays(ed || initialEndDate.value, 1) });
      currentVersionId.value = newVer.id;
      // Copy windows from old version
      try {
        const { data: oldWins } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, seasonId, oldVersionId);
        for (const w of (Array.isArray(oldWins) ? oldWins : [])) {
          await settingsAPI.v2.addSeasonWeekdayWindow(teeSheetId, seasonId, newVer.id, {
            weekday: Number(w.weekday) || 0,
            start_mode: w.start_mode,
            end_mode: w.end_mode,
            start_time_local: w.start_time_local,
            end_time_local: w.end_time_local,
            start_offset_mins: typeof w.start_offset_mins === 'number' ? w.start_offset_mins : null,
            end_offset_mins: typeof w.end_offset_mins === 'number' ? w.end_offset_mins : null,
            template_version_id: w.template_version_id,
          });
        }
        const { data: copied } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, seasonId, newVer.id);
        windowsBySeason[seasonId] = Array.isArray(copied) ? copied : [];
        updateExpandedForSeason(seasonId);
      } catch {}
      initialStartDate.value = sd; initialEndDate.value = ed;
    }
    // Update local color cache and notify calendar
    try { seasonColors.value[seasonId] = seasonColor.value || '#82b1ff'; } catch {}
    try { window.dispatchEvent(new CustomEvent('override-color-updated')); } catch {}

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
      const { data: v } = await settingsAPI.v2.createSeasonVersion(teeSheetId, seasonId, { start_date: startDate.value, end_date_exclusive: safePlusDays(endDate.value, 1) });
      currentVersionId.value = v.id;
      initialStartDate.value = startDate.value; initialEndDate.value = endDate.value;
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
      // Refresh windows after creating pending
      const { data: windows } = await settingsAPI.v2.listSeasonWeekdayWindows(teeSheetId, seasonId, currentVersionId.value);
      windowsBySeason[seasonId] = Array.isArray(windows) ? windows : [];
      updateExpandedForSeason(seasonId);
    }

    // 3) Reload
    await load();
    // Clear pending cache for this season
    if (pendingBySeason[seasonId]) pendingBySeason[seasonId] = {};
    notify('Season saved');
    // Refresh calendar flags/colors after version/date changes
    try { window.dispatchEvent(new CustomEvent('override-color-updated')); } catch {}
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

onMounted(() => {
  load();
  const handler = (ev) => {
    try {
      const id = ev?.detail?.id;
      if (!id) return;
      const found = (seasons.value || []).find(x => x.id === id);
      if (found) openDetail(found);
    } catch {}
  };
  try { window.addEventListener('open-season', handler); } catch {}
  onBeforeUnmount(() => { try { window.removeEventListener('open-season', handler); } catch {} });
});

function colorForSeason(seasonId){
  const stored = getStoredSeasonColor(seasonId);
  if (stored) return stored;
  return seasonColors.value[seasonId] || fallbackColorForSeason(seasonId);
}

function getStoredSeasonColor(seasonId){
  try {
    const val = localStorage.getItem(`season:color:${seasonId}`) || '';
    // Accept only #RRGGBB or #RGB
    if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(val)) return val;
    return '';
  } catch { return ''; }
}

// Deterministic fallback color based on ID (stable across reloads)
function fallbackColorForSeason(id){
  try {
    const str = String(id || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const hue = Math.abs(hash) % 360; // spread over color wheel
    const sat = 70; // pleasant saturation
    const light = 65; // readable lightness
    return `hsl(${hue} ${sat}% ${light}%)`;
  } catch { return '#82b1ff'; }
}

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
        // Show template name and version only; omit notes to avoid stale suffixes after rename
        opts.push({ id: v.id, label: `${tmplName} v${v.version_number}` });
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

// Date helpers (YYYY-MM-DD)
function safePlusDays(iso, days){
  try { const d = new Date(String(iso)+'T00:00:00'); d.setDate(d.getDate() + Number(days||0)); return toIso(d); } catch { return iso; }
}
function safeMinusDays(iso, days){
  try { const d = new Date(String(iso)+'T00:00:00'); d.setDate(d.getDate() - Number(days||0)); return toIso(d); } catch { return iso; }
}
function toIso(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function formatHuman(iso){
  try {
    if (!iso) return '—';
    const d = new Date(String(iso)+'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso || '—'; }
}
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.title{ font-weight:800; font-size:28px; }
.create-btn{ color:#5EE3BB; font-weight:600; letter-spacing:0.04em; }
.muted{ color:#6b778c; }
.cards{ display:flex; flex-direction:column; gap:12px; }
.season-card{ padding:10px 12px; cursor:pointer; width:100%; display:flex; align-items:stretch; position:relative; overflow:hidden; border:1px solid #e5e7eb; border-left:none; border-radius:8px; }
.season-card__body{ flex:1; padding-left:16px; }
.card-menu{ position:absolute; right:12px; top:10px; }
.season-card__header{ display:flex; align-items:center; justify-content:space-between; }
.season-card__title{ font-weight:700; font-size:18px; }
.season-card__row{ color:#6b778c; margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.color-bar{ position:absolute; left:0; top:0; bottom:0; width:12px; background:#82b1ff; border-top-left-radius: inherit; border-bottom-left-radius: inherit; z-index:1; }
.pill{ background:#eef7ff; border-radius:10px; padding:2px 8px; font-size:12px; }
.pill.archived{ background:#fdecea; color:#b71c1c; }
.sep{ margin:0 6px; color:#9aa0a6; }
.status-icon{ color:#6b778c; }
.status-icon.draft{ color:#9aa0a6; }
.status-icon.published{ color:#10b981; }
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
.w-220{ width:220px; max-width:100%; }
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
/* Color input swatch rounded to match border */
.color-input{ width:56px; height:56px; padding:0; border:1px solid #e0e0e0; border-radius:8px; background:#fff; display:block; }
.color-input::-webkit-color-swatch-wrapper{ padding:2px; border-radius:8px; }
.color-input::-webkit-color-swatch{ border:none; border-radius:8px; }
.color-input::-moz-color-swatch{ border:none; border-radius:8px; }

/* Drawer styles (side panel) */
.drawer-backdrop{ position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 9998; }
.drawer{ position: fixed; top: 0; right: 0; height: 100vh; width: min(96vw, 1200px); max-width: 1200px; background: #fff; border-left: 1px solid #e5e7eb; transform: translateX(100%); transition: transform .2s ease-in-out; z-index: 9999; display: grid; grid-template-rows: auto 1fr auto; }
.drawer.open{ transform: translateX(0); }
.drawer-header{ display:flex; align-items:center; justify-content:space-between; padding:12px 12px 8px; border-bottom:1px solid #e5e7eb; }
.drawer-title{ font-weight:700; font-size:16px; }
.drawer-header .close{ background: transparent; border: none; min-width: auto; height: auto; padding: 4px; font-size: 22px; line-height: 1; cursor: pointer; }
.drawer-body{ overflow:auto; padding: 8px 12px 12px; }
.drawer-content{ padding-bottom: 8px; }
.drawer-actions{ padding: 10px 12px; border-top:1px solid #e5e7eb; display:flex; align-items:center; gap:8px; }
</style>


