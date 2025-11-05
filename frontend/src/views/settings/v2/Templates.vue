<template>
  <div class="pa-4" data-cy="templates-v2">
    <div class="toolbar">
      <h2 class="title">Templates</h2>
      <v-btn variant="text" class="create-btn" :disabled="busy" @click="createTemplate" data-cy="template-create-btn">Create new template</v-btn>
    </div>

    <div v-if="busy" class="muted" data-cy="templates-loading">Loading…</div>
    <div v-else-if="!templates.length" class="muted" data-cy="templates-empty">No templates yet</div>

    <div v-else class="cards">
      <v-card
        v-for="t in templates"
        :key="t.id"
        variant="outlined"
        class="tpl-card"
        :style="{ borderLeft: `12px solid ${colorForTemplate(t)}` }"
        @click="openDetail(t)"
        :data-cy="`template-card-${shortId(t.id)}`"
      >
        <div class="tpl-card__header">
          <div class="tpl-card__title">{{ t.name || 'Untitled Template' }}</div>
          <div class="card-menu">
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="fa:fal fa-ellipsis-vertical" variant="text" density="comfortable" @click.stop></v-btn>
              </template>
              <v-list density="compact">
                <v-list-item :data-cy="`template-menu-delete-${shortId(t.id)}`" @click.stop="remove(t)">
                  <v-list-item-title>Delete</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </div>
        <div class="tpl-card__row">
          <span class="pill" :class="{ archived: t.archived }">{{ t.archived ? 'Archived' : 'Active' }}</span>
          <span class="sep">•</span>
          <span>Interval {{ t.interval_mins }} mins</span>
          <template v-if="t.versions && t.versions.length">
            <span class="sep">•</span>
            <span v-for="v in t.versions" :key="v.id" class="ver">v{{ v.version_number }}</span>
          </template>
        </div>
      </v-card>
    </div>

    <!-- Side Drawer for Template Settings -->
    <div v-if="detailOpen" class="drawer-backdrop" @click="detailOpen=false"></div>
    <aside class="drawer" :class="{ open: detailOpen }" aria-label="Template Settings">
      <div class="drawer-header">
        <div class="drawer-title">Template Settings</div>
        <button class="close" @click="detailOpen=false" aria-label="Close">✕</button>
      </div>
      <div class="drawer-body">
        <v-tabs v-model="tab" bg-color="transparent">
          <v-tab value="teetime">Tee Time Settings</v-tab>
          <v-tab value="sides">Side Settings</v-tab>
          <v-tab value="prices">Price Settings</v-tab>
          <v-tab value="color">Color Settings</v-tab>
        </v-tabs>
        <v-window v-model="tab" class="after-tabs">
          <v-window-item value="teetime">
            <div class="section">
              <div class="section__header">Template Details</div>
              <div class="section__grid single">
                <v-text-field v-model="form.name" label="Name" variant="outlined" density="compact" hide-details />
              </div>
            </div>

            <div class="section">
              <div class="section__header">Intervals</div>
              <div class="section__grid two-cols">
                <v-select :items="intervalTypes" v-model="form.interval_type" label="Type" variant="outlined" density="compact" hide-details />
                <v-text-field v-model.number="form.interval_mins" type="number" min="1" label="Minutes" variant="outlined" density="compact" hide-details />
              </div>
            </div>

            <div class="section">
              <div class="section__header">Players Allowed</div>
              <div class="section__grid single">
                <v-text-field v-model.number="form.max_players_staff" type="number" min="1" max="8" label="Max players (tee sheet)" variant="outlined" density="compact" hide-details />
                <div>
                  <div class="mb-1" style="font-weight:600; font-size:12px; color:#6b778c;">Players Allowed (Online Booking)</div>
                  <div class="circle-row" role="group" aria-label="Players allowed (online)">
                    <button
                      v-for="n in playerCounts"
                      :key="'sel-'+n"
                      type="button"
                      :class="['circle', { active: (form.online_selected||[]).includes(n) }]"
                      @click="toggleOnline(n)"
                    >{{ n }}</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section__header">Booking Class Settings</div>
              <div class="muted" style="margin-bottom:8px; font-size:12px;">Check to enable online booking for the class. Set how many days in advance golfers in this class can book.</div>
              <div class="class-grid rows">
                <div v-for="cls in courseClasses" :key="cls" class="class-row">
                  <v-checkbox
                    class="bc-check"
                    v-model="classToggles[cls]"
                    :label="cls.charAt(0).toUpperCase()+cls.slice(1)"
                    density="compact"
                    color="primary"
                    true-icon="fa:fal fa-square-check"
                    false-icon="fa:fal fa-square"
                    hide-details
                  />
                  <v-text-field
                    v-model.number="windowDays[cls]"
                    type="number"
                    min="0"
                    label="Booking Window (Days)"
                    variant="outlined"
                    density="compact"
                    :rules="daysRules"
                    class="days-input"
                    :disabled="!classToggles[cls]"
                    @blur="normalizeDays(cls)"
                  />
                </div>
              </div>
            </div>
          </v-window-item>
          <v-window-item value="sides">
            <div class="section">
              <div class="section__header">Side Settings</div>
              <div v-if="sideBusy" class="muted">Loading side settings…</div>
              <div v-else class="side-list side-columns">
                <div v-for="s in sideSettings" :key="s.side_id" class="side-block">
                  <div class="side-block__header">{{ s.name }}</div>
                  <div class="side-fields">
                    <div>
                      <div class="mb-1" style="font-weight:600; font-size:12px; color:#6b778c;">Bookable holes</div>
                      <div class="online-multi">
                        <v-btn-toggle v-model="s.hole_selected" multiple density="compact" divided @update:modelValue="ensureContiguousHoles(s)">
                          <v-btn v-for="n in (bookableOptions[s.side_id] || [])" :key="'holes-'+s.side_id+'-'+n" :value="n" variant="outlined">{{ n }}</v-btn>
                        </v-btn-toggle>
                      </div>
                    </div>
                    <v-text-field
                      v-model.number="s.minutes_per_hole"
                      type="number"
                      min="1"
                      max="30"
                      label="Minutes per hole"
                      variant="outlined"
                      density="compact"
                      hide-details
                    />
                    <v-select
                      :items="cartPolicies"
                      v-model="s.cart_policy"
                      item-title="title"
                      item-value="value"
                      label="Carts"
                      variant="outlined"
                      density="compact"
                      hide-details
                    />
                    <v-select
                      :items="rotateItemsFor(s)"
                      v-model="s.rotates_to_side_id"
                      item-title="name"
                      item-value="id"
                      label="Rotates to"
                      variant="outlined"
                      density="compact"
                      :disabled="!requiresRotation(s)"
                      hide-details
                    />
                  </div>
                </div>
              </div>
            </div>
          </v-window-item>
          <v-window-item value="prices">
            <div class="muted">Price Settings coming soon.</div>
          </v-window-item>
          <v-window-item value="color">
            <div class="section">
              <div class="section__header">Template Color</div>
              <div class="section__grid single">
                <div class="field w-64 color-field">
                  <input type="color" v-model="templateColor" class="color-input" aria-label="Template color" title="Template color" />
                </div>
              </div>
            </div>
          </v-window-item>
        </v-window>
      </div>
      <div class="drawer-actions">
        <v-spacer />
        <v-btn variant="flat" color="primary" :disabled="saving" @click="saveSettings">Save</v-btn>
      </div>
    </aside>

    <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="2500">
      {{ snackbarMessage }}
      <template #actions>
        <v-btn color="white" variant="text" @click="showSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
    <!-- In-use dialog -->
    <v-dialog v-model="inUseOpen" max-width="640">
      <v-card class="alert-card">
        <div class="alert-header">Template is in use</div>
        <v-card-text>
          <div>This template is used in the following items. Please remove it from all seasons/overrides before deleting.</div>
          <div v-if="inUseSeasons.length" class="mt-3">
            <div class="section__header">Seasons</div>
            <ul>
              <li v-for="s in inUseSeasons" :key="s.id">{{ s.name || s.id }}</li>
            </ul>
          </div>
          <div v-if="inUseOverrides.length" class="mt-3">
            <div class="section__header">Overrides</div>
            <ul>
              <li v-for="o in inUseOverrides" :key="o.id">{{ o.name || o.id }}</li>
            </ul>
          </div>
        </v-card-text>
        <v-card-actions class="alert-actions">
          <v-spacer />
          <v-btn class="alert-btn" variant="flat" color="red" @click="inUseOpen=false">OK</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
  
