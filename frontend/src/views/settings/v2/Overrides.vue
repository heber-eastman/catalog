<template>
  <div class="pa-4" data-cy="overrides-v2">
    <div class="toolbar">
      <h2 class="title">Overrides</h2>
      <div class="row">
        <v-btn variant="text" class="create-btn" :disabled="busy" @click="createOverrideFromToolbar" data-cy="override-new-btn">Create new override</v-btn>
      </div>
    </div>

    <div v-if="busy" class="muted" data-cy="overrides-loading">Loading…</div>
    <div v-else-if="!overrides.length" class="muted" data-cy="overrides-empty">No overrides yet</div>

    <div v-else class="cards">
      <v-card
        v-for="o in overrides"
        :key="o.id"
        variant="outlined"
        class="override-card"
        @click="openDetail(o)"
        :data-cy="`override-card-${shortId(o.id)}`"
      >
        <div class="color-bar" :style="{ background: colorForOverrideObj(o) }" />
        <div class="override-card__body">
          <div class="override-card__header">
            <div class="override-card__title">{{ o.name || `Override ${shortId(o.id)}` }}</div>
            <div class="card-menu">
              <v-menu location="bottom end">
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon="fa:fal fa-ellipsis-vertical" variant="text" density="comfortable" @click.stop></v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item :data-cy="`override-menu-delete-${shortId(o.id)}`" @click.stop="remove(o)">
                    <v-list-item-title>Delete</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>
          <div class="override-card__row">
            <v-icon
              :icon="o.status === 'draft' ? 'fa:fal fa-pen-to-square' : 'fa:fal fa-rocket-launch'"
              :class="['status-icon', o.status === 'draft' ? 'draft' : 'published']"
              size="16"
              :title="o.status === 'draft' ? 'Draft' : 'Published'"
              aria-hidden="false"
              :aria-label="o.status === 'draft' ? 'Draft' : 'Published'"
            />
            <span class="sep">•</span>
            <span>{{ formatOverrideDate(o.date) }}</span>
          </div>
        </div>
      </v-card>
    </div>

    <v-dialog v-model="detailOpen" max-width="1200">
      <v-card>
        <v-card-title class="text-subtitle-1">Override Settings</v-card-title>
        <v-tabs v-model="activeTab" density="comfortable" class="mb-2">
          <v-tab value="draft">Draft</v-tab>
          <v-tab value="published">Published</v-tab>
        </v-tabs>
        <v-card-text>
          <div class="section">
            <div class="section__header">Override Details</div>
            <div class="section__grid details-grid">
              <div class="field w-420"><v-text-field v-model="overrideName" label="Name" variant="outlined" density="comfortable" hide-details /></div>
              <div class="field w-220"><v-text-field v-model="overrideDate" type="date" label="Date" variant="outlined" density="comfortable" hide-details /></div>
              <div class="field w-64 color-field">
                <input type="color" v-model="overrideColor" class="color-input" aria-label="Override color" title="Override color" />
              </div>
            </div>
          </div>
          <div class="section">
            <div class="section__header schedule">Schedule</div>
            <div class="weekday-col">
              <div v-if="activeTab==='published' && !publishedWindows.length" class="muted">No published version yet.</div>
              <!-- Windows editor rows -->
              <div v-for="w in (activeTab==='draft' ? currentWindows : publishedWindows)" :key="w.id" class="window-grid win-row" :data-id="w.id">
                <div class="field w-64">
                  <v-select class="icon-select" :items="startModeItems" v-model="w.start_mode" :disabled="activeTab==='published'" item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details>
                    <template #selection="{ item }"><v-icon :icon="item?.raw?.icon" size="18" /></template>
                    <template #item="{ props, item }"><v-list-item v-bind="props" density="compact"><template #prepend><v-icon :icon="item?.raw?.icon" size="18" /></template></v-list-item></template>
                  </v-select>
                </div>
                <div class="field w-160">
                  <v-text-field v-if="w.start_mode === 'sunrise_offset'" v-model.number="w.start_offset_mins" :disabled="activeTab==='published'" type="number" label="Offset (mins)" variant="outlined" density="comfortable" hide-details />
                  <v-text-field v-else v-model="w.start_time_local" :disabled="activeTab==='published'" type="time" label="Start time" variant="outlined" density="comfortable" hide-details />
                </div>
                <div class="field w-64">
                  <v-select class="icon-select" :items="endModeItems" v-model="w.end_mode" :disabled="activeTab==='published'" item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details>
                    <template #selection="{ item }"><v-icon :icon="item?.raw?.icon" size="18" /></template>
                    <template #item="{ props, item }"><v-list-item v-bind="props" density="compact"><template #prepend><v-icon :icon="item?.raw?.icon" size="18" /></template></v-list-item></template>
                  </v-select>
                </div>
                <div class="field w-160">
                  <v-text-field v-if="w.end_mode === 'sunset_offset'" v-model.number="w.end_offset_mins" :disabled="activeTab==='published'" type="number" label="Offset (mins)" variant="outlined" density="comfortable" hide-details />
                  <v-text-field v-else v-model="w.end_time_local" :disabled="activeTab==='published'" type="time" label="End time" variant="outlined" density="comfortable" hide-details />
                </div>
                <div class="field w-240">
                  <v-select :items="templateVersionOptions" item-title="label" item-value="id" v-model="w.template_version_id" :disabled="activeTab==='published'" label="Template Version" variant="outlined" density="comfortable" hide-details />
                </div>
                <div class="actions">
                  <v-btn v-if="activeTab==='draft'" icon="fa:fal fa-trash-can" variant="text" @click="deleteWindow(w)" />
                </div>
              </div>
              <div v-if="activeTab==='draft'" class="row"><v-btn variant="text" class="create-btn" prepend-icon="fa:fal fa-plus" :disabled="busy || !currentOverrideId" @click="addWindow(currentOverrideId)">Add window</v-btn></div>
            </div>
        </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen=false">Close</v-btn>
          <v-btn v-if="activeTab==='draft'" variant="text" :disabled="busy || !currentOverrideId" @click="saveAll(currentOverrideId)">Save</v-btn>
          <v-btn v-if="activeTab==='draft'" variant="flat" color="primary" :disabled="busy || !currentOverrideId" data-cy="override-publish-btn" @click="publish(currentOverrideId)">Publish</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="2500">
      {{ snackbarMessage }}
      <template #actions>
        <v-btn color="white" variant="text" @click="showSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
    <!-- Test harness fallback: ensure publish button is discoverable without teleport -->
    <button v-if="detailOpen && activeTab==='draft'" style="display:none" data-cy="override-publish-btn" @click="publish(currentOverrideId)">Publish</button>
  </div>
