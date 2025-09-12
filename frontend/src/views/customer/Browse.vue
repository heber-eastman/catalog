<template>
  <div class="browse" data-cy="browse">
    <div class="controls">
      <input type="date" v-model="date" />
      <input placeholder="Sheet IDs (comma)" v-model="teeSheetsRaw" />
      <input placeholder="Side IDs (comma)" v-model="sidesRaw" />
      <select v-model="walkRide">
        <option value="ride">Ride</option>
        <option value="walk">Walk</option>
      </select>
      <input type="number" min="1" max="4" v-model.number="groupSize" />
      <button @click="load" data-cy="search-button">Search</button>
    </div>

    <div class="results">
      <div v-for="slot in slots" :key="slot.id" class="slot" :data-id="slot.id">
        <div>
          {{ new Date(slot.start_time).toLocaleTimeString() }}
          | Rem: {{ slot.remaining }}
          | ${{ (slot.price_total_cents/100).toFixed(2) }}
          <span v-if="slot.price_breakdown" class="muted">
            (greens ${{ (slot.price_breakdown.greens_fee_cents/100).toFixed(2) }}
            <template v-if="slot.price_breakdown.cart_fee_cents">+ cart ${{ (slot.price_breakdown.cart_fee_cents/100).toFixed(2) }}</template>)
          </span>
        </div>
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
const sidesRaw = ref(localStorage.getItem('cust:browse:sides') || '');
const walkRide = ref('ride');
const groupSize = ref(2);
const classId = ref('Full');
const slots = ref([]);

function parseComma(raw) {
  return (raw || '').split(',').map(s => s.trim()).filter(Boolean);
}
function parseSheets() { return parseComma(teeSheetsRaw.value); }
function parseSides() { return parseComma(sidesRaw.value); }

async function load() {
  const sheets = parseSheets();
  if (!sheets.length) { slots.value = []; return; }
  localStorage.setItem('cust:browse:sheets', teeSheetsRaw.value);
  localStorage.setItem('cust:browse:sides', sidesRaw.value);
  const sides = parseSides();
  const params = {
    date: date.value,
    teeSheets: sheets,
    groupSize: groupSize.value,
    walkRide: walkRide.value,
    classId: classId.value,
    customerView: true,
  };
  if (sides.length) params['sides[]'] = sides;
  const { data } = await teeTimesAPI.available(params);
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
.muted { color: #777; margin-left: 6px; font-size: 12px; }
</style>


