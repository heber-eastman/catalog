<template>
  <div class="browse" data-cy="browse">
    <div class="controls">
      <input type="date" v-model="date" />
      <input placeholder="Sheet IDs (comma)" v-model="teeSheetsRaw" />
      <select v-model="walkRide">
        <option value="ride">Ride</option>
        <option value="walk">Walk</option>
      </select>
      <input type="number" min="1" max="4" v-model.number="groupSize" />
      <button @click="load" data-cy="search-button">Search</button>
    </div>

    <div class="results">
      <div v-for="slot in slots" :key="slot.id" class="slot" :data-id="slot.id">
        <div>{{ new Date(slot.start_time).toLocaleTimeString() }} | Rem: {{ slot.remaining }} | ${{ (slot.price_total_cents/100).toFixed(2) }}</div>
        <button :disabled="slot.remaining < groupSize" @click="addToCart(slot)" data-cy="add-to-cart">Add</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { teeTimesAPI, holdsAPI } from '@/services/api';

const date = ref(new Date().toISOString().substring(0,10));
const teeSheetsRaw = ref(localStorage.getItem('cust:browse:sheets') || '');
const walkRide = ref('ride');
const groupSize = ref(2);
const classId = ref('Full');
const slots = ref([]);

function parseSheets() {
  return teeSheetsRaw.value.split(',').map(s => s.trim()).filter(Boolean);
}

async function load() {
  const sheets = parseSheets();
  if (!sheets.length) { slots.value = []; return; }
  localStorage.setItem('cust:browse:sheets', teeSheetsRaw.value);
  const { data } = await teeTimesAPI.available({
    date: date.value,
    teeSheets: sheets,
    groupSize: groupSize.value,
    walkRide: walkRide.value,
    classId: classId.value,
    customerView: true,
  });
  slots.value = data;
}

async function addToCart(slot) {
  const { data } = await holdsAPI.holdCart({
    items: [{ tee_time_id: slot.id, party_size: groupSize.value }],
    source: 'checkout',
  });
  try { localStorage.setItem('hold:payload', JSON.stringify(data.hold)); } catch {}
  // Navigate to cart
  window.location.href = '/cart';
}

onMounted(load);
</script>

<style scoped>
.controls { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.results { display: grid; gap: 8px; }
.slot { border: 1px solid #ddd; padding: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
</style>