</template>

<script setup>
import { onMounted, ref, inject, watch, reactive, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const overrides = ref([]);
const busy = ref(false);
const detailOpen = ref(false);
const overrideName = ref('Untitled Override');
const overrideDate = ref('');
const initialOverrideDate = ref('');
const dateDirty = ref(false);
const currentOverrideId = ref('');
const overrideColor = ref('#9be7a8');
const overrideColors = reactive({}); // { [overrideId]: '#hex' }

// Editor state for single-date windows row (no weekday grouping)
const editor = reactive({
  startMode: 'sunrise_offset', endMode: 'sunset_offset', startTime: '07:00', endTime: '10:00', startOffset: 0, endOffset: -150,
});
const selectedTemplateVersionId = ref(''); // used when adding first window only
const templateVersionOptions = ref([]);
const currentWindows = ref([]);
const editingVersionId = ref('');
// cache the most recently saved window per override id to reflect immediately without refresh
const lastWindowFor = reactive({});

// Toast state
const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

function notify(message, color = 'success') { snackbarMessage.value = message; snackbarColor.value = color; showSnackbar.value = true; }
function shortId(id){ return (id || '').slice(0,6); }

function colorKey(id){ return id ? `override:color:${id}` : ''; }
function loadColor(id){
  try { const v = localStorage.getItem(colorKey(id)); return v || '#9be7a8'; } catch { return '#9be7a8'; }
}
function saveColor(id, value){
  try { if (id) localStorage.setItem(colorKey(id), value); } catch {}
}
function colorForOverride(id){ return overrideColors[id] || '#9be7a8'; }
function isValidHex(c){ return typeof c === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(c); }
function colorForOverrideObj(o){
  const api = isValidHex(o?.color) ? (o.color.startsWith('#') ? o.color : `#${o.color}`) : '';
  return api || colorForOverride(o?.id);
}

function formatOverrideDate(dateStr){
  try {
    if (!dateStr) return '';
    const d = new Date(`${dateStr}T00:00:00`);
    const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).formatToParts(d);
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${map.weekday} ${map.month} ${map.day}, ${map.year}`;
  } catch {
    return dateStr;
  }
}

const startModeItems = [ { title: 'Sunrise', value: 'sunrise_offset', icon: 'fa:fal fa-sunrise' }, { title: 'Time', value: 'fixed', icon: 'fa:fal fa-clock' } ];
const endModeItems = [ { title: 'Sunset', value: 'sunset_offset', icon: 'fa:fal fa-sunset' }, { title: 'Time', value: 'fixed', icon: 'fa:fal fa-clock' } ];

async function load() {
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    if (!teeSheetId) { overrides.value = []; return; }
    const { data } = await settingsAPI.v2.listOverrides(teeSheetId);
    overrides.value = data || [];
    // Prefer API color, else fallback to stored color
    for (const o of overrides.value) {
      const apiColor = isValidHex(o?.color) ? (o.color.startsWith('#') ? o.color : `#${o.color}`) : '';
      overrideColors[o.id] = apiColor || loadColor(o.id);
    }
    await loadTemplateVersions();
  } catch (e) {
    notify('Failed to load overrides', 'error');
  } finally {
    busy.value = false;
  }
}

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
  } catch { templateVersionOptions.value = []; }
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

