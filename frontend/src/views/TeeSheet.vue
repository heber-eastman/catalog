<template>
  <div class="tee-sheet">
    <header class="controls">
      <div class="date-controls">
        <button class="link" :title="todayTooltip" @click="goToday">
          <span v-if="!isToday" class="arrow">←</span> Today
        </button>
        <button class="icon" @click="shiftDay(-1)" aria-label="Previous day">◀</button>
        <button class="icon" @click="shiftDay(1)" aria-label="Next day">▶</button>
        <button class="date-display" @click="openDatePicker">
          {{ formattedDate }} <span class="caret">▾</span>
        </button>
        <input ref="datePicker" type="date" v-model="date" @change="onDatePicked" class="hidden-date" />
      </div>
      <div class="control-row" style="display:flex; gap:8px; align-items:center;">
        <select v-model="viewMode" @change="onViewModeChange">
          <option value="split">Split view</option>
          <option v-for="s in sides" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <button class="primary" @click="goSettings" data-cy="goto-settings">Settings</button>
      </div>
    </header>
    <div v-if="!isSplit && slotsFiltered.length" class="grid">
      <div class="row header">
        <div class="cell time">Time</div>
        <div class="cell" v-for="n in seatCols" :key="n">Seat {{ n }}</div>
      </div>
      <div class="row" v-for="slot in slotsFiltered" :key="slot.side_id + '-' + slot.start_time" :data-start="slot.start_time"
           @dragover.prevent="onDragOver($event)" @drop="onDrop($event, slot)">
        <div class="cell time" draggable="true" @dragstart="onRowDragStart($event, slot)">{{ formatSlotTime(slot) }}</div>
        <!-- booking-spanning chips -->
        <button
          v-for="seg in bookingSegments(slot)"
          :key="seg.key"
          :class="['booking-chip', seg.statusClass]"
          :style="{ gridColumn: (2 + seg.startSeat) + ' / span ' + seg.length }"
          @click="openDrawer(slot)"
          draggable="true"
          @dragstart="onRowDragStart($event, slot)"
        >
          <span class="names" :style="{ gridTemplateColumns: 'repeat(' + seg.length + ', 1fr)' }">
            <span v-for="(nm, idx) in seg.names" :key="idx" class="nm" :class="{ strong: nm && nm !== 'Guest' }">{{ nm }}</span>
          </span>
          <span class="info">
            <span class="meta holes" :title="seg.holes + ' holes'">{{ seg.holes }}</span>
            <span class="meta icon" :title="seg.walkRide==='ride' ? 'Riding' : 'Walking'">{{ seg.walkRide === 'ride' ? '🚗' : '🚶' }}</span>
            <span v-if="seg.isReround" class="meta icon" title="Reround">⟳</span>
          </span>
        </button>
        <!-- empty seats add buttons -->
        <button
          v-for="seat in emptySeats(slot)"
          :key="'add-'+seat"
          class="add"
          :style="{ gridColumn: (2 + seat) + ' / span 1' }"
          @click="openAdd(slot)"
          @dragover.prevent
          @drop.prevent="onEmptySeatDrop(slot, seat)"
        >+</button>
      </div>
    </div>
    <div v-else-if="isSplit && sides.length" class="split">
      <div class="split-col" v-for="s in sides" :key="s.id">
        <div class="split-title">{{ s.name }}</div>
        <div class="grid mini" v-if="groupedBySide[s.id] && groupedBySide[s.id].length">
          <div class="row header">
            <div class="cell time">Time</div>
            <div class="cell" v-for="n in seatCols" :key="n">Seat {{ n }}</div>
          </div>
          <div class="row" v-for="slot in groupedBySide[s.id]" :key="slot.side_id + '-' + slot.start_time"
               @dragover.prevent="onDragOver($event)" @drop="onDrop($event, slot)">
            <div class="cell time" draggable="true" @dragstart="onRowDragStart($event, slot)">{{ formatSlotTime(slot) }}</div>
            <button
              v-for="seg in bookingSegments(slot)"
              :key="seg.key"
              :class="['booking-chip', seg.statusClass]"
              :style="{ gridColumn: (2 + seg.startSeat) + ' / span ' + seg.length }"
              @click="openDrawer(slot)"
              draggable="true"
              @dragstart="onRowDragStart($event, slot)"
            >
              <span class="names" :style="{ gridTemplateColumns: 'repeat(' + seg.length + ', 1fr)' }">
                <span v-for="(nm, idx) in seg.names" :key="idx" class="nm" :class="{ strong: nm && nm !== 'Guest' }">{{ nm }}</span>
              </span>
              <span class="info">
                <span class="meta holes" :title="seg.holes + ' holes'">{{ seg.holes }}</span>
                <span class="meta icon" :title="seg.walkRide==='ride' ? 'Riding' : 'Walking'">{{ seg.walkRide === 'ride' ? '🚗' : '🚶' }}</span>
                <span v-if="seg.isReround" class="meta icon" title="Reround">⟳</span>
              </span>
            </button>
            <button
              v-for="seat in emptySeats(slot)"
              :key="'add-'+seat"
              class="add"
              :style="{ gridColumn: (2 + seat) + ' / span 1' }"
              @click="openAdd(slot)"
              @dragover.prevent
              @drop.prevent="onEmptySeatDrop(slot, seat)"
            >+</button>
          </div>
        </div>
        <div v-else class="empty">No slots</div>
      </div>
    </div>
    <div v-else class="empty">No slots</div>
    <div class="toast" v-if="toast.msg">{{ toast.msg }}</div>
    <!-- Booking Modal -->
    <div v-if="bookingOpen" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <div class="modal-title">Reserve Tee Time</div>
            <div class="modal-sub">{{ draftSlot ? formatSlotTime(draftSlot) : '' }}</div>
          </div>
          <button class="close" @click="closeBooking">✕</button>
        </div>
        <div class="form-grid">
          <div class="field full">
            <label>Lead player</label>
            <div class="combo">
              <input
                v-model="leadQuery"
                @input="onLeadQuery"
                @focus="leadOpen=true; onLeadQuery()"
                :placeholder="leadSelected ? leadSelectedLabel : 'Search by name or email'"
              />
              <div class="dropdown" v-if="leadOpen && leadOptions.length">
                <div class="opt" v-for="opt in leadOptions" :key="opt.key" @click="selectLead(opt)">
                  <template v-if="!opt.create">
                    <div class="name">{{ opt.name }}</div>
                    <div class="email">{{ opt.email }}</div>
                  </template>
                  <template v-else>
                    {{ opt.label }}
                  </template>
                </div>
              </div>
            </div>
          </div>
          <div
            class="field full"
            v-for="(p, idx) in extraPlayers"
            :key="`extra-${idx}`"
          >
            <label>Player {{ idx + 2 }}</label>
            <div class="combo">
              <input
                v-model="p.query"
                @input="onExtraQuery(idx)"
                @focus="p.open=true; onExtraQuery(idx)"
                :placeholder="p.selected ? `${p.selected.name}${p.selected.email ? ' · ' + p.selected.email : ''}` : 'Search by name or email'"
              />
              <div class="dropdown" v-if="p.open && p.options.length">
                <div class="opt" v-for="opt in p.options" :key="opt.key" @click="selectExtra(idx, opt)">
                  <template v-if="!opt.create">
                    <div class="name">{{ opt.name }}</div>
                    <div class="email">{{ opt.email }}</div>
                  </template>
                  <template v-else>
                    {{ opt.label }}
                  </template>
                </div>
              </div>
            </div>
          </div>
      <div class="field full">
        <label>Players</label>
        <select v-model.number="players">
          <option v-for="n in playerOptions" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
          <div class="field">
            <label>Number of holes</label>
            <div class="seg">
              <button :class="['seg__btn',{active: holes===9}]" @click="holes=9">9</button>
              <button :class="['seg__btn',{active: holes===18}]" @click="holes=18">18</button>
            </div>
          </div>
          <div class="field">
            <label>Walking or riding</label>
            <div class="seg">
              <button :class="['seg__btn',{active: walkRide==='walk'}]" @click="walkRide='walk'">Walk</button>
              <button :class="['seg__btn',{active: walkRide==='ride'}]" @click="walkRide='ride'">Ride</button>
            </div>
          </div>
        </div>
        <div class="actions-row">
          <button class="primary" :disabled="!canReserve || busy" :title="reserveDisabledReason" @click="reserve">Reserve</button>
        </div>
      </div>
    </div>
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
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import api, { settingsAPI, bookingsAPI } from '@/services/api';

