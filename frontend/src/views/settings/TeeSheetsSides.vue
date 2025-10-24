<template>
  <div>
    <div class="sides-toolbar">
      <h2>Sides</h2>
      <v-btn variant="text" density="comfortable" class="add-side-btn" prepend-icon="mdi-plus" @click="openCreate=true">ADD A SIDE</v-btn>
    </div>

    <div class="sides-list">
      <v-card
        v-for="sd in sides"
        :key="sd.id"
        variant="outlined"
        class="side-card"
      >
        <div class="side-card__header">
          <div class="side-card__title">{{ sd.name }}</div>
          <div class="side-card__actions">
            <v-btn size="small" variant="tonal" @click="save(sd)">SAVE</v-btn>
            <v-btn icon="mdi-dots-vertical" variant="text" density="compact" />
          </div>
        </div>
        <div class="side-card__body">
          <v-text-field
            v-model="edits[sd.id].name"
            label="Name"
            variant="outlined"
            density="comfortable"
            hide-details
            class="field"
          />
          <v-text-field
            v-model="edits[sd.id].holes"
            label="Number of Holes"
            variant="outlined"
            density="comfortable"
            hide-details
            class="field"
          />
        </div>
      </v-card>
    </div>

    <v-dialog v-model="openCreate" max-width="420">
      <v-card>
        <v-card-title class="text-subtitle-1">Add Side</v-card-title>
        <v-card-text>
          <v-text-field v-model="sideName" label="Side name" autofocus variant="outlined" />
          <v-text-field v-model="validFrom" type="date" label="Valid from" variant="outlined" />
          <v-text-field
            v-model.number="holeCount"
            type="number"
            min="1"
            step="1"
            label="Number of Holes"
            variant="outlined"
            :rules="[v => Number(v) >= 1 || 'Enter a positive number']"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="openCreate=false">Cancel</v-btn>
          <v-btn :disabled="!sideName || !validFrom || Number(holeCount) < 1" @click="createSide">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>

</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const sides = ref([]);
const sideName = ref('Main');
const validFrom = ref(new Date().toISOString().substring(0,10));
const holeCount = ref(9);
const route = useRoute();
const teeSheetId = ref(route.params.teeSheetId);
const openCreate = ref(false);
const edits = ref({});

async function loadSides(){
  if (!teeSheetId.value) { sides.value = []; return; }
  const { data } = await settingsAPI.listSides(teeSheetId.value);
  sides.value = data || [];
  // initialize edit models
  const next = {};
  for (const s of sides.value){ next[s.id] = { name: s.name, holes: s.hole_count ?? 9 }; }
  edits.value = next;
}

async function createSide(){
  if (!teeSheetId.value) return;
  await settingsAPI.createSide(teeSheetId.value, { name: sideName.value, valid_from: validFrom.value, hole_count: holeCount.value });
  sideName.value = '';
  openCreate.value = false;
  holeCount.value = 9;
  await loadSides();
}

onMounted(loadSides);
watch(() => route.params.teeSheetId, (n) => { teeSheetId.value = n; loadSides(); });

async function save(sd){
  const model = edits.value[sd.id] || {};
  const payload = {};
  if (model.name && model.name !== sd.name) payload.name = model.name;
  if (model.holes && model.holes !== sd.hole_count) payload.hole_count = Number(model.holes);
  if (Object.keys(payload).length === 0) return;
  await settingsAPI.updateSide(teeSheetId.value, sd.id, payload);
  await loadSides();
}
</script>

<style scoped>
.sides-toolbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.add-side-btn{ color:#5EE3BB; font-weight:600; letter-spacing:0.04em; }
.sides-list{ display:flex; flex-direction:column; gap:16px; }
.side-card{ padding:8px 12px; border:1px solid #e5e7eb !important; border-radius:8px; }
.side-card__header{ display:flex; align-items:center; justify-content:space-between; padding:16px 8px 8px; }
.side-card__title{ font-weight:800; font-size:24px; color:#333333; }
.side-card__actions{ display:flex; align-items:center; gap:8px; }
.side-card__body{ display:grid; grid-template-columns: repeat(2, minmax(220px, 280px)); gap:16px; padding:8px; }
.field :deep(.v-field){ border-radius:6px; }
</style>