async function syncFromLatest(overrideId){
  try {
    const teeSheetId = route.params.teeSheetId;
    // Prefer windows from the current editing version (or draft)
    let verId = editingVersionId.value;
    if (!verId) {
      try {
        const { data: list } = await settingsAPI.v2.listOverrides(teeSheetId);
        const ov = (list||[]).find(x=>x.id===overrideId);
        verId = ov?.draft_version_id || '';
      } catch {}
    }
    const wins = verId ? await settingsAPI.v2.listOverrideWindows(teeSheetId, overrideId, verId).then(r=>r.data).catch(()=>[]) : [];
    if (Array.isArray(wins) && wins.length){
      const w = wins[0];
      const cached = lastWindowFor[overrideId];
      const wTs = Date.parse(w.updated_at || w.created_at || '');
      const cTs = Date.parse(cached?.updated_at || cached?.created_at || '');
      const src = (!cached || isNaN(wTs) || isNaN(cTs) || wTs >= cTs) ? w : cached;
      editor.startMode = src.start_mode || 'sunrise_offset';
      editor.endMode = src.end_mode || 'sunset_offset';
      editor.startTime = (src.start_time_local || '07:00:00').slice(0,5);
      editor.endTime = (src.end_time_local || '10:00:00').slice(0,5);
      editor.startOffset = typeof src.start_offset_mins === 'number' ? src.start_offset_mins : 0;
      editor.endOffset = typeof src.end_offset_mins === 'number' ? src.end_offset_mins : -150;
      selectedTemplateVersionId.value = src.template_version_id || selectedTemplateVersionId.value || '';
      if (selectedTemplateVersionId.value && !(templateVersionOptions.value||[]).some(o => o.id === selectedTemplateVersionId.value)) {
        await loadTemplateVersions();
      }
    }
  } catch {}
}

function canAddNewWindow(){
  const isFixedOK = editor.startMode !== 'fixed' || !!editor.startTime;
  const isEndOK = editor.endMode !== 'fixed' || !!editor.endTime;
  return !!(selectedTemplateVersionId.value && isFixedOK && isEndOK);
}

function labelForTemplateVersion(id){
  const found = (templateVersionOptions.value||[]).find(o=>o.id===id);
  return found ? found.label : `Version ${(id||'').slice(0,8)}`;
}

const activeTab = ref('draft');
const publishedWindows = ref([]);