const date = ref(new Date().toISOString().substring(0,10));
const datePicker = ref(null);
const viewMode = ref(localStorage.getItem('teeSheet:viewMode') || 'split');
const seatCols = 4;
const slots = ref([]);
const sides = ref([]);
const drawerOpen = ref(false);
const selectedSlot = ref(null);
const bookingOpen = ref(false);
const draftSlot = ref(null);
const holes = ref(18);
const players = ref(1);
const walkRide = ref('walk');
const leadName = ref('');
const leadQuery = ref('');
const leadOpen = ref(false);
const leadSelected = ref(null); // { id, label } when existing customer selected
const leadOptions = ref([]);
const busy = ref(false);
const tabs = ['Players', 'Reround', 'Notes', 'Pricing', 'History', 'Actions'];
const activeTab = ref('Players');
const drag = ref({ type: null, fromTime: null, fromSeat: null });
const toast = ref({ msg: '', t: null });
const blockReason = ref('');
const lastUndo = ref({ token: '', id: '' });
const router = useRouter();

// Extra players search state (players 2..N)
const extraPlayers = ref([]); // [{ query, open, selected: {id,name,email}|null, options: [] }]

function savePrefs() {
  localStorage.setItem('teeSheet:viewMode', viewMode.value);
}
// Max players allowed for the draft slot = remaining seats (capped at 4)
const maxPlayersForDraft = computed(() => {
  const rem = draftSlot.value ? Number(draftSlot.value.remaining ?? 0) : 4;
  const cap = draftSlot.value ? Number(draftSlot.value.capacity ?? 4) : 4;
  const allowed = Math.min(4, Math.max(0, rem), Math.max(0, cap));
  return allowed > 0 ? allowed : 1;
});