</template>

<script setup>
import { onMounted, ref, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const templates = ref([]);
const versionNotes = reactive({});
const busy = ref(false);
const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');
const selected = ref(null);
const detailOpen = ref(false);
const tab = ref('teetime');
const form = reactive({ name: '', interval_type: 'standard', interval_mins: 10, max_players_staff: 4, max_players_online: 4, online_selected: [2,3,4], online_access: [] });
const intervalTypes = ['standard'];
const courseClasses = ['public', 'junior', 'full', 'senior', 'social'];
const classToggles = reactive({});
const windowDays = reactive({});
const daysRules = [
  v => (v === undefined || v === null || Number.isFinite(v)) || 'Enter a number',
  v => (v === undefined || v === null || (typeof v === 'number' && v >= 0)) || 'Must be  0',
  v => (v === undefined || v === null || Number.isInteger(Number(v))) || 'Must be an integer',
];

function normalizeDays(cls){
  const raw = windowDays[cls];
  let num = Number(raw);
  if (!Number.isFinite(num) || num < 0) num = 0;
  windowDays[cls] = Math.trunc(num);
}
const saving = ref(false);
const playerCounts = [1,2,3,4,5,6];
const templateColor = ref('#9be7a8');

function colorKey(id){ return id ? `template:color:${id}` : ''; }
function loadColor(id){ try { return localStorage.getItem(colorKey(id)) || ''; } catch { return ''; } }
function saveColor(id, val){ try { if (id) localStorage.setItem(colorKey(id), val || ''); } catch {} }
function colorForTemplate(t){ return (t && t.color) || loadColor(t?.id) || '#e5e7eb'; }

// Side Settings state
const sideBusy = ref(false);
const sideVersionId = ref(null);
const sideSettings = reactive([]);
const allSides = ref([]);
const bookableOptions = reactive({}); // side_id -> number[]
const cartPolicies = [
  { title: 'Not Allowed', value: 'not_allowed' },
  { title: 'Required', value: 'required' },
  { title: 'Optional', value: 'optional' },
];

function notify(message, color = 'success') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  showSnackbar.value = true;
}