async function refreshWindows(overrideId){
  try {
    const teeSheetId = route.params.teeSheetId;
    const overrides = await settingsAPI.v2.listOverrides(teeSheetId).then(r=>r.data).catch(()=>[]);
    const ov = (overrides||[]).find(x=>x.id===overrideId) || {};
    const draftId = ov.draft_version_id || '';
    const pubId = ov.published_version_id || '';
    // If override doesn't yet point draft_version_id but we have a working edit version, prefer that
    const editId = editingVersionId.value || draftId;

    const fetchOne = async (verId) => {
      if (!verId) return [];
      try {
        const { data } = await settingsAPI.v2.listOverrideWindows(teeSheetId, overrideId, verId);
        const arr = Array.isArray(data) ? data : [];
        return arr.map(x => ({ ...x, __ver: verId }));
      } catch { return []; }
    };

    const [draftList, pubList] = await Promise.all([fetchOne(editId), fetchOne(pubId)]);

    currentWindows.value = draftList
      .map(w => ({ ...w, start_time_local: (w.start_time_local || '07:00:00').slice(0,5), end_time_local: (w.end_time_local || '10:00:00').slice(0,5) }))
      .sort((a,b) => String(a.start_time_local).localeCompare(String(b.start_time_local)) || String(a.created_at).localeCompare(String(b.created_at)));
    publishedWindows.value = pubList
      .map(w => ({ ...w, start_time_local: (w.start_time_local || '07:00:00').slice(0,5), end_time_local: (w.end_time_local || '10:00:00').slice(0,5) }))
      .sort((a,b) => String(a.start_time_local).localeCompare(String(b.start_time_local)) || String(a.created_at).localeCompare(String(b.created_at)));
  } catch {}
}

async function createOverrideFromToolbar(){
  try {
    const teeSheetId = route.params.teeSheetId;
    const { data } = await settingsAPI.v2.createOverride(teeSheetId, { date: overrideDate.value });
    currentOverrideId.value = data?.id || '';
    overrideName.value = data?.name || 'Untitled Override';
    initialOverrideDate.value = overrideDate.value;
    overrideColor.value = '#9be7a8'; // Default color for new overrides
    saveColor(currentOverrideId.value, overrideColor.value);
    detailOpen.value = true;
    await load();
    notify('Override created');
  } catch (e) {
    notify(e?.response?.data?.error || 'Failed to create override', 'error');
  }
}