const playerOptions = computed(() => Array.from({ length: maxPlayersForDraft.value }, (_, i) => i + 1));


const isSplit = computed(() => viewMode.value === 'split');
const slotsFiltered = computed(() => {
  if (isSplit.value) return slots.value;
  const sideId = viewMode.value;
  return (Array.isArray(slots.value) ? slots.value : []).filter(s => s.side_id === sideId);
});

const groupedBySide = computed(() => {
  const map = {};
  for (const s of sides.value) map[s.id] = [];
  for (const slot of (slots.value || [])) {
    (map[slot.side_id] || (map[slot.side_id] = [])).push(slot);
  }
  return map;
});

// Build booking segments for a slot: contiguous seats with same booking_id
function bookingSegments(slot){
  const result = [];
  const names = (slot.assignment_names || []);
  const assigns = Array.isArray(slot.assignments) ? slot.assignments : [];
  // derive per-seat booking id and name label
  const seats = [];
  for (let i = 0; i < seatCols; i++) {
    const assn = assigns[i];
    const bookingId = assn && assn.booking_id ? assn.booking_id : (assn && assn.round_leg && assn.round_leg.booking ? assn.round_leg.booking.id : null);
    const label = names[i] ? names[i] : (assn ? (assn.customer_name || 'Guest') : null);
    seats.push({ bookingId, label: label || null, assn });
  }
  // walk left-to-right and group
  let idx = 0;
  while (idx < seatCols) {
    const seat = seats[idx];
    if (!seat || !seat.bookingId) { idx += 1; continue; }
    const start = idx;
    let end = idx + 1;
    while (end < seatCols && seats[end] && seats[end].bookingId === seat.bookingId) end += 1;
    const segmentSeats = seats.slice(start, end);
    // Compute names deterministically:
    // - Seat 0: owner or explicit customer
    // - Subsequent seats: explicit customer when present; otherwise Guest
    const segNames = [];
    const segmentOwnerName = (segmentSeats[0] && segmentSeats[0].assn && segmentSeats[0].assn.owner_name) ? segmentSeats[0].assn.owner_name : '';
    for (let j = 0; j < segmentSeats.length; j++) {
      const seatObj = segmentSeats[j];
      const explicitCustomer = (seatObj && seatObj.assn && typeof seatObj.assn.customer_name === 'string' && seatObj.assn.customer_name.trim())
        ? seatObj.assn.customer_name
        : '';
      if (j === 0) {
        const primary = explicitCustomer || (seatObj && seatObj.label) || 'Guest';
        segNames.push(formatInitialLast(primary));
      } else {
        // Avoid echoing the owner name into later seats
        const name = (explicitCustomer && explicitCustomer !== segmentOwnerName) ? explicitCustomer : 'Guest';
        segNames.push(formatInitialLast(name));
      }
    }
    // booking-level meta from any seat in the segment
    const anyRide = segmentSeats.some(s => {
      if (!s || !s.assn) return false;
      const direct = s.assn.walk_ride ? String(s.assn.walk_ride).toLowerCase() : '';
      const viaLeg = s.assn.round_leg && s.assn.round_leg.walk_ride ? String(s.assn.round_leg.walk_ride).toLowerCase() : '';
      return direct === 'ride' || direct === 'riding' || viaLeg === 'ride' || viaLeg === 'riding';
    });
    const firstAssn = segmentSeats[0].assn;
    const firstVal = firstAssn && firstAssn.walk_ride ? String(firstAssn.walk_ride).toLowerCase() : '';
    const walkRide = anyRide ? 'ride' : (firstVal === 'ride' || firstVal === 'riding' ? 'ride' : 'walk');
    const holes = (() => {
      const maxIdx = typeof firstAssn?.booking_leg_max_index === 'number' ? firstAssn.booking_leg_max_index : (firstAssn?.round_leg?.leg_index || 0);
      return maxIdx > 0 ? 18 : 9;
    })();
    const isReround = (() => {
      const li = typeof firstAssn?.leg_index === 'number' ? firstAssn.leg_index : (firstAssn?.round_leg?.leg_index || 0);
      return li > 0;
    })();
    // Determine booking status for this segment
    const rawStatus = String(firstAssn?.status || firstAssn?.round_leg?.booking?.status || '').toLowerCase();
    const norm = rawStatus.includes('checked') ? 'checked-in' : (rawStatus === 'paid' ? 'paid' : (rawStatus === 'booked' || rawStatus === 'active' ? 'booked' : 'booked'));
    const statusClass = `status-${norm}`;
    result.push({
      key: `${slot.id}:${seat.bookingId}:${start}`,
      startSeat: start,
      length: end - start,
      names: segNames,
      walkRide,
      holes,
      isReround,
      statusClass,
    });
    idx = end;
  }
  return result;
}