async function load() {
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    if (!teeSheetId) { templates.value = []; return; }
    const { data } = await settingsAPI.v2.listTemplates(teeSheetId);
    templates.value = data || [];
  } catch (e) {
    alert('Failed to load templates');
  } finally {
    busy.value = false;
  }
}

async function createTemplate() {
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    const { data } = await settingsAPI.v2.createTemplate(teeSheetId, { interval_mins: 10 });
    await load();
    // Auto-open the newly created template in the side panel
    try {
      const createdId = data?.id;
      const tpl = (templates.value || []).find(t => String(t.id) === String(createdId)) || (templates.value || [])[templates.value.length - 1];
      if (tpl) await openDetail(tpl);
    } catch {}
    notify('Template created');
  } catch (e) {
    notify('Failed to create template', 'error');
  } finally {
    busy.value = false;
  }
}

async function createVersion(templateId) {
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    const notes = versionNotes[templateId] || '';
    await settingsAPI.v2.createTemplateVersion(teeSheetId, templateId, { notes });
    await load();
    notify('Version created');
  } catch (e) {
    notify('Failed to create template version', 'error');
  } finally {
    busy.value = false;
  }
}

// Publishing removed: templates are considered available once referenced by seasons/overrides.

async function archive(t) {
  try { const teeSheetId = route.params.teeSheetId; await settingsAPI.v2.archiveTemplate(teeSheetId, t.id); await load(); notify('Template archived'); } catch { notify('Failed to archive', 'error'); }
}
async function unarchive(t) {
  try { const teeSheetId = route.params.teeSheetId; await settingsAPI.v2.unarchiveTemplate(teeSheetId, t.id); await load(); notify('Template unarchived'); } catch { notify('Failed to unarchive', 'error'); }
}
// In-use dialog state
const inUseOpen = ref(false);
const inUseSeasons = ref([]);
const inUseOverrides = ref([]);

async function remove(t) {
  try {
    const teeSheetId = route.params.teeSheetId;
    await settingsAPI.v2.deleteTemplate(teeSheetId, t.id);
    await load();
    notify('Template deleted');
  } catch (e) {
    const status = e?.response?.status;
    const data = e?.response?.data || {};
    if (status === 409 && data?.in_use) {
      inUseSeasons.value = Array.isArray(data.in_use.seasons) ? data.in_use.seasons : [];
      inUseOverrides.value = Array.isArray(data.in_use.overrides) ? data.in_use.overrides : [];
      inUseOpen.value = true;
    } else {
      notify(data?.error || 'Delete failed', 'error');
    }
  }
}