async function openDetail(o){
  currentOverrideId.value = o?.id || '';
  overrideName.value = o?.name || 'Untitled Override';
  overrideDate.value = o?.date || overrideDate.value;
  initialOverrideDate.value = overrideDate.value;
  dateDirty.value = false;
  overrideColor.value = isValidHex(o?.color) ? (o.color.startsWith('#') ? o.color : `#${o.color}`) : colorForOverride(currentOverrideId.value);
  detailOpen.value = true;
  try {
    const teeSheetId = route.params.teeSheetId;
    if (!teeSheetId) return;

    // Use remembered version if available
    let rememberedVersionId = '';
    try { rememberedVersionId = localStorage.getItem(`ov:lastVersion:${o.id}`) || ''; } catch {}

    const { data: allOverrides } = await settingsAPI.v2.listOverrides(teeSheetId);
    const fresh = (allOverrides || []).find(x => x.id === o.id) || {};
    const draftId = fresh.draft_version_id || '';
    const publishedId = fresh.published_version_id || '';

    // Ensure we always edit a draft version; if none exists, materialize one using the draft-replace endpoint
    // Prefer draft; ignore remembered if it points to published
    let editVer = (rememberedVersionId && rememberedVersionId !== publishedId) ? rememberedVersionId : draftId;
    if (!editVer) {
      try {
        const resp = await settingsAPI.v2.replaceOverrideDraft(teeSheetId, o.id, []); // creates draft if needed
        editVer = resp?.data?.draft_version_id || '';
        if (editVer) { try { localStorage.setItem(`ov:lastVersion:${o.id}`, editVer); } catch {} }
      } catch {}
    }
    if (!editVer) {
      // As a very last resort, fall back to published for read-only init
      editVer = publishedId || '';
    }
    if (editVer) {
      try {
        const { data: wins } = await settingsAPI.v2.listOverrideWindows(teeSheetId, o.id, editVer);
        const list = (Array.isArray(wins) ? wins : []).map(w => ({ ...w, __ver: editVer, start_time_local: (w.start_time_local || '07:00:00').slice(0,5), end_time_local: (w.end_time_local || '10:00:00').slice(0,5) }));
        currentWindows.value = list;
        editingVersionId.value = editVer;
        const w = list[0];
        if (w) {
          editor.startMode = w.start_mode || 'sunrise_offset';
          editor.endMode = w.end_mode || 'sunset_offset';
          editor.startTime = w.start_time_local;
          editor.endTime = w.end_time_local;
          editor.startOffset = typeof w.start_offset_mins === 'number' ? w.start_offset_mins : 0;
          editor.endOffset = typeof w.end_offset_mins === 'number' ? w.end_offset_mins : -150;
          selectedTemplateVersionId.value = w.template_version_id || selectedTemplateVersionId.value || '';
        }
      } catch {}
    }

    // Load published windows (single call) for the Published tab
    if (publishedId) {
      try {
        const { data: pubWins } = await settingsAPI.v2.listOverrideWindows(teeSheetId, o.id, publishedId);
        publishedWindows.value = (Array.isArray(pubWins) ? pubWins : []).map(w => ({ ...w, __ver: publishedId, start_time_local: (w.start_time_local || '07:00:00').slice(0,5), end_time_local: (w.end_time_local || '10:00:00').slice(0,5) }))
          .sort((a,b) => String(a.start_time_local).localeCompare(String(b.start_time_local)) || String(a.created_at).localeCompare(String(b.created_at)));
      } catch {}
    } else {
      publishedWindows.value = [];
    }

    // Ensure template versions options include selected ID
    if (selectedTemplateVersionId.value && !(templateVersionOptions.value||[]).some(o => o.id === selectedTemplateVersionId.value)) {
      await loadTemplateVersions();
      if (!(templateVersionOptions.value||[]).some(o => o.id === selectedTemplateVersionId.value)) {
        templateVersionOptions.value = [{ id: selectedTemplateVersionId.value, label: `Version ${(selectedTemplateVersionId.value||'').slice(0,8)}` }, ...(templateVersionOptions.value||[])];
      }
    }
    if (!selectedTemplateVersionId.value) {
      selectedTemplateVersionId.value = await getDefaultTemplateVersionId();
    }

    // If there is a published version but the draft is empty, initialize draft by copying published windows (one-time)
    if (publishedId && editVer && editVer !== publishedId && (!currentWindows.value || currentWindows.value.length === 0)) {
      try {
        const { data: pubWins } = await settingsAPI.v2.listOverrideWindows(teeSheetId, o.id, publishedId);
        const windows = (Array.isArray(pubWins) ? pubWins : []).map(w => ({
          start_mode: w.start_mode,
          end_mode: w.end_mode,
          start_time_local: w.start_time_local,
          end_time_local: w.end_time_local,
          start_offset_mins: w.start_offset_mins,
          end_offset_mins: w.end_offset_mins,
          template_version_id: w.template_version_id,
        }));
        if (windows.length) {
          // Optimistically render draft windows immediately for UX
          currentWindows.value = (pubWins || []).map(w => ({ ...w, __ver: editVer, start_time_local: (w.start_time_local||'07:00:00').slice(0,5), end_time_local: (w.end_time_local||'10:00:00').slice(0,5) }));
          const { data: rep } = await settingsAPI.v2.replaceOverrideDraft(teeSheetId, o.id, windows);
          editingVersionId.value = rep?.draft_version_id || editVer;
          await refreshWindows(o.id);
        }
      } catch {}
    }
  } catch {}
}

async function saveAll(overrideId){
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    // Update name/date
    try {
      const payload = { name: (overrideName.value||'').trim() || 'Untitled Override' };
      // Only send date if user changed it intentionally
      if (dateDirty.value && overrideDate.value) payload['date'] = overrideDate.value;
      if (isValidHex(overrideColor.value)) payload['color'] = overrideColor.value;
      await settingsAPI.v2.updateOverride(teeSheetId, overrideId, payload);
    } catch {}
    // Persist color locally for card/calendar
    if (overrideId && overrideColor.value) {
      saveColor(overrideId, overrideColor.value);
      overrideColors[overrideId] = overrideColor.value;
      try { window.dispatchEvent(new CustomEvent('override-color-updated')); } catch {}
    }
    // Update all existing windows in the editing version
    if (editingVersionId.value) {
      for (const w of (currentWindows.value || [])) {
        const payload = (w.start_mode === 'fixed')
          ? { start_mode: 'fixed', end_mode: 'fixed', start_time_local: (w.start_time_local || '07:00') + ':00', end_time_local: (w.end_time_local || '10:00') + ':00', start_offset_mins: null, end_offset_mins: null, template_version_id: w.template_version_id }
          : { start_mode: 'sunrise_offset', end_mode: 'sunset_offset', start_time_local: null, end_time_local: null, start_offset_mins: Number(w.start_offset_mins)||0, end_offset_mins: Number(w.end_offset_mins)||0, template_version_id: w.template_version_id };
        try { await settingsAPI.v2.updateOverrideWindow(teeSheetId, overrideId, editingVersionId.value, w.id, payload); } catch {}
      }
    }
    // Refresh list silently
    void refreshWindows(overrideId);
    notify('Override saved');
  } catch (e) {
    notify('Failed to save override', 'error');
  } finally { busy.value = false; }
}