function emptySeats(slot){
  // seats without an assignment or not covered by a booking segment
  const used = new Set();
  for (const seg of bookingSegments(slot)) {
    for (let s = seg.startSeat; s < seg.startSeat + seg.length; s++) used.add(s);
  }
  const arr = [];
  for (let i = 0; i < seatCols; i++) if (!used.has(i)) arr.push(i);
  return arr;
}

async function onViewModeChange(){
  savePrefs();
}

function goSettings() {
  router.push('/settings/tee-sheet');
}

const formattedDate = computed(() => {
  try { return new Date(date.value + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return date.value; }
});

const isToday = computed(() => {
  const today = new Date().toISOString().substring(0,10);
  return date.value === today;
});

const todayTooltip = computed(() => {
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  return `Go to today ${today}`;
});

function goToday(){
  date.value = new Date().toISOString().substring(0,10);
  load();
}

function shiftDay(delta){
  const d = new Date(date.value + 'T00:00:00');
  d.setDate(d.getDate() + Number(delta||0));
  date.value = d.toISOString().substring(0,10);
  load();
}

function openDatePicker(){
  try { datePicker.value && datePicker.value.showPicker ? datePicker.value.showPicker() : datePicker.value.click(); } catch { /* fallback click */ try { datePicker.value && datePicker.value.click(); } catch {} }
}

function onDatePicked(){
  load();
}

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
}

function displayTime(slot){
  return slot.start_time_local || slot.start_time;
}

function formatSlotTime(slot){
  const iso = slot.start_time_local;
  if (iso && typeof iso === 'string' && iso.includes('T')) {
    // Treat as already-local wall time; avoid timezone conversion
    const h = Number(iso.substring(11,13));
    const m = iso.substring(14,16);
    const ampm = h === 0 ? 'AM' : (h < 12 ? 'AM' : (h === 12 ? 'PM' : 'PM'));
    const hh = ((h + 11) % 12) + 1; // 0->12, 13->1
    return `${hh.toString().padStart(1,'')}:${m} ${ampm}`;
  }
  return formatTime(slot.start_time);
}

