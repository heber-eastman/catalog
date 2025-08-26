<template>
  <div>
    <h2>Timeframes</h2>
    <form @submit.prevent="save">
      <label>Start (HH:MM)
        <input v-model="start" placeholder="07:00" />
      </label>
      <label>End (HH:MM)
        <input v-model="end" placeholder="10:00" />
      </label>
      <label>Interval (mins)
        <input type="number" v-model.number="interval" min="10" step="5" />
      </label>
      <div class="errors" v-if="error">{{ error }}</div>
      <button :disabled="!!error">Save</button>
      <button type="button" @click="previewGenerate" :disabled="!cleanDate">Preview Generate</button>
      <div class="hint">Clean date: <strong>{{ cleanDate || 'n/a' }}</strong></div>
    </form>

    <h3>Preview Daytime Bands</h3>
    <ul>
      <li v-for="t in bands" :key="t">{{ t }}</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { settingsAPI } from '@/services/api';

const existing = ref([
  { start: '07:00', end: '08:00' },
  { start: '09:00', end: '11:00' },
]);
const start = ref('08:00');
const end = ref('09:00');
const interval = ref(60);
const error = ref('');
const cleanDate = ref('');

function toMin(hhmm){ const [h,m] = hhmm.split(':').map(Number); return h*60+m; }
function fmt(min){ const h = Math.floor(min/60).toString().padStart(2,'0'); const m = (min%60).toString().padStart(2,'0'); return `${h}:${m}`; }

function validate(){
  error.value = '';
  if(!/^\d{2}:\d{2}$/.test(start.value) || !/^\d{2}:\d{2}$/.test(end.value)) { error.value = 'Invalid time format'; return; }
  const s = toMin(start.value), e = toMin(end.value);
  if(e <= s) { error.value = 'End must be after start'; return; }
  for(const tf of existing.value){
    const es = toMin(tf.start), ee = toMin(tf.end);
    const overlap = Math.max(s, es) < Math.min(e, ee);
    if(overlap) { error.value = 'Overlaps existing timeframe'; return; }
  }
}

watch([start, end], validate, { immediate: true });

const bands = computed(() => {
  const out = [];
  const s = toMin(start.value), e = toMin(end.value);
  for(let t=s; t<e; t+= interval.value){ out.push(`${fmt(t)} - ${fmt(Math.min(e, t+interval.value))}`); }
  return out;
});

function save(){ if(!error.value){ alert('Saved (stub)'); } }

async function previewGenerate(){
  // Check clean date from backend, then trigger generate preview
  try {
    const { data } = await settingsAPI.checkClean({ date: new Date().toISOString().substring(0,10) });
    cleanDate.value = data?.clean ? data.date : '';
    if(!cleanDate.value){ alert('Date not clean for generation'); return; }
    await settingsAPI.generateDay({ date: cleanDate.value, tee_sheet_id: 'stub' });
    alert('Generated preview (stub)');
  } catch { alert('Preview failed'); }
}
</script>

<style scoped>
form { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 640px; }
.errors { color: #c00; grid-column: 1 / -1; }
ul { margin-top: 8px; }
</style>