function shortId(id){ return (id || '').slice(0,6); }
async function openDetail(t){
  selected.value = t;
  // Initialize form from selected
  form.name = t.name || '';
  form.interval_type = t.interval_type || 'standard';
  form.interval_mins = t.interval_mins || 10;
  form.max_players_staff = t.max_players_staff || 4;
  form.max_players_online = t.max_players_online || 4;
  // Initialize multi-select based on max (fallback to 2-4)
  const max = form.max_players_online || 4;
  form.online_selected = [1,2,3,4,5,6].filter(n => n <= max && n >= 1);
  // Online access
  const map = {};
  for (const c of courseClasses) map[c] = true;
  const online = t.online_access || [];
  for (const r of online) { map[r.booking_class_id?.toLowerCase?.() || r.booking_class_id] = !!r.is_online_allowed; }
  Object.assign(classToggles, map);
  // Color
  templateColor.value = t?.color || loadColor(t?.id) || '#9be7a8';
  detailOpen.value = true;
  // Load side settings for this template
  await loadSideSettings().catch(()=>{});
  // Load booking windows for latest version
  await loadBookingWindows();
}

async function saveSettings(){
  if (!selected.value) return;
  try {
    saving.value = true;
    // Validation: if an extended holes option is selected for a side, require a rotate target
    for (const s of sideSettings) {
      const base = baseHoleCount(s.side_id);
      const hasExtended = Array.isArray(s.hole_selected) && s.hole_selected.some(n => Number(n) > base);
      if (hasExtended && !s.rotates_to_side_id) {
        notify(`Rotation required: ${s.name} must rotate to a side when allowing 18 holes`, 'error');
        saving.value = false;
        return;
      }
    }
    const teeSheetId = route.params.teeSheetId;
    const payload = {
      name: form.name || 'Untitled Template',
      interval_type: form.interval_type,
      interval_mins: form.interval_mins,
      max_players_staff: form.max_players_staff,
      max_players_online: form.max_players_online,
      color: templateColor.value,
      online_access: Object.keys(classToggles).map(k => ({ booking_class_id: k, is_online_allowed: !!classToggles[k] })),
    };
    const onlineSel = Array.isArray(form.online_selected) ? form.online_selected.slice().sort((a,b)=>a-b) : [];
    const onlineMin = onlineSel.length ? onlineSel[0] : 1;
    const onlineMax = onlineSel.length ? onlineSel[onlineSel.length - 1] : 1;
    form.max_players_online = onlineMax;
    const tasks = [settingsAPI.v2.updateTemplateSettings(teeSheetId, selected.value.id, payload)];
    // Also persist side settings if loaded
    if (sideVersionId.value && sideSettings.length) {
      const sidesPayload = sideSettings.map(s => ({
        side_id: s.side_id,
        // start disabled when no hole options selected
        bookable_holes: Number(s.bookable_holes) || s.hole_count,
        minutes_per_hole: Number(s.minutes_per_hole) || undefined,
        cart_policy: s.cart_policy || 'optional',
        rotates_to_side_id: s.rotates_to_side_id || null,
        start_slots_enabled: Array.isArray(s.hole_selected) && s.hole_selected.length > 0,
        min_players: Number(onlineMin) || 1,
        allowed_hole_totals: Array.isArray(s.hole_selected) ? s.hole_selected.slice() : [],
      }));
      tasks.push(settingsAPI.v2.updateTemplateSideSettings(teeSheetId, selected.value.id, { version_id: sideVersionId.value, sides: sidesPayload }));
    }
    // Persist booking windows with online access for current version
    if (sideVersionId.value) {
      const entries = courseClasses.map(cls => {
        const enabled = !!classToggles[cls];
        const days = enabled ? Number(windowDays[cls] || 0) : 0;
        return { booking_class_id: cls, is_online_allowed: enabled, max_days_in_advance: days };
      });
      tasks.push(settingsAPI.v2.updateBookingWindows(teeSheetId, selected.value.id, { version_id: sideVersionId.value, entries }));
    }
    await Promise.all(tasks);
    await load();
    notify('Settings saved');
    detailOpen.value = false;
    saveColor(selected.value?.id, templateColor.value);
  } catch (e) {
    notify('Failed to save settings', 'error');
  } finally {
    saving.value = false;
  }
}

