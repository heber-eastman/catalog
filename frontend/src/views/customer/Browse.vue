<template>
  <div class="browse" data-cy="browse">
    <div class="controls">
      <input type="date" v-model="date" />
      <input placeholder="Sheet IDs (comma)" v-model="teeSheetsRaw" />
      <input placeholder="Side IDs (comma)" v-model="sidesRaw" />
      <select v-model="walkRide">
        <option value="">Any</option>
        <option value="ride">Ride</option>
        <option value="walk">Walk</option>
      </select>
      <input type="number" min="1" max="4" v-model.number="groupSize" placeholder="Group Size (any)" />
      <label style="display:flex;align-items:center;gap:6px">
        <input type="checkbox" v-model="staffView" data-cy="staff-view-toggle" /> Staff view
      </label>
      <label style="display:flex;align-items:center;gap:6px">
        <input type="checkbox" v-model="compareCustomer" data-cy="compare-toggle" /> Compare customer
      </label>
      <button @click="load" data-cy="search-button">Search</button>
    </div>

    <div class="results">
      <div class="summary" v-if="compareCustomer">
        Staff: {{ slots.length }} | Customer: {{ customerSlots.length }} | Staff-only: {{ Math.max(slots.length - customerSlots.length, 0) }}
      </div>
      <div v-for="slot in slots" :key="slot.id" class="slot" :data-id="slot.id">
        <div>
          {{ new Date(slot.start_time).toLocaleTimeString() }}
          | Rem: {{ slot.remaining }}
          | ${{ (slot.price_total_cents/100).toFixed(2) }}
          <span v-if="slot.price_breakdown" class="muted">
            (greens ${{ (slot.price_breakdown.greens_fee_cents/100).toFixed(2) }}
            <template v-if="slot.price_breakdown.cart_fee_cents">+ cart ${{ (slot.price_breakdown.cart_fee_cents/100).toFixed(2) }}</template>)
          </span>
          <span v-if="slot.is_start_disabled" class="start-disabled" aria-label="Start disabled">[start disabled]</span>
        </div>
        <button :disabled="slot.remaining < groupSize" @click="addToCart(slot)" data-cy="add-to-cart">Add</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { teeTimesAPI, holdsAPI, bookingAPI } from '@/services/api';

const route = useRoute();

const date = ref(new Date().toISOString().substring(0,10));
const teeSheetsRaw = ref(localStorage.getItem('cust:browse:sheets') || '');
const sidesRaw = ref(localStorage.getItem('cust:browse:sides') || '');
const walkRide = ref(''); // empty means no filter
const groupSize = ref(null); // null means no filter
const classId = ref('Full');
const staffView = ref(false);
const compareCustomer = ref(false);
const slots = ref([]);
const customerSlots = ref([]);

function parseComma(raw) {
  return (raw || '').split(',').map(s => s.trim()).filter(Boolean);
}
function parseSheets() { return parseComma(teeSheetsRaw.value); }
function parseSides() { return parseComma(sidesRaw.value); }

async function load() {
  const sheets = parseSheets();
  if (!sheets.length) { slots.value = []; customerSlots.value = []; return; }
  localStorage.setItem('cust:browse:sheets', teeSheetsRaw.value);
  localStorage.setItem('cust:browse:sides', sidesRaw.value);
  const sides = parseSides();
  const base = {
    date: date.value,
    teeSheets: sheets,
    classId: classId.value,
    customerView: !staffView.value,
  };
  if (typeof groupSize.value === 'number' && groupSize.value >= 1) base.groupSize = groupSize.value;
  if (walkRide.value === 'walk' || walkRide.value === 'ride') base.walkRide = walkRide.value;
  if (sides.length) base['sides[]'] = sides;
  const { data } = await teeTimesAPI.available(base);
  slots.value = data;
  if (compareCustomer.value && staffView.value === true){
    const custParams = { ...base, customerView: true };
    const { data: cdata } = await teeTimesAPI.available(custParams);
    customerSlots.value = cdata;
  } else {
    customerSlots.value = [];
  }
}

async function addToCart(slot) {
  const { data } = await holdsAPI.holdCart({
    items: [{ tee_time_id: slot.id, party_size: groupSize.value }],
    source: 'checkout',
  });
  try { localStorage.setItem('hold:payload', JSON.stringify(data.hold)); } catch {}
  window.location.href = '/cart';
}

async function initFromRoute() {
  try {
    // Support deep links: /booking, /booking/:courseSlug, and query params
    const slug = route.params?.courseSlug || route.query?.course || route.query?.courseSlug;
    if (slug) {
      localStorage.setItem('cust:courseSlug', String(slug));
    }
    if (route.query?.date && /\d{4}-\d{2}-\d{2}/.test(String(route.query.date))) {
      date.value = String(route.query.date);
    }
    if (route.query?.groupSize) {
      const n = Number(route.query.groupSize);
      if (!Number.isNaN(n) && n >= 1 && n <= 4) groupSize.value = n;
    }
    if (route.query?.walkRide && (route.query.walkRide === 'walk' || route.query.walkRide === 'ride')) {
      walkRide.value = String(route.query.walkRide);
    }
    if (route.query?.teeSheets) {
      teeSheetsRaw.value = String(route.query.teeSheets);
    }
    if (route.query?.sides) {
      sidesRaw.value = String(route.query.sides);
    }

    // If we have a course slug but no teeSheets specified, auto-load sheets for that course
    if (slug && !teeSheetsRaw.value) {
      try {
        const { data } = await bookingAPI.listCourseTeeSheetsBySlug(String(slug));
        const ids = Array.isArray(data) ? data.map(s => s.id) : [];
        if (ids.length) {
          teeSheetsRaw.value = ids.join(',');
          localStorage.setItem('cust:browse:sheets', teeSheetsRaw.value);
          localStorage.setItem('cust:lastSheet', ids[0]);
        }
      } catch (_) {}
    }
  } catch {}
}

onMounted(async () => {
  await initFromRoute();
  await load();
});
</script>

<style scoped>
.controls { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.results { display: grid; gap: 8px; }
.slot { border: 1px solid #ddd; padding: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
.muted { color: #777; margin-left: 6px; font-size: 12px; }
.summary { color: #555; font-size: 13px; margin-bottom: 6px; }
.start-disabled { color: #b26a00; margin-left: 6px; font-size: 12px; }
</style>