async function load() {
  // Ensure a tee sheet id is selected; fallback to first available
  let teeSheetId = localStorage.getItem('teeSheet:lastSheet');
  if (!teeSheetId) {
    try {
      const { data } = await settingsAPI.listTeeSheets();
      if (Array.isArray(data) && data.length) {
        teeSheetId = data[0].id;
        try { localStorage.setItem('teeSheet:lastSheet', teeSheetId); } catch {}
      }
    } catch {}
  }
  if (!teeSheetId) { slots.value = []; return; }
  try {
    const { data: sideList } = await settingsAPI.listSides(teeSheetId);
    sides.value = Array.isArray(sideList) ? sideList : [];
  } catch { sides.value = []; }
  const params = { date: date.value, teeSheets: teeSheetId, customerView: 'false', classId: 'Full', groupSize: '1' };
  try {
    const res = await api.get('/tee-times/available', { params });
    let data = res.data || [];
    // If no slots, probe other sheets to auto-select one that has slots for this date
    if ((!Array.isArray(data) || data.length === 0)) {
      try {
        const { data: sheets } = await settingsAPI.listTeeSheets();
        if (Array.isArray(sheets)) {
          for (const s of sheets) {
            if (!s?.id || s.id === teeSheetId) continue;
            const probe = await api.get('/tee-times/available', { params: { ...params, teeSheets: s.id } });
            const probeList = probe.data || [];
            if (Array.isArray(probeList) && probeList.length) {
              data = probeList;
              teeSheetId = s.id;
              try { localStorage.setItem('teeSheet:lastSheet', teeSheetId); } catch {}
              break;
            }
          }
        }
      } catch {}
    }
    slots.value = data;
  } catch (_) {
    slots.value = [];
  }
}

function openAdd(slot) {
  draftSlot.value = slot;
  holes.value = 18;
  players.value = 1;
  walkRide.value = 'walk';
  leadName.value = '';
  // reset extra players
  extraPlayers.value = [];
  bookingOpen.value = true;
}

function closeBooking(){
  bookingOpen.value = false;
  draftSlot.value = null;
  // Clear lead input and selection on close
  leadSelected.value = null;
  leadQuery.value = '';
  leadName.value = '';
  leadOpen.value = false;
  extraPlayers.value = [];
}

const leadSelectedLabel = computed(() => leadSelected.value ? leadSelected.value.label : '');
const canReserve = computed(() => !!draftSlot.value && players.value >= 1 && players.value <= maxPlayersForDraft.value && (leadSelected.value || !!leadName.value.trim() || !!leadQuery.value.trim()));
const reserveDisabledReason = computed(() => {
  if (!draftSlot.value) return 'No slot selected';
  if (players.value < 1 || players.value > maxPlayersForDraft.value) return `Players must be 1-${maxPlayersForDraft.value}`;
  if (!leadName.value.trim()) return 'Lead name required';
  return '';
});

async function reserve(){
  if (!canReserve.value || !draftSlot.value) return;
  busy.value = true;
  try{
    const body = {
      tee_sheet_id: draftSlot.value.tee_sheet_id,
      classId: 'Full',
      holes: holes.value,
      lead_name: leadSelected.value ? '' : (leadName.value || leadQuery.value),
      lead_email: '',
      players: Array.from({ length: players.value }).map((_,i)=>({
        customer_id: i === 0 ? (leadSelected.value?.id || null) : (extraPlayers.value[i-1]?.selected?.id || null),
        email: '',
        walkRide: walkRide.value,
      })),
      legs: [{ tee_time_id: draftSlot.value.id, round_option_id: null, leg_index: 0 }],
    };
    if (leadSelected.value && leadSelected.value.id) {
      body.owner_customer_id = leadSelected.value.id;
    }
    console.log('Reserve payload', body);
    await bookingsAPI.create(body);
    showToast('Reserved');
    closeBooking();
    await load();
  }catch(e){ console.error('Reserve failed', e); showToast('Reservation failed'); }
  finally{ busy.value = false; }
}

async function onLeadQuery(){
  const q = leadQuery.value.trim();
  // Debounce lightly via microtask; simple guard
  if (!q) { leadOptions.value = []; return; }
  try {
    // Reuse customer list endpoint with search and small limit
    const { data } = await api.get('/customers', { params: { search: q, limit: 6 } });
    const opts = Array.isArray(data)
      ? data.map(c => ({ key: c.id, id: c.id, name: `${(c.first_name||'').trim()} ${(c.last_name||'').trim()}`.trim(), email: c.email || '' }))
      : [];
    // Add create-new option at end
    opts.push({ key: `__create__:${q}`, id: null, create: true, label: `Create new "${q}"` });
    leadOptions.value = opts;
  } catch {
    leadOptions.value = [{ key: `__create__:${q}`, id: null, create: true, label: `Create new "${q}"` }];
  }
}