async function loadSideSettings(){
  try {
    sideBusy.value = true;
    const teeSheetId = route.params.teeSheetId;
    if (!teeSheetId || !selected.value) { sideVersionId.value = null; sideSettings.splice(0); return; }
    const { data } = await settingsAPI.v2.getTemplateSideSettings(teeSheetId, selected.value.id);
    sideVersionId.value = data?.version_id || null;
    const list = Array.isArray(data?.sides) ? data.sides : [];
    // Build side catalog and compute options first
    allSides.value = list.map(s => ({ id: s.side_id, name: s.name, hole_count: s.hole_count }));
    computeBookableOptions();
    // Clone into reactive array
    sideSettings.splice(0);
    for (const s of list) {
      // Compute selectable options for this side
      const opts = bookableOptions[s.side_id] || [];
      // If allowed_hole_totals present (even empty), use it; else derive from bookable_holes
      let holeSel = [];
      if (Array.isArray(s.allowed_hole_totals)) {
        const persisted = s.allowed_hole_totals
          .map(n => Number(n))
          .filter(n => opts.includes(n));
        holeSel = Array.from(new Set(persisted)).sort((a,b)=>a-b);
      } else {
        const bh = Number(s.bookable_holes) || s.hole_count;
        holeSel = opts.includes(bh) ? [bh] : [];
      }
      sideSettings.push({ ...s, hole_selected: holeSel });
    }
    // After side settings load, restore online selection range from min_players across sides
    if (sideSettings.length) {
      const minPlayersAcrossSides = Math.min(...sideSettings.map(s => Number(s.min_players) || 1));
      const maxOnline = Number(form.max_players_online) || 1;
      const start = Math.min(minPlayersAcrossSides, maxOnline);
      const end = Math.max(minPlayersAcrossSides, maxOnline);
      const range = [];
      for (let n = start; n <= end; n += 1) range.push(n);
      form.online_selected = range;
    }
  } catch (e) {
    // no-op
  } finally {
    sideBusy.value = false;
  }
}

async function loadBookingWindows(){
  try {
    const teeSheetId = route.params.teeSheetId;
    if (!teeSheetId || !selected.value) return;
    const { data } = await settingsAPI.v2.getBookingWindows(teeSheetId, selected.value.id);
    const wins = Array.isArray(data?.windows) ? data.windows : [];
    const online = Array.isArray(data?.online_access) ? data.online_access : [];
    for (const cls of courseClasses) {
      const w = wins.find(x => String(x.booking_class_id).toLowerCase() === cls);
      windowDays[cls] = w ? Number(w.max_days_in_advance) : 0;
    }
    for (const a of online) {
      const k = String(a.booking_class_id || '').toLowerCase();
      if (k) classToggles[k] = !!a.is_online_allowed;
    }
  } catch {}
}

function computeBookableOptions(){
  const sides = allSides.value || [];
  for (const s of sides) {
    const base = s.hole_count || 9;
    const opts = new Set([base]);
    for (const other of sides) {
      if (other.id === s.id) continue;
      const sum = base + (other.hole_count || 0);
      if (sum > 0) opts.add(sum);
    }
    const arr = Array.from(opts).sort((a,b)=>a-b);
    bookableOptions[s.id] = arr;
  }
}

function rotateCandidatesFor(side){
  const sides = allSides.value || [];
  const base = baseHoleCount(side.side_id);
  const needed = Number(side.bookable_holes) || base;
  return sides.filter(s => s.id !== side.side_id && (base + (s.hole_count || 0)) === needed);
}

function rotateItemsFor(side){
  const candidates = rotateCandidatesFor(side);
  // When rotation is not required, include None option
  if (!requiresRotation(side)) {
    return [{ id: null, name: 'None' }, ...candidates.map(s => ({ id: s.id, name: s.name }))];
  }
  // Rotation required: do not allow None
  return candidates.map(s => ({ id: s.id, name: s.name }));
}

function baseHoleCount(sideId){
  const s = allSides.value.find(x => x.id === sideId);
  return s ? (s.hole_count || 0) : 0;
}

function requiresRotation(s){
  const base = baseHoleCount(s.side_id);
  return (Number(s.bookable_holes) || base) > base;
}

function onBookableChange(s){
  const base = baseHoleCount(s.side_id);
  const val = Number(s.bookable_holes) || base;
  if (val <= base) {
    s.rotates_to_side_id = null;
  }
}

