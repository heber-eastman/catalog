<template>
  <div class="tee-sheet">
    <header class="controls">
      <h2>Tee Sheet</h2>
      <div class="control-row">
        <input type="date" v-model="date" @change="load" />
        <select v-model="viewMode" @change="savePrefs">
          <option value="single">Single</option>
          <option value="split">Split</option>
        </select>
      </div>
    </header>
    <div class="grid" v-if="slots.length">
      <div class="row header">
        <div class="cell time">Time</div>
        <div class="cell" v-for="n in seatCols" :key="n">Seat {{ n }}</div>
      </div>
      <div class="row" v-for="slot in slots" :key="slot.start_time" :data-start="slot.start_time"
           @dragover.prevent="onDragOver($event)" @drop="onDrop($event, slot)">
        <div class="cell time" draggable="true"
             @dragstart="onRowDragStart($event, slot)">
          {{ formatTime(slot.start_time) }}
        </div>
        <div class="cell seat" v-for="n in seatCols" :key="n">
          <button v-if="n <= occupiedCount(slot)" class="chip active" @click="openDrawer(slot)"
                  draggable="true" @dragstart="onChipDragStart($event, slot, n)"><span class="dot"></span>Active</button>
          <button v-else class="add" @click="openAdd(slot)" @dragover.prevent @drop.prevent="onEmptySeatDrop(slot, n)">+ Add</button>
        </div>
      </div>
    </div>
    <div v-else class="empty">No slots</div>
    <div class="toast" v-if="toast.msg">{{ toast.msg }}</div>
    <div class="drawer" v-if="drawerOpen">
      <div class="drawer-header">
        <div>
          <strong>{{ selectedSlot ? formatTime(selectedSlot.start_time) : '' }}</strong>
          <small v-if="selectedSlot"> · Capacity {{ selectedSlot.capacity }} · Remaining {{ selectedSlot.remaining }}</small>
        </div>
        <button class="close" @click="drawerOpen = false">✕</button>
      </div>
      <div class="tabs">
        <button v-for="t in tabs" :key="t" :class="['tab', { active: activeTab === t }]" @click="activeTab = t">{{ t }}</button>
      </div>
      <div class="panel">
        <div v-if="activeTab === 'Players'">
          <p>Players editor coming soon.</p>
          <button class="primary" @click="openAdd(selectedSlot)">+ Add player</button>
        </div>
        <div v-else-if="activeTab === 'Reround'">
          <p>Reround details coming soon.</p>
        </div>
        <div v-else-if="activeTab === 'Notes'">
          <textarea rows="4" placeholder="Add a note..."></textarea>
        </div>
        <div v-else-if="activeTab === 'Pricing'">
          <p>Pricing summary coming soon.</p>
        </div>
        <div v-else-if="activeTab === 'History'">
          <p>Event history will appear here.</p>
        </div>
        <div v-else-if="activeTab === 'Actions'">
          <button class="danger" @click="cancelBooking">Cancel booking</button>
          <button @click="rescheduleBooking">Reschedule</button>
          <button @click="transferOwner">Transfer Owner</button>
          <hr />
          <div class="block-row">
            <button @click="blockSlot" v-if="selectedSlot && !selectedSlot.is_blocked">Block slot</button>
            <button @click="undoBlock" v-if="canUndoBlock">Undo block</button>
            <div class="reason">
              <input v-model="blockReason" placeholder="Reason (optional)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { api } from '@/services/api';

const date = ref(new Date().toISOString().substring(0,10));
const viewMode = ref(localStorage.getItem('teeSheet:viewMode') || 'single');
const seatCols = 4;
const slots = ref([]);
const drawerOpen = ref(false);
const selectedSlot = ref(null);
const tabs = ['Players', 'Reround', 'Notes', 'Pricing', 'History', 'Actions'];
const activeTab = ref('Players');
const drag = ref({ type: null, fromTime: null, fromSeat: null });
const toast = ref({ msg: '', t: null });
const blockReason = ref('');
const lastUndo = ref({ token: '', id: '' });

function savePrefs() {
  localStorage.setItem('teeSheet:viewMode', viewMode.value);
}

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
}

async function load() {
  // Staff view: fetch availability for selected sheet(s); for now assume one from user prefs
  const teeSheetId = localStorage.getItem('teeSheet:lastSheet');
  if (!teeSheetId) { slots.value = []; return; }
  const params = new URLSearchParams({ date: date.value, teeSheets: teeSheetId, customerView: 'false', classId: 'Full', groupSize: '1' });
  const res = await api.get(`/api/v1/tee-times/available?${params.toString()}`);
  slots.value = res.data || [];
}

function openAdd(slot) {
  // Placeholder for inline +Add booking flow
  // In full implementation, open drawer form
  console.log('Open add booking for', slot);
}

function occupiedCount(slot) {
  const remaining = Number(slot.remaining ?? 0);
  const capacity = Number(slot.capacity ?? 0);
  const used = capacity - remaining;
  return used > 0 ? used : 0;
}

function openDrawer(slot) {
  selectedSlot.value = slot;
  activeTab.value = 'Players';
  drawerOpen.value = true;
}

function onChipDragStart(e, slot, seat) {
  drag.value = { type: 'chip', fromTime: slot.start_time, fromSeat: seat };
  e.dataTransfer?.setData('text/plain', JSON.stringify(drag.value));
}

function onRowDragStart(e, slot) {
  drag.value = { type: 'row', fromTime: slot.start_time };
  e.dataTransfer?.setData('text/plain', JSON.stringify(drag.value));
}

