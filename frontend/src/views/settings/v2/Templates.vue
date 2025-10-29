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
            <span v-for="v in t.versions" :key="v.id" class="ver">
              v{{ v.version_number }}<span v-if="t.published_version && t.published_version.id === v.id" class="published" aria-label="Published"> • published</span>
            </span>
          </template>
        </div>
      </v-card>
    </div>

    <v-dialog v-model="detailOpen" max-width="920">
      <v-card>
        <v-card-title class="text-subtitle-1">Template Settings</v-card-title>
        <v-card-text>
          <v-tabs v-model="tab" bg-color="transparent">
            <v-tab value="teetime">Tee Time Settings</v-tab>
            <v-tab value="sides">Side Settings</v-tab>
            <v-tab value="prices">Price Settings</v-tab>
          </v-tabs>
          <v-window v-model="tab" class="after-tabs">
            <v-window-item value="teetime">
              <div class="section">
                <div class="section__header">Template Details</div>
                <div class="section__grid single">
                  <v-text-field v-model="form.name" label="Name" variant="outlined" density="comfortable" hide-details />
                </div>
              </div>

              <div class="section">
                <div class="section__header">Intervals</div>
                <div class="section__grid two-cols">
                  <v-select :items="intervalTypes" v-model="form.interval_type" label="Type" variant="outlined" density="comfortable" hide-details />
                  <v-text-field v-model.number="form.interval_mins" type="number" min="1" label="Minutes" variant="outlined" density="comfortable" hide-details />
                </div>
              </div>

              <div class="section">
                <div class="section__header">Players Allowed</div>
                <div class="section__grid single">
                  <v-text-field v-model.number="form.max_players_staff" type="number" min="1" max="8" label="Max players (tee sheet)" variant="outlined" density="comfortable" hide-details />
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
                <div class="class-grid">
                  <v-checkbox
                    v-for="cls in courseClasses"
                    :key="cls"
                    v-model="classToggles[cls]"
                    :label="cls"
                    density="compact"
                    hide-details
                  />
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
                          <v-btn-toggle v-model="s.hole_selected" multiple density="comfortable" divided @update:modelValue="ensureContiguousHoles(s)">
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
                        density="comfortable"
                        hide-details
                      />
                      <v-select
                        :items="cartPolicies"
                        v-model="s.cart_policy"
                        item-title="title"
                        item-value="value"
                        label="Carts"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                      />
                      <v-select
                        :items="rotateItemsFor(s)"
                        v-model="s.rotates_to_side_id"
                        item-title="name"
                        item-value="id"
                        label="Rotates to"
                        variant="outlined"
                        density="comfortable"
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
          </v-window>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen=false">Close</v-btn>
          <v-btn variant="flat" color="primary" :disabled="saving" @click="saveSettings">Save</v-btn>
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
const courseClasses = ['Public', 'Member', 'Full'];
const classToggles = reactive({});
const saving = ref(false);
const playerCounts = [1,2,3,4,5,6];

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
    await settingsAPI.v2.createTemplate(teeSheetId, { interval_mins: 10 });
    await load();
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

async function publish(t) {
  try {
    busy.value = true;
    const teeSheetId = route.params.teeSheetId;
    const latest = (t.versions || []).slice().sort((a,b)=> (a.version_number||0)-(b.version_number||0)).pop();
    if (!latest) { notify('No versions to publish', 'error'); return; }
    await settingsAPI.v2.publishTemplate(teeSheetId, t.id, { version_id: latest.id, apply_now: false });
    await load();
    notify('Template published');
  } catch (e) {
    notify('Failed to publish template', 'error');
  } finally {
    busy.value = false;
  }
}

async function archive(t) {
  try { const teeSheetId = route.params.teeSheetId; await settingsAPI.v2.archiveTemplate(teeSheetId, t.id); await load(); notify('Template archived'); } catch { notify('Failed to archive', 'error'); }
}
async function unarchive(t) {
  try { const teeSheetId = route.params.teeSheetId; await settingsAPI.v2.unarchiveTemplate(teeSheetId, t.id); await load(); notify('Template unarchived'); } catch { notify('Failed to unarchive', 'error'); }
}
async function remove(t) {
  try { const teeSheetId = route.params.teeSheetId; await settingsAPI.v2.deleteTemplate(teeSheetId, t.id); await load(); notify('Template deleted'); } catch (e) { notify(e?.response?.data?.error || 'Delete failed', 'error'); }
}

function shortId(id){ return (id || '').slice(0,6); }
function openDetail(t){
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
  for (const r of online) { map[r.booking_class_id] = !!r.is_online_allowed; }
  Object.assign(classToggles, map);
  detailOpen.value = true;
  // Load side settings for this template
  loadSideSettings().catch(()=>{});
}

async function saveSettings(){
  if (!selected.value) return;
  try {
    saving.value = true;
    const teeSheetId = route.params.teeSheetId;
    const payload = {
      name: form.name || 'Untitled Template',
      interval_type: form.interval_type,
      interval_mins: form.interval_mins,
      max_players_staff: form.max_players_staff,
      max_players_online: form.max_players_online,
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
    await Promise.all(tasks);
    await load();
    notify('Settings saved');
    detailOpen.value = false;
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
.toolbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.title{ font-weight:800; font-size:28px; }
.create-btn{ color:#5EE3BB; font-weight:600; letter-spacing:0.04em; }
.muted{ color:#6b778c; }
.cards{ display:flex; flex-direction:column; gap:12px; }
.tpl-card{ padding:10px 12px; cursor:pointer; width:100%; position:relative; border:1px solid #e5e7eb; border-radius:8px; }
.card-menu{ position:absolute; right:12px; top:10px; }
.tpl-card__header{ display:flex; align-items:center; justify-content:space-between; }
.tpl-card__title{ font-weight:700; font-size:18px; }
.tpl-card__row{ color:#6b778c; margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ver{ background:#f1f5f9; border-radius:12px; padding:2px 8px; font-size:12px; }
.published{ color:#2e7d32; font-weight:600; }
.pill{ background:#eef7ff; border-radius:10px; padding:2px 8px; font-size:12px; }
.pill.archived{ background:#fdecea; color:#b71c1c; }
.sep{ margin:0 6px; color:#9aa0a6; }
.after-tabs{ margin-top:20px; }
.section{ margin-top:16px; }
.section__header{ font-weight:700; font-size:14px; color:#2b2f36; margin-bottom:10px; letter-spacing:0.02em; }
.section__grid{ display:grid; column-gap:16px; row-gap:16px; }
.section__grid.two-cols{ grid-template-columns: repeat(2, minmax(160px,1fr)); }
.detail-grid{ display:grid; grid-template-columns: repeat(4, minmax(160px,1fr)); column-gap:16px; row-gap:16px; padding-top:6px; }
.mt-3{ margin-top:16px; }
.mb-1{ margin-bottom:8px; }
.class-grid{ display:flex; flex-direction:column; gap:5px; align-items:flex-start; }
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
</style>


