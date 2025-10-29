<template>
  <div class="cart" data-cy="cart">
    <div class="header">
      <div>Cart Hold: <strong>{{ remainingDisplay }}</strong></div>
      <button @click="goBrowse" data-cy="back-to-browse">Continue Browsing</button>
    </div>

    <div v-if="!hold" class="empty">No active hold.</div>
    <div v-else class="items">
      <div v-for="it in hold.items" :key="it.tee_time_id" class="item">
        <div>Slot: {{ it.tee_time_id }}</div>
        <div>Party: {{ it.party_size }}</div>
        <div>
          Walk/Ride:
          <select v-model="perPlayer[it.tee_time_id]">
            <option value="ride">Ride</option>
            <option value="walk">Walk</option>
          </select>
        </div>
      </div>
    </div>

    <div class="actions">
      <button :disabled="!hold" @click="checkout" data-cy="checkout">Checkout</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { bookingsAPI } from '@/services/api';

const hold = ref(null);
const perPlayer = ref({});
const timer = ref(null);
const remaining = ref(0);

function tick() {
  if (!hold.value) { remaining.value = 0; return; }
  const elapsed = Math.floor((Date.now() - hold.value.created_at) / 1000);
  const total = 300;
  remaining.value = Math.max(0, total - elapsed);
}

const remainingDisplay = computed(() => {
  const m = Math.floor(remaining.value / 60);
  const s = String(remaining.value % 60).padStart(2, '0');
  return `${m}:${s}`;
});

function loadHold() {
  try {
    const raw = localStorage.getItem('hold:payload');
    if (raw) hold.value = JSON.parse(raw);
  } catch {}
  tick();
  if (timer.value) clearInterval(timer.value);
  timer.value = setInterval(tick, 1000);
}

function goBrowse() { window.location.href = '/browse'; }

async function checkout() {
  if (!hold.value) return;
  // Simplified single-leg support: use first item
  const item = hold.value.items[0];
  const walkRide = perPlayer.value[item.tee_time_id] || 'ride';
  const body = {
    tee_sheet_id: localStorage.getItem('cust:lastSheet') || hold.value.items[0].tee_time_id, // placeholder sheet
    classId: 'Full',
    players: Array.from({ length: item.party_size }).map(() => ({ email: '', walkRide })),
    legs: [{ tee_time_id: item.tee_time_id, leg_index: 0 }],
  };
  await bookingsAPI.create(body);
  window.location.href = '/my-tee-times';
}

onMounted(loadHold);
onBeforeUnmount(() => { if (timer.value) clearInterval(timer.value); });
</script>

<style scoped>
.header { display: flex; justify-content: space-between; margin-bottom: 12px; }
.items { display: grid; gap: 8px; }
.item { border: 1px solid #ddd; padding: 8px; border-radius: 6px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.actions { margin-top: 12px; }
.empty { color: #666; }
</style>


