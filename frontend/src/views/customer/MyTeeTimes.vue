<template>
  <div class="my-tee-times" data-cy="my-tee-times">
    <div class="header">
      <h2>My Tee Times</h2>
      <button @click="reload" data-cy="refresh">Refresh</button>
    </div>
    <div v-if="!list.length" class="empty">No upcoming bookings.</div>
    <div v-else class="list">
      <div v-for="b in list" :key="b.id" class="booking">
        <div>Booking #{{ b.id }} • ${{ (b.total_price_cents/100).toFixed(2) }}</div>
        <div class="legs">
          <div v-for="leg in b.legs" :key="leg.leg_index">
            Leg {{ leg.leg_index+1 }}: {{ leg.tee_time ? new Date(leg.tee_time.start_time).toLocaleString() : 'TBD' }}
          </div>
        </div>
        <div class="actions">
          <button @click="startReschedule(b)" data-cy="reschedule">Reschedule</button>
          <button @click="cancel(b)" data-cy="cancel">Cancel</button>
        </div>
      </div>
    </div>

    <div v-if="showReschedule" class="reschedule">
      <h3>Reschedule Booking #{{ current?.id }}</h3>
      <input type="text" placeholder="New tee_time_id" v-model="newTeeTimeId" />
      <button @click="applyReschedule" data-cy="apply-reschedule">Apply</button>
      <button @click="showReschedule=false">Close</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { bookingsAPI } from '@/services/api';

const list = ref([]);
const showReschedule = ref(false);
const current = ref(null);
const newTeeTimeId = ref('');

async function reload() {
  const { data } = await bookingsAPI.mine();
  list.value = data;
}

function startReschedule(b) {
  current.value = b;
  newTeeTimeId.value = '';
  showReschedule.value = true;
}

async function applyReschedule() {
  if (!current.value || !newTeeTimeId.value) return;
  await bookingsAPI.reschedule(current.value.id, {
    classId: 'Full',
    legs: [{ leg_index: 0, tee_time_id: newTeeTimeId.value }],
  });
  showReschedule.value = false;
  await reload();
}

async function cancel(b) {
  await bookingsAPI.cancel(b.id);
  await reload();
}

onMounted(reload);
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; }
.list { display: grid; gap: 12px; margin-top: 12px; }
.booking { border: 1px solid #ddd; padding: 12px; border-radius: 6px; }
.legs { margin-top: 6px; color: #555; }
.actions { margin-top: 8px; display: flex; gap: 8px; }
.reschedule { margin-top: 16px; padding: 12px; border: 1px dashed #aaa; }
.empty { color: #666; margin-top: 12px; }
</style>