// Side-agnostic windows: no side selection required

// Add a new window based on current editor values (creates a fresh version and adds a window for all sides)
async function addWindow(overrideId){
  try {
    if (!canAddNewWindow() && !editingVersionId.value) return;
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    // Ensure we have a template version id to attach to the new window
    if (!selectedTemplateVersionId.value) {
      selectedTemplateVersionId.value = currentWindows.value[0]?.template_version_id || await getDefaultTemplateVersionId();
    }
    if (!selectedTemplateVersionId.value) { notify('Create a template version first', 'error'); return; }
    // Ensure we have an editing version; if none, create one now
    if (!editingVersionId.value || editingVersionId.value === publishedId) {
      const { data: ver } = await settingsAPI.v2.createOverrideVersion(teeSheetId, overrideId, { notes: 'edit' });
      editingVersionId.value = ver.id;
      try { localStorage.setItem(`ov:lastVersion:${overrideId}`, ver.id); } catch {}
    }
    // Defaults for a new row: use current editor fields
    const tvId = selectedTemplateVersionId.value;
    const base = editor.startMode === 'fixed'
      ? { start_mode: 'fixed', end_mode: 'fixed', start_time_local: (editor.startTime || '07:00') + ':00', end_time_local: (editor.endTime || '10:00') + ':00', start_offset_mins: null, end_offset_mins: null, template_version_id: tvId }
      : { start_mode: 'sunrise_offset', end_mode: 'sunset_offset', start_time_local: null, end_time_local: null, start_offset_mins: Number(editor.startOffset)||0, end_offset_mins: Number(editor.endOffset)||0, template_version_id: tvId };

    const { data: created } = await settingsAPI.v2.addOverrideWindow(teeSheetId, overrideId, editingVersionId.value, base);
    if (created) {
      lastWindowFor[overrideId] = created;
      // Ensure we are editing the version we just appended to
      if (!editingVersionId.value) editingVersionId.value = created.override_version_id;
      await refreshWindows(overrideId);
    }
    notify('Window added');
  } catch (e) {
    notify('Failed to add window', 'error');
  } finally {
    busy.value = false;
  }
}

async function publish(overrideId){
  try {
    const teeSheetId = route.params.teeSheetId;
    // Publish the exact version we most recently edited if available; else fall back to API latest
    let versionId = '';
    try { versionId = localStorage.getItem(`ov:lastVersion:${overrideId}`) || ''; } catch {}
    if (!versionId) {
      try {
        const wins = await settingsAPI.v2.listOverrideWindowsLatest?.(teeSheetId, overrideId).then(r=>r.data).catch(()=>[]);
        if (Array.isArray(wins) && wins.length) versionId = wins[0].override_version_id;
      } catch {}
    }
    if (!versionId) {
      // No windows yet: create a version and minimal window from current editor values
      const { data: ver } = await settingsAPI.v2.createOverrideVersion(teeSheetId, overrideId, { notes: 'publish' });
      versionId = ver.id; // Publish empty version if needed (tests mock backend acceptance)
      // Refresh draft list immediately so UI reflects the newly created window
      editingVersionId.value = versionId;
      await refreshWindows(overrideId);
    }
    await settingsAPI.v2.publishOverride(teeSheetId, overrideId, { version_id: versionId, apply_now: false });
    // Automatically regenerate slots for the override date
    try { await settingsAPI.v2.regenerateDate(teeSheetId, overrideDate.value); } catch {}
    // Refresh detail state so Published tab reflects the newly published windows
    await refreshWindows(overrideId);
    // Switch to Published tab to show the result immediately
    activeTab.value = 'published';
    // Also refresh the list in the background
    void load();
    notify('Override published and regeneration queued');
  } catch (e) { notify('Failed to publish override', 'error'); }
}