function ensureContiguousHoles(s){
  const opts = bookableOptions[s.side_id] || [];
  const sel = Array.isArray(s.hole_selected) ? s.hole_selected.slice() : [];
  if (sel.length === 0) {
    // none selected → starts disabled
    s.bookable_holes = baseHoleCount(s.side_id);
    s.rotates_to_side_id = null;
    return;
  }
  // Normalize to unique, sorted, valid selections (multi-select allowed)
  const norm = Array.from(new Set(sel
    .map(n => Number(n)||0)
    .filter(n => opts.includes(n)))).sort((a,b)=>a-b);
  s.hole_selected = norm;
  const base = baseHoleCount(s.side_id);
  const hasExtended = norm.some(n => n > base);
  // bookable_holes used by backend to infer reround pairing when extended present
  s.bookable_holes = hasExtended ? Math.max(...norm) : base;
  if (!hasExtended) {
    s.rotates_to_side_id = null;
  } else {
    // Auto select rotate target if exactly one candidate exists
    const cands = rotateCandidatesFor(s);
    if (cands.length === 1) {
      s.rotates_to_side_id = cands[0].id;
    } else if (!cands.find(x => String(x.id) === String(s.rotates_to_side_id))) {
      // Clear invalid/None selection when multiple candidates or current invalid
      s.rotates_to_side_id = null;
    }
  }
  onBookableChange(s);
}

function ensureOnlineMinMax(){
  // Keep min <= max and both within 1..6
  if (form.online_min_players < 1) form.online_min_players = 1;
  if (form.max_players_online < 1) form.max_players_online = 1;
  if (form.online_min_players > 6) form.online_min_players = 6;
  if (form.max_players_online > 6) form.max_players_online = 6;
  if (form.online_min_players > form.max_players_online) {
    form.online_min_players = form.max_players_online;
  }
}

function ensureContiguousOnline(){
  // If empty, default to [2,3,4]
  const sel = Array.isArray(form.online_selected) ? form.online_selected.slice() : [];
  if (sel.length === 0) { form.online_selected = [2,3,4]; return; }
  // Clamp to 1..6 and sort
  const norm = sel.map(n => Math.min(6, Math.max(1, Number(n)||1))).sort((a,b)=>a-b);
  const min = norm[0];
  const max = norm[norm.length - 1];
  // Snap to contiguous range [min..max]
  const range = [];
  for (let n = min; n <= max; n += 1) range.push(n);
  form.online_selected = range;
}

function toggleOnline(n){
  const set = new Set(Array.isArray(form.online_selected) ? form.online_selected : []);
  if (set.has(n)) set.delete(n); else set.add(n);
  form.online_selected = Array.from(set);
  ensureContiguousOnline();
}
onMounted(load);
</script>

