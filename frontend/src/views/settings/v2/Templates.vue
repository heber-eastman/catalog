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
          <div class="tpl-card__title">Template • {{ shortId(t.id) }}</div>
          <v-menu location="bottom end">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-dots-vertical" variant="text" density="comfortable" @click.stop></v-btn>
            </template>
            <v-list density="compact">
              <v-list-item :data-cy="`template-menu-delete-${shortId(t.id)}`" @click.stop="remove(t)">
                <v-list-item-title>Delete</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
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

    <v-dialog v-model="detailOpen" max-width="720">
      <v-card>
        <v-card-title class="text-subtitle-1">Template Details</v-card-title>
        <v-card-text>
          <div class="detail-grid">
            <v-text-field :model-value="selected?.id || ''" label="ID" variant="outlined" density="comfortable" hide-details readonly />
            <v-text-field :model-value="selected ? (selected.archived ? 'Archived' : 'Active') : ''" label="Status" variant="outlined" density="comfortable" hide-details readonly />
            <v-text-field :model-value="selected?.interval_mins || ''" label="Interval (mins)" variant="outlined" density="comfortable" hide-details readonly />
          </div>
          <div class="mt-3" v-if="selected?.versions?.length">
            <div class="muted mb-1">Versions</div>
            <div class="ver-list">
              <div v-for="v in selected.versions" :key="v.id" class="ver-row">
                <div>v{{ v.version_number }} <span v-if="selected.published_version && selected.published_version.id === v.id" class="published">(published)</span></div>
                <div class="muted">{{ v.notes || '' }}</div>
              </div>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen=false">Close</v-btn>
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
function openDetail(t){ selected.value = t; detailOpen.value = true; }

onMounted(load);
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.title{ font-weight:800; font-size:28px; }
.create-btn{ color:#5EE3BB; font-weight:600; letter-spacing:0.04em; }
.muted{ color:#6b778c; }
.cards{ display:flex; flex-direction:column; gap:12px; }
.tpl-card{ padding:10px 12px; cursor:pointer; width:100%; }
.tpl-card__header{ display:flex; align-items:center; justify-content:space-between; }
.tpl-card__title{ font-weight:700; font-size:18px; }
.tpl-card__row{ color:#6b778c; margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ver{ background:#f1f5f9; border-radius:12px; padding:2px 8px; font-size:12px; }
.published{ color:#2e7d32; font-weight:600; }
.pill{ background:#eef7ff; border-radius:10px; padding:2px 8px; font-size:12px; }
.pill.archived{ background:#fdecea; color:#b71c1c; }
.sep{ margin:0 6px; color:#9aa0a6; }
.detail-grid{ display:grid; grid-template-columns: repeat(3, minmax(180px,1fr)); gap:12px; }
.mt-3{ margin-top:12px; }
.mb-1{ margin-bottom:6px; }
.ver-list{ display:flex; flex-direction:column; gap:8px; }
.ver-row{ padding:6px 8px; border:1px solid #eee; border-radius:6px; }
</style>