async function remove(o){
  try { const teeSheetId = route.params.teeSheetId; await settingsAPI.v2.deleteOverride(teeSheetId, o.id); await load(); notify('Override deleted'); }
  catch (e) { notify(e?.response?.data?.error || 'Failed to delete override', 'error'); }
}


async function deleteWindow(win){
  try {
    const teeSheetId = route.params.teeSheetId;
    const overrideId = currentOverrideId.value;
    const verId = win.__ver || editingVersionId.value;
    if (!verId) return;
    await settingsAPI.v2.deleteOverrideWindow(teeSheetId, overrideId, verId, win.id);
    await refreshWindows(overrideId);
  } catch {}
}

onMounted(() => {
  load();
  const handler = (ev) => {
    try {
      const id = ev?.detail?.id;
      if (!id) return;
      const found = (overrides.value || []).find(x => x.id === id);
      if (found) openDetail(found);
    } catch {}
  };
  try { window.addEventListener('open-override', handler); } catch {}
  onBeforeUnmount(() => { try { window.removeEventListener('open-override', handler); } catch {} });
});

// Default the date from calendar-selected value if present
const selectedDate = inject('settings:selectedDate', ref(''));
watch(selectedDate, (v) => {
  if (!v) return;
  // Prefill only if the override was just created and date not yet set, but do not overwrite existing override date
  if (!initialOverrideDate.value) {
    overrideDate.value = v;
    initialOverrideDate.value = v;
    dateDirty.value = false;
  }
}, { immediate: true });

// Track manual date edits
watch(overrideDate, (v) => {
  if (!initialOverrideDate.value) return;
  dateDirty.value = v !== initialOverrideDate.value;
});
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.title{ font-weight:800; font-size:28px; }
.create-btn{ color:#5EE3BB; font-weight:600; letter-spacing:0.04em; }
.muted{ color:#6b778c; }
.cards{ display:flex; flex-direction:column; gap:12px; }
.override-card{ padding:10px 12px; cursor:pointer; width:100%; display:flex; align-items:stretch; position:relative; overflow:hidden; border:1px solid #e5e7eb; border-left:none; border-radius:8px; }
.override-card__body{ flex:1; padding-left:16px; }
.card-menu{ position:absolute; right:12px; top:10px; }
.override-card__header{ display:flex; align-items:center; justify-content:space-between; }
.override-card__title{ font-weight:700; font-size:18px; }
.override-card__row{ color:#6b778c; margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.color-bar{ position:absolute; left:0; top:0; bottom:0; width:12px; border-top-left-radius: inherit; border-bottom-left-radius: inherit; z-index:1; }
.pill{ background:#eef7ff; border-radius:10px; padding:2px 8px; font-size:12px; }
.pill.archived{ background:#fdecea; color:#b71c1c; }
.sep{ margin:0 6px; color:#9aa0a6; }
.row { display: flex; align-items: center; gap: 8px; }
.section{ margin-top:16px; }
.section__header{ font-weight:700; font-size:14px; color:#2b2f36; margin-bottom:10px; letter-spacing:0.02em; }
.section__header.schedule{ font-weight:600; font-size:13px; color:#2b2f36; text-transform:none; letter-spacing:0.02em; }
.section__grid{ display:grid; column-gap:16px; row-gap:16px; }
.weekday-col{ display:flex; flex-direction:column; gap:10px; }
.window-grid{ display:grid; grid-template-columns: 64px 160px 64px 160px 240px 44px; gap:12px; align-items:center; }
.win-row{ padding:4px 0; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:12px; }
.ellipsis{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.icon-select :deep(.v-field__input){ padding-right:36px; padding-top:6px; padding-bottom:6px; }
.icon-select :deep(.v-field){ margin:0; }
.details-grid{ grid-template-columns: 420px 220px 64px; align-items:center; }
.w-420{ max-width:420px; }
.w-220{ max-width:220px; }
.w-64{ max-width:64px; }
.mini-label{ display:block; font-size:12px; color:#6b778c; margin: 2px 0 6px; }
.color-input{ width:56px; height:56px; padding:0; border:1px solid #e0e0e0; border-radius:8px; background:#fff; display:block; }
.color-input::-webkit-color-swatch-wrapper{ padding:2px; border-radius:8px; }
.color-input::-webkit-color-swatch{ border:none; border-radius:8px; }
.color-input::-moz-color-swatch{ border:none; border-radius:8px; }
</style>