<style scoped>
.drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 9998; }
.drawer { position: fixed; top: 0; right: 0; height: 100vh; width: 92vw; max-width: 920px; background: #fff; border-left: 1px solid #e5e7eb; transform: translateX(100%); transition: transform .2s ease-in-out; z-index: 9999; display: grid; grid-template-rows: auto 1fr auto; }
.drawer.open { transform: translateX(0); }
.drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e5e7eb; }
.head-actions{ display:flex; align-items:center; gap:8px; }
.drawer-title { font-weight: 700; font-size: 18px; }
.drawer-header .close { background: transparent; border: none; width: auto; height: auto; padding: 4px; font-size: 22px; line-height: 1; cursor: pointer; }
.drawer-body { padding: 16px; overflow-y: auto; }
.drawer-actions { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid #e5e7eb; gap: 8px; }
.alert-card { border: none; overflow: hidden; border-radius: 8px; }
.alert-header { background:#dc2626; color:#fff; padding:12px 16px; font-weight:700; font-size:16px; border-radius: 0; }
.alert-actions { border-top: 1px solid #f3f4f6; }
.alert-btn { background:#ef4444 !important; color:#fff !important; }
.toolbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.title{ font-weight:800; font-size:28px; }
.create-btn{ color:#5EE3BB; font-weight:600; letter-spacing:0.04em; }
.muted{ color:#6b778c; }
.cards{ display:flex; flex-direction:column; gap:12px; }
.tpl-card{ padding:10px 12px; cursor:pointer; width:100%; position:relative; border:1px solid #e5e7eb; border-radius:8px; }
.card-menu{ position:absolute; right:12px; top:10px; }
.tpl-card__header{ display:flex; align-items:center; justify-content:space-between; }
/* color-bar no longer used; border-left is colored via inline style */
.tpl-card__title{ font-weight:700; font-size:18px; }
.tpl-card__row{ color:#6b778c; margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ver{ background:#f1f5f9; border-radius:12px; padding:2px 8px; font-size:12px; }
.published{ color:#2e7d32; font-weight:600; }
.pill{ background:#eef7ff; border-radius:10px; padding:2px 8px; font-size:12px; }
.pill.archived{ background:#fdecea; color:#b71c1c; }
.sep{ margin:0 6px; color:#9aa0a6; }
.after-tabs{ margin-top:20px; }
.section{ margin-top:16px; }
.section__header{ font-weight:700; font-size:21px; color:#2b2f36; margin-bottom:10px; letter-spacing:0.02em; }
.section__grid{ display:grid; column-gap:16px; row-gap:16px; }
.section__grid.single{ grid-template-columns: minmax(240px, 440px); max-width: 440px; }
.section__grid.two-cols{ grid-template-columns: repeat(2, minmax(160px, 220px)); max-width: 460px; }
.detail-grid{ display:grid; grid-template-columns: repeat(4, minmax(160px,1fr)); column-gap:16px; row-gap:16px; padding-top:6px; }
.mt-3{ margin-top:16px; }
.mb-1{ margin-bottom:8px; }
.class-grid{ display:flex; flex-direction:column; gap:5px; align-items:flex-start; }
.class-grid.rows .class-row{ display:grid; grid-template-columns: 140px 220px; align-items:start; gap:12px; }
.class-grid.rows .class-row :deep(.v-label){ white-space:nowrap; }
.class-grid.rows .bc-check{ margin-top: 0; }
/* Nudge the label down to align with the numeric text inside the text field */
.class-grid.rows .bc-check :deep(.v-selection-control){ align-items: flex-start; gap: 10px; }
.class-grid.rows .bc-check :deep(.v-selection-control__input){ margin-top: 16px; }
.class-grid.rows .bc-check :deep(.v-label){ padding-top: 8px; margin-left: 6px; }
.days-input{ width:200px; }
/* Reduce Vuetify checkbox vertical margins inside list */
:deep(.class-grid .v-input){ margin-top: 0 !important; margin-bottom: 0 !important; }
:deep(.class-grid .v-selection-control){ min-height: 28px; }
.ver-list{ display:flex; flex-direction:column; gap:8px; }
.ver-row{ padding:6px 8px; border:1px solid #eee; border-radius:6px; }
.side-list{ display:flex; flex-direction:column; gap:16px; }
.side-columns{ display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:16px; }
.side-block{ border:1px solid #e5e7eb; border-radius:8px; padding:12px; }
.side-block__header{ font-weight:700; margin-bottom:8px; }
.online-multi{ display:flex; flex-wrap:wrap; gap:8px; }
.circle-row{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.circle-row .circle{ width:48px; height:48px; border-radius:50%; background:#fff; border:1px solid #d1d5db; color:#111827; display:inline-flex; align-items:center; justify-content:center; font-size:24px; line-height:1; cursor:pointer; transition: background .15s, color .15s, border-color .15s, transform .08s; }
.circle-row .circle:hover{ background:#f3f4f6; }
.circle-row .circle:active{ transform: scale(0.98); }
.circle-row .circle.active{ background:#ccf9ff; color:#111827; border-color:#99e6f5; }
.side-fields{ display:flex; flex-direction:column; gap:12px; }
/* Color input swatch identical to seasons/overrides */
.color-input{ width:56px; height:56px; padding:0; border:1px solid #e0e0e0; border-radius:8px; background:#fff; display:block; }
.color-input::-webkit-color-swatch-wrapper{ padding:2px; border-radius:8px; }
.color-input::-webkit-color-swatch{ border:none; border-radius:8px; }
.color-input::-moz-color-swatch{ border:none; border-radius:8px; }
/* Make compact inputs truly smaller: reduce input and label font sizes inside drawer */
.drawer-body :deep(.v-field .v-field-label){ font-size: 13px !important; }
.drawer-body :deep(.v-field .v-field__input){ font-size: 16px !important; }
.drawer-body :deep(.v-field .v-field__input input){ font-size: 16px !important; }
.drawer-body :deep(.v-select .v-select__selection-text){ font-size: 16px !important; }
</style>