function onDragOver(e) {
  e.preventDefault();
}

function onDrop(e, targetSlot) {
  let data;
  try { data = JSON.parse(e.dataTransfer?.getData('text/plain') || '{}'); } catch { data = drag.value; }
  if (!data || !data.type) return;
  if (data.type === 'row') {
    // Row-level move: move both legs together in future implementation
    showToast(`Row moved to ${formatTime(targetSlot.start_time)}`);
    return;
  }
  // If chip drop onto a row (not empty seat), treat as move to first empty
  for (let seat = 1; seat <= seatCols; seat++) {
    if (seat > occupiedCount(targetSlot)) {
      onEmptySeatDrop(targetSlot, seat);
      break;
    }
  }
}

function onEmptySeatDrop(targetSlot, seat) {
  if (!drag.value || drag.value.type !== 'chip') return;
  const from = drag.value;
  showToast(`Moved from ${formatTime(from.fromTime)} seat ${from.fromSeat} → ${formatTime(targetSlot.start_time)} seat ${seat}`);
  // Optimistic UI: adjust remaining counts
  const fromIdx = slots.value.findIndex(s => s.start_time === from.fromTime);
  const toIdx = slots.value.findIndex(s => s.start_time === targetSlot.start_time);
  if (fromIdx !== -1 && toIdx !== -1) {
    const fromSlot = { ...slots.value[fromIdx] };
    const toSlot = { ...slots.value[toIdx] };
    if (fromSlot.remaining < fromSlot.capacity) fromSlot.remaining += 1;
    if (toSlot.remaining > 0) toSlot.remaining -= 1;
    slots.value.splice(fromIdx, 1, fromSlot);
    slots.value.splice(toIdx, 1, toSlot);
  }
}

function showToast(msg) {
  toast.value.msg = msg;
  if (toast.value.t) clearTimeout(toast.value.t);
  toast.value.t = setTimeout(() => { toast.value.msg = ''; toast.value.t = null; }, 2500);
}

const canUndoBlock = computed(() => !!lastUndo.value.token && !!lastUndo.value.id);

async function blockSlot() {
  if (!selectedSlot.value || !selectedSlot.value.id) return;
  try {
    const res = await api.post(`/api/v1/tee-times/${selectedSlot.value.id}/block`, { reason: blockReason.value || undefined });
    lastUndo.value = { token: res.data.undo_token, id: selectedSlot.value.id };
    showToast('Slot blocked. Undo available for 5s.');
    await load();
  } catch (e) {
    showToast('Failed to block');
  }
}

async function undoBlock() {
  if (!lastUndo.value.token || !lastUndo.value.id) return;
  try {
    await api.post(`/api/v1/tee-times/${lastUndo.value.id}/unblock`, { undo_token: lastUndo.value.token });
    lastUndo.value = { token: '', id: '' };
    showToast('Block undone');
    await load();
  } catch (e) {
    showToast('Undo expired');
  }
}

function cancelBooking() { showToast('Cancel flow TBD'); }
function rescheduleBooking() { showToast('Reschedule flow TBD'); }
function transferOwner() { showToast('Transfer owner TBD'); }

onMounted(load);
onMounted(() => {
  // Subscribe to SSE stream for live updates
  if (import.meta.env && import.meta.env.VITE_ENABLE_EVENTS_STREAM === 'true') {
    try {
      const ev = new EventSource('/internal/stream');
      ev.onmessage = (m) => {
        try {
          const evt = JSON.parse(m.data || '{}');
          if (evt && evt.type === 'tee_time_updated') {
            showToast('Live update received');
            load();
          }
        } catch {}
      };
      // Store to cleanup
      window.__teeStream = ev;
    } catch {}
  }
});
onBeforeUnmount(() => {
  if (window.__teeStream) {
    try { window.__teeStream.close(); } catch {}
    window.__teeStream = null;
  }
});
</script>

<style scoped>
.tee-sheet { padding: 16px; }
.controls { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.grid { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
.row { display: grid; grid-template-columns: 120px repeat(4, 1fr); border-top: 1px solid #eee; }
.row.header { background: #fafafa; font-weight: 600; }
.cell { padding: 8px; border-left: 1px solid #eee; }
.cell.time { border-left: none; white-space: nowrap; }
.cell.seat { min-height: 36px; display: flex; align-items: center; }
.add { font-size: 12px; padding: 4px 8px; }
.chip { font-size: 12px; padding: 4px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; }
.chip .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: currentColor; }
.chip.active { background: #e8f8ef; color: #1a7f37; border-color: #bde5cd; }
.toast { position: fixed; bottom: 16px; right: 16px; background: rgba(0,0,0,0.8); color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 13px; }
.drawer { position: fixed; top: 0; right: 0; width: 360px; height: 100vh; background: #fff; box-shadow: -2px 0 8px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
.drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #eee; }
.close { background: transparent; border: none; font-size: 18px; cursor: pointer; }
.tabs { display: flex; gap: 6px; padding: 8px 8px 0; border-bottom: 1px solid #eee; }
.tab { padding: 6px 10px; border: none; background: transparent; cursor: pointer; border-bottom: 2px solid transparent; }
.tab.active { border-color: #42b883; color: #2c3e50; font-weight: 600; }
.panel { padding: 12px 16px; overflow: auto; }
.primary { background: #42b883; border: none; color: #fff; padding: 6px 10px; border-radius: 4px; cursor: pointer; }
.danger { background: #e53935; border: none; color: #fff; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 6px; }
.empty { color: #999; padding: 24px; text-align: center; }
</style>