// Keep extra search rows in sync with players count
watch(players, (val) => {
  const needed = Math.max(0, Number(val || 1) - 1);
  while (extraPlayers.value.length < needed) {
    extraPlayers.value.push({ query: '', open: false, selected: null, options: [] });
  }
  while (extraPlayers.value.length > needed) {
    extraPlayers.value.pop();
  }
});

async function onExtraQuery(idx){
  const row = extraPlayers.value[idx];
  if (!row) return;
  const q = String(row.query || '').trim();
  if (!q) { row.options = []; return; }
  try {
    const { data } = await api.get('/customers', { params: { search: q, limit: 6 } });
    const opts = Array.isArray(data)
      ? data.map(c => ({ key: c.id, id: c.id, name: `${(c.first_name||'').trim()} ${(c.last_name||'').trim()}`.trim(), email: c.email || '' }))
      : [];
    opts.push({ key: `__create__:${q}`, id: null, create: true, label: `Create new "${q}"` });
    row.options = opts;
  } catch {
    row.options = [{ key: `__create__:${q}`, id: null, create: true, label: `Create new "${q}"` }];
  }
}

function selectExtra(idx, opt){
  const row = extraPlayers.value[idx];
  if (!row) return;
  if (opt.create) {
    row.selected = null;
    row.query = opt.label.replace(/^Create new \"(.*)\"$/, '$1');
  } else {
    row.selected = { id: opt.id, name: opt.name, email: opt.email };
    row.query = opt.name;
  }
  row.open = false;
}

function selectLead(opt){
  if (opt.create) {
    leadSelected.value = null;
    leadName.value = leadQuery.value.trim();
  } else {
    const lbl = `${opt.name}${opt.email ? ' · ' + opt.email : ''}`;
    leadSelected.value = { id: opt.id, label: lbl, name: opt.name, email: opt.email };
    leadName.value = '';
    // Reflect selection in input field
    leadQuery.value = opt.name || '';
  }
  leadOpen.value = false;
}

function occupiedCount(slot) {
  const remaining = Number(slot.remaining ?? 0);
  const capacity = Number(slot.capacity ?? 0);
  const used = capacity - remaining;
  return used > 0 ? used : 0;
}

function playerLabel(slot, seatIndex){
  // Try to read names from slot.assignments if backend provides; else fallback to Guest
  let name = '';
  if (Array.isArray(slot.assignment_names)) {
    name = slot.assignment_names[seatIndex - 1] || '';
  } else if (Array.isArray(slot.assignments)) {
    const assn = slot.assignments[seatIndex - 1];
    name = assn && (assn.player_name || assn.customer_name);
  }
  return (typeof name === 'string' && name.trim()) ? name.trim() : 'Guest';
}

// Format display name as FirstInitial + LastName, falling back to original label or Guest
function formattedPlayer(slot, seatIndex){
  const label = playerLabel(slot, seatIndex);
  if (!label || label === 'Guest') return 'Guest';
  const parts = String(label).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts.slice(1).join(' ');
  const initial = first ? first.charAt(0).toUpperCase() + '.' : '';
  return `${initial} ${last}`.trim();
}

function formatInitialLast(label){
  if (!label || label === 'Guest') return 'Guest';
  const parts = String(label).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts.slice(1).join(' ');
  const initial = first ? first.charAt(0).toUpperCase() + '.' : '';
  return `${initial} ${last}`.trim();
}

// Read walk/ride from first leg's walk_ride if present
function seatWalkRide(slot, seatIndex){
  const assn = Array.isArray(slot.assignments) ? slot.assignments[seatIndex - 1] : null;
  const leg = assn && assn.round_leg;
  const wr = leg && leg.walk_ride;
  return (wr === 'ride' ? 'ride' : 'walk');
}

// Holes: if we have multiple legs in same booking for this slot, infer 18 for leg_index 0 with a second leg, else 9 by default
function seatHoles(slot, seatIndex){
  const assn = Array.isArray(slot.assignments) ? slot.assignments[seatIndex - 1] : null;
  if (!assn) return 9;
  // Prefer server-provided booking max index if present
  const maxIdx = typeof assn.booking_leg_max_index === 'number' ? assn.booking_leg_max_index : (assn.round_leg && typeof assn.round_leg.leg_index === 'number' ? assn.round_leg.leg_index : 0);
  return maxIdx > 0 ? 18 : 9;
}

// Reround icon when leg_index > 0 (e.g., back 9)
function seatIsReround(slot, seatIndex){
  const assn = Array.isArray(slot.assignments) ? slot.assignments[seatIndex - 1] : null;
  if (!assn) return false;
  if (typeof assn.leg_index === 'number') return assn.leg_index > 0;
  const leg = assn.round_leg;
  return !!(leg && typeof leg.leg_index === 'number' && leg.leg_index > 0);
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
.date-controls { display: flex; gap: 8px; align-items: center; }
.date-controls .link { background: transparent; border: 1px solid transparent; color: #111827; padding: 6px 8px; cursor: pointer; border-radius: 8px; transition: background .15s, color .15s; }
.date-controls .link:hover { background: #eef2ff; color: #3730a3; }
.date-controls .link .arrow { color: #6366f1; margin-right: 6px; }
.date-controls .icon { background: #fff; border: 1px solid #ddd; border-radius: 6px; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.date-controls .icon:hover { background: #f9fafb; }
.date-controls .date-display { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
.date-controls .date-display .caret { margin-left: 6px; color: #6b7280; }
.hidden-date { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
.grid { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
.row { display: grid; grid-template-columns: 120px repeat(4, 1fr); border-top: 1px solid #eee; position: relative; }
.row.header { background: #fafafa; font-weight: 600; }
.cell { padding: 8px; border-left: 1px solid #eee; }
.cell.time { border-left: none; white-space: nowrap; font-size: 14px; }
.cell.seat { min-height: 36px; display: flex; align-items: center; }
.split { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.split-col { display: flex; flex-direction: column; gap: 8px; }
.split-title { font-weight: 600; padding: 4px 2px; }
.grid.mini .row { display: grid; grid-template-columns: 110px repeat(4, 1fr); }
.add { font-size: 12px; padding: 4px 8px; }
.chip { font-size: 12px; padding: 4px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; }
.chip .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: currentColor; }
.chip.active { background: #e8f8ef; color: #1a7f37; border-color: #bde5cd; }
/* booking spanning chip styled as grid item inside row */
.booking-chip { display: grid; align-items: center; gap: 0; font-size: 14px; padding: 4px 0; border-radius: 18px; border: 1px solid #bde5cd; background: #e8f8ef; color: #1a7f37; grid-row: 1; position: relative; margin: 3px 6px; }
.booking-chip.status-booked { border-color: #facc15; background: #fef9c3; color: #854d0e; }
.booking-chip.status-paid { border-color: #93c5fd; background: #dbeafe; color: #1e3a8a; }
.booking-chip.status-checked-in { border-color: #86efac; background: #dcfce7; color: #166534; }
.booking-chip .names { display: grid; width: 100%; gap: 0; justify-items: start; }
.booking-chip .names .nm { min-width: 0; padding: 2px 10px; text-align: left; font-size: 14px; font-weight: 400; }
.booking-chip .names .nm.strong { font-weight: 700; }
.booking-chip .names .nm:last-child { padding-right: 28px; }
.booking-chip .info { position: absolute; right: 8px; display: inline-flex; gap: 6px; }
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

/* Modal */
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { width: 520px; max-width: 95vw; background: #fff; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); overflow: visible; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #eee; }
.modal-title { font-weight: 600; }
.modal-sub { color: #6b7280; font-size: 12px; }
.form-grid { padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-grid .field { display: flex; flex-direction: column; gap: 6px; }
.form-grid .field.full { grid-column: 1 / -1; }
.form-grid label { font-size: 12px; color: #5f6368; }
.form-grid input, .form-grid select { padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; width: 100%; box-sizing: border-box; }
.combo { position: relative; width: 100%; }
.combo { position: relative; }
.dropdown { position: absolute; left: 0; right: 0; top: calc(100% + 4px); background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,0.08); z-index: 1100; max-height: 220px; overflow: auto; }
.opt { padding: 6px 10px; cursor: pointer; font-size: 14px; line-height: 1.2; }
.opt:hover { background: #f6f7f9; }
.opt .name { font-weight: 600; }
.opt .email { color: #6b7280; font-size: 12px; }
.seg { display: inline-flex; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
.seg__btn { padding: 6px 10px; border: none; background: #fff; cursor: pointer; }
.seg__btn.active { background: #eef6ff; color: #1d4ed8; }
.actions-row { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid #eee; }
</style>


