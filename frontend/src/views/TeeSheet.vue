<template>
  <div class="tee-sheet">
    <header class="controls">
      <div class="date-controls">
        <button class="link" :title="todayTooltip" @click="goToday">
          <span v-if="!isToday" class="arrow"><i class="fa-light fa-arrow-left-long"></i></span> Today
        </button>
        <button class="icon" @click="shiftDay(-1)" aria-label="Previous day"><i class="fa-light fa-chevron-left"></i></button>
        <button class="icon" @click="shiftDay(1)" aria-label="Next day"><i class="fa-light fa-chevron-right"></i></button>
        <button class="date-display" @click="openDatePicker">
          {{ formattedDate }} <span class="caret"><i class="fa-light fa-caret-down"></i></span>
        </button>
        <input ref="datePicker" type="date" v-model="date" @change="onDatePicked" class="hidden-date" />
      </div>
      <div class="control-row" style="display:flex; gap:8px; align-items:center;">
        <div class="select-wrap">
          <select class="view-select body" v-model="viewMode" @change="onViewModeChange">
            <option v-for="opt in viewSelectOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <i class="fa-light fa-caret-down caret"></i>
        </div>
        <button class="icon-btn" @click="goSettings" aria-label="Settings" data-cy="goto-settings">
          <i class="fa-light fa-gear"></i>
        </button>
      </div>
      <div class="col-header" v-if="!isSplit">
        <div class="cell time">Time</div>
        <div class="cell" v-for="n in seatCols" :key="'hdr-'+n">Seat {{ n }}</div>
      </div>
    </header>
    <div v-if="!isSplit && slotsFiltered.length" class="grid">
      <div class="row" v-for="slot in slotsFiltered" :key="slot.side_id + '-' + slot.start_time" :data-start="slot.start_time"
           @dragover.prevent="onDragOver($event)" @drop="onDrop($event, slot)">
        <span class="tpl-bar" :style="{ background: templateColor(slot) }"></span>
        <div class="cell time" draggable="true" @dragstart="onRowDragStart($event, slot)">{{ formatSlotTime(slot) }}</div>
        <!-- booking-spanning chips -->
        <button
          v-for="seg in bookingSegments(slot)"
          :key="seg.key"
          :class="['booking-chip', seg.statusClass]"
          :style="{ gridColumn: (2 + seg.startSeat) + ' / span ' + seg.length }"
          @click="openDrawer(slot, seg)"
          draggable="true"
          @dragstart="onRowDragStart($event, slot)"
        >
          <span class="leftbar" :title="seg.holes + ' holes'">
            <span class="holes">{{ seg.holes }}</span>
          </span>
          <span class="names" :style="{ gridTemplateColumns: 'repeat(' + seg.length + ', 1fr)' }">
            <span v-for="(nm, idx) in seg.names" :key="idx" class="player-cell">
              <span class="badge" aria-hidden="true"><i class="fa-light fa-calendar"></i></span>
              <span class="nm" :class="{ strong: nm && nm !== 'Guest' }">{{ nm }}</span>
            </span>
          </span>
          <span class="info">
            <span class="meta icon" :title="seg.walkRide==='ride' ? 'Riding' : 'Walking'">{{ seg.walkRide === 'ride' ? '🚗' : '🚶' }}</span>
            <span v-if="seg.holes===18 && seg.legIndex===1" class="meta icon" title="Reround">⟳</span>
          </span>
        </button>
        <!-- Seat hit areas: reveal +N only for hovered cell; full cell clickable; render only when seat empty -->
        <template v-for="n in seatCols">
          <div
            :key="'hit-'+slot.start_time+'-'+n"
            class="seat-hit"
            :class="{ disabled: hoverLabel(slot, n) <= 0 }"
            :style="{ gridColumn: (1 + n) + ' / span 1' }"
            v-if="isSeatEmpty(slot, n)"
            @click="onSeatClick(slot, n)"
          >
            <span class="hover-label" v-if="hoverLabel(slot, n) > 0">+{{ hoverLabel(slot, n) }}</span>
          </div>
        </template>
      </div>
    </div>
    <div v-else-if="isSplit && sides.length" class="split">
      <div class="split-col" v-for="s in sides" :key="s.id">
        <div class="split-title">{{ s.name }}</div>
        <div class="grid mini" v-if="groupedBySide[s.id] && groupedBySide[s.id].length">
          <div class="row" v-for="slot in groupedBySide[s.id]" :key="slot.side_id + '-' + slot.start_time"
               @dragover.prevent="onDragOver($event)" @drop="onDrop($event, slot)">
            <span class="tpl-bar" :style="{ background: templateColor(slot) }"></span>
            <div class="cell time" draggable="true" @dragstart="onRowDragStart($event, slot)">{{ formatSlotTime(slot) }}</div>
            <button
              v-for="seg in bookingSegments(slot)"
              :key="seg.key"
              :class="['booking-chip', seg.statusClass]"
              :style="{ gridColumn: (2 + seg.startSeat) + ' / span ' + seg.length }"
              @click="openDrawer(slot, seg)"
              draggable="true"
              @dragstart="onRowDragStart($event, slot)"
            >
              <span class="leftbar" :title="seg.holes + ' holes'">
                <span class="holes">{{ seg.holes }}</span>
              </span>
              <span class="names" :style="{ gridTemplateColumns: 'repeat(' + seg.length + ', 1fr)' }">
                <span v-for="(nm, idx) in seg.names" :key="idx" class="player-cell">
                  <span class="badge" aria-hidden="true"><i class="fa-light fa-calendar"></i></span>
                  <span class="nm" :class="{ strong: nm && nm !== 'Guest' }">{{ nm }}</span>
                </span>
              </span>
              <span class="info">
                <span class="meta icon" :title="seg.walkRide==='ride' ? 'Riding' : 'Walking'">{{ seg.walkRide === 'ride' ? '🚗' : '🚶' }}</span>
                <span v-if="seg.holes===18 && seg.legIndex===1" class="meta icon" title="Reround">⟳</span>
              </span>
            </button>
            <template v-for="n in seatCols">
              <div
                :key="'hit-s-'+slot.side_id+'-'+slot.start_time+'-'+n"
                class="seat-hit"
                :class="{ disabled: hoverLabel(slot, n) <= 0 }"
                :style="{ gridColumn: (1 + n) + ' / span 1' }"
                v-if="isSeatEmpty(slot, n)"
                @click="onSeatClick(slot, n)"
              >
                <span class="hover-label" v-if="hoverLabel(slot, n) > 0">+{{ hoverLabel(slot, n) }}</span>
              </div>
            </template>
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
                class="body"
                v-model="leadQuery"
                @input="onLeadQuery"
                @focus="leadOpen=true; onLeadQuery()"
                :placeholder="leadSelected ? leadSelectedLabel : 'Search by name or email'"
              />
              <div class="dropdown" v-if="leadOpen && leadOptions.length">
                <div class="opt body" v-for="opt in leadOptions" :key="opt.key" @click="selectLead(opt)">
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
                class="body"
                v-model="p.query"
                @input="onExtraQuery(idx)"
                @focus="p.open=true; onExtraQuery(idx)"
                :placeholder="p.selected ? `${p.selected.name}${p.selected.email ? ' · ' + p.selected.email : ''}` : 'Search by name or email'"
              />
              <div class="dropdown" v-if="p.open && p.options.length">
                <div class="opt body" v-for="opt in p.options" :key="opt.key" @click="selectExtra(idx, opt)">
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
            <div class="player-circles">
              <button
                v-for="n in maxPlayersForDraft"
                :key="'p-add-'+n"
                type="button"
                :class="['circle', { active: players === n }]"
                :aria-pressed="players === n"
                @click="players = n"
              >{{ n }}</button>
            </div>
          </div>
          <div class="field">
            <label>Number of holes</label>
            <div class="seg">
              <button :class="['seg__btn',{active: holes===9}]" @click="holes=9">9</button>
              <button
                :class="['seg__btn',{active: holes===18, disabled: !canBook18ForDraft}]"
                :disabled="!canBook18ForDraft"
                :title="!canBook18ForDraft ? '18 holes unavailable (no valid reround)' : ''"
                @click="canBook18ForDraft ? (holes=18) : null"
              >18</button>
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
        <div class="drawer-title">
          <div class="drawer-time">{{ selectedSlot ? formatSlotTime(selectedSlot) : '' }}</div>
          <div class="drawer-meta" v-if="selectedSlot">Capacity {{ selectedSlot.capacity }} · Remaining {{ effectiveRemaining(selectedSlot) }}</div>
        </div>
        <div class="drawer-actions">
          <button class="icon-btn" @click="actionsOpen = !actionsOpen" aria-label="Actions"><i class="fa-light fa-ellipsis-vertical"></i></button>
          <div class="actions-menu" v-if="actionsOpen" @click.outside="actionsOpen = false">
            <button class="danger full" @click="actionsOpen=false; promptCancelBooking()">Cancel booking</button>
            <button class="full" @click="actionsOpen=false; rescheduleBooking()">Reschedule</button>
            <button class="full" @click="actionsOpen=false; transferOwner()">Transfer Owner</button>
            <hr />
            <button class="full" v-if="selectedSlot && !selectedSlot.is_blocked" @click="actionsOpen=false; blockSlot()">Block slot</button>
            <button class="full" v-if="canUndoBlock" @click="actionsOpen=false; undoBlock()">Undo block</button>
            <div class="reason">
              <input v-model="blockReason" placeholder="Reason (optional)" />
            </div>
          </div>
          <button class="close" @click="drawerOpen = false; bookingInDrawer = false; actionsOpen = false; resetBookingForm()">✕</button>
        </div>
      </div>
      <div class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          :class="['tab', { active: activeTab === t.key }]"
          @click="activeTab = t.key"
          :title="t.key"
          aria-label="t.key"
        >
          <i :class="t.icon"></i>
          <span class="sr-only">{{ t.key }}</span>
        </button>
      </div>
      <div class="panel">
          <div v-if="activeTab === 'Players'">
            <div class="form-grid form-outline">
              <div class="field full">
                <label>Players</label>
                <div class="player-circles">
                  <button
                    v-for="n in 4"
                    :key="'p-edit-top-'+n"
                    type="button"
                    :class="['circle', { active: players === n, disabled: n > maxPlayersSelectableDrawer }]"
                    :aria-pressed="players === n"
                    :disabled="n > maxPlayersSelectableDrawer"
                    @click="n <= maxPlayersSelectableDrawer ? (players = n, hasPlayerEdits=true) : null"
                  >{{ n }}</button>
                </div>
              </div>
              <div class="field full float">
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
                class="field full float"
                v-for="(p, idx) in extraPlayers"
                :key="`extra3-${idx}`"
              >
                <label>Player {{ idx + 2 }}</label>
                <div class="combo">
                  <input
                    class="body"
                    v-model="p.query"
                    @input="onExtraQuery(idx)"
                    @focus="p.open=true; onExtraQuery(idx)"
                    :placeholder="p.selected ? `${p.selected.name}${p.selected.email ? ' · ' + p.selected.email : ''}` : 'Search by name or email'"
                  />
                  <div class="dropdown" v-if="p.open && p.options.length">
                    <div class="opt body" v-for="opt in p.options" :key="opt.key" @click="selectExtra(idx, opt)">
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
              
              <div class="field">
                <label>Number of holes</label>
                <div class="player-circles hole-circles">
                  <button type="button" :class="['circle',{active: holes===9}]" :aria-pressed="holes===9" @click="holes=9; hasPlayerEdits=true">9</button>
                  <button
                    type="button"
                    :class="['circle',{active: holes===18, disabled: !canBook18InDrawer}]"
                    :aria-pressed="holes===18"
                    :disabled="!canBook18InDrawer"
                    :title="!canBook18InDrawer ? '18 holes unavailable (no valid reround)' : '18'"
                    @click="canBook18InDrawer ? (holes=18, hasPlayerEdits=true) : null"
                  >18</button>
                </div>
              </div>
              <div class="field">
                <label>Walking or riding</label>
                <div class="player-circles walkride-circles">
                  <button type="button" :class="['circle',{active: walkRide==='walk'}]" :aria-pressed="walkRide==='walk'" @click="walkRide='walk'; hasPlayerEdits=true" :title="'Walk'" aria-label="Walk">
                    <v-icon icon="fa:fal fa-person-walking" size="20" />
                  </button>
                  <button type="button" :class="['circle',{active: walkRide==='ride'}]" :aria-pressed="walkRide==='ride'" @click="walkRide='ride'; hasPlayerEdits=true" :title="'Ride'" aria-label="Ride">
                    <v-icon icon="fa:fal fa-car" size="20" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="activeTab === 'Reround'">
            <div class="form-grid form-outline">
              <div class="field">
                <label>Leg selected</label>
                <input :value="clickedLegIndex === 1 ? 'Second leg (back 9)' : 'First leg (front 9)'" disabled />
              </div>
              <div class="field">
                <label>Reround time</label>
                <input :value="reroundTimeText" disabled />
              </div>
            </div>
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
      </div>
      <div class="drawer-footer">
        <template v-if="bookingInDrawer">
          <button class="primary" :disabled="!canReserve || busy" :title="reserveDisabledReason" @click="reserve">Reserve</button>
        </template>
        <template v-else>
          <button v-if="activeTab === 'Players'" class="primary" :disabled="!hasPlayerEdits || busy" @click="savePlayerEdits">Save</button>
        </template>
      </div>
      <!-- Lightweight confirmation dialog overlay -->
      <div class="confirm-overlay" v-if="confirmCancelOpen">
        <div class="confirm-dialog">
          <div class="confirm-title">Cancel booking?</div>
          <p>This will remove the booking from this tee time.</p>
          <div class="confirm-actions">
            <button class="danger" @click="confirmCancel">Cancel booking</button>
            <button @click="confirmCancelOpen=false">Keep booking</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, reactive } from 'vue';
import { useRouter } from 'vue-router';
import api, { settingsAPI, bookingsAPI } from '@/services/api';

const date = ref(new Date().toISOString().substring(0,10));
const datePicker = ref(null);
// Global view selection across all sheets: value format
//  - "<sheetId>::split"
//  - "<sheetId>::side::<sideId>"
const viewMode = ref(localStorage.getItem('teeSheet:viewModeV2') || '');
const teeSheetName = ref('');
const currentSheetId = ref(localStorage.getItem('teeSheet:lastSheet') || '');
const teeSheets = ref([]);
const sidesBySheet = reactive({}); // { [sheetId]: Array<{id,name}> }
const seatCols = 4;
const slots = ref([]);
const sides = ref([]);
const drawerOpen = ref(false);
const selectedSlot = ref(null);
const bookingOpen = ref(false);
const bookingInDrawer = ref(false);
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
const tabs = [
  { key: 'Players', icon: 'fa-light fa-users' },
  { key: 'Reround', icon: 'fa-light fa-rotate-right' },
  { key: 'Notes', icon: 'fa-light fa-note-sticky' },
  { key: 'Pricing', icon: 'fa-light fa-tag' },
  { key: 'History', icon: 'fa-light fa-clock-rotate-left' },
];
const activeTab = ref('Players');
const drag = ref({ type: null, fromTime: null, fromSeat: null });
const toast = ref({ msg: '', t: null });
const blockReason = ref('');
const lastUndo = ref({ token: '', id: '' });
// Players tab edit/save state
const hasPlayerEdits = ref(false);
const selectedBookingId = ref(null);
const initialPlayersCount = ref(1);
const initialHoles = ref(9);
const initialWalkRide = ref('walk');
// Reround tab state
const clickedLegIndex = ref(0); // 0 = first, 1 = second
const reroundPlayers = ref([]);
const reroundTimeText = computed(() => {
  if (!selectedSlot.value || !selectedBookingId.value) return '';
  const desiredLeg = clickedLegIndex.value === 0 ? 1 : 0;
  // Find a slot on the page that carries the opposite leg for the same booking
  for (const s of slots.value || []) {
    try {
      for (const seg of bookingSegments(s)) {
        if (seg.bookingId === selectedBookingId.value && seg.legIndex === desiredLeg) {
          return formatSlotTime(s);
        }
      }
    } catch {}
  }
  return '';
});

// Actions dropdown state
const actionsOpen = ref(false);
const confirmCancelOpen = ref(false);
const router = useRouter();

// Extra players search state (players 2..N)
const extraPlayers = ref([]); // [{ query, open, selected: {id,name,email}|null, options: [] }]

function savePrefs() {
  try { localStorage.setItem('teeSheet:viewModeV2', viewMode.value); } catch {}
}
// Max players allowed for the draft slot = remaining seats (capped at 4)
const maxPlayersForDraft = computed(() => {
  // Use effectiveRemaining which derives from visible segments, not raw API 'remaining'
  const rem = draftSlot.value ? Math.max(0, effectiveRemaining(draftSlot.value)) : 4;
  const allowed = Math.min(4, Math.max(1, rem));
  return allowed;
});

const playerOptions = computed(() => Array.from({ length: maxPlayersForDraft.value }, (_, i) => i + 1));

// Compute if an 18-hole booking is feasible from a given starting slot for the current players count
function findReroundCandidate(startSlot, partySize){
  try {
    if (!startSlot) return null;
    // Prefer denormalized pairing if available
    if (startSlot.can_start_18 && startSlot.reround_tee_time_id) {
      const all = Array.isArray(slots.value) ? slots.value : [];
      const paired = all.find(s => s.id === startSlot.reround_tee_time_id);
      if (paired && !paired.is_blocked && effectiveRemaining(paired) >= Math.max(1, Number(partySize||1))) return paired;
      return null;
    }
    // Fallback: infer by time/side if denormalized fields absent
    const start = new Date(startSlot.start_time);
    const side = (sides.value || []).find(s => s.id === startSlot.side_id);
    const mph = Math.max(1, Number(side?.minutes_per_hole || 12));
    const holesPerLeg = Math.max(1, Number(side?.hole_count || 9));
    const reroundStart = new Date(start.getTime() + mph * holesPerLeg * 60000);
    const otherSideId = (sides.value || []).find(s => s.id !== startSlot.side_id)?.id || startSlot.side_id;
    const all = Array.isArray(slots.value) ? slots.value : [];
    const next = [otherSideId, startSlot.side_id]
      .map(preferSide => all
        .filter(s => s.tee_sheet_id === startSlot.tee_sheet_id && s.side_id === preferSide && new Date(s.start_time) > reroundStart && !s.is_blocked)
        .sort((a,b)=> new Date(a.start_time) - new Date(b.start_time))[0])
      .find(Boolean);
    if (next && effectiveRemaining(next) >= Math.max(1, Number(partySize||1))) return next;
    return null;
  } catch { return null; }
}

const canBook18ForDraft = computed(() => {
  if (!draftSlot.value) return true;
  const cand = findReroundCandidate(draftSlot.value, players.value);
  return !!cand;
});

const canBook18InDrawer = computed(() => {
  if (!selectedSlot.value) return true;
  const cand = findReroundCandidate(selectedSlot.value, players.value);
  return !!cand;
});

// Max players allowed in drawer:
// - When creating a new booking: up to remaining seats
// - When editing an existing booking: current players + remaining (capped at 4 and capacity)
const maxPlayersSelectableDrawer = computed(() => {
  try {
    const slot = selectedSlot.value;
    if (!slot) return 4;
    const remaining = Math.max(0, effectiveRemaining(slot));
    const capacity = Math.max(0, Number(slot.capacity || 4));
    const capLimit = Math.min(4, capacity);
    if (selectedBookingId.value) {
      const current = Math.max(1, Number(initialPlayersCount.value || players.value || 1));
      return Math.min(capLimit, current + remaining);
    }
    return Math.min(capLimit, Math.max(1, remaining));
  } catch { return 4; }
});

// Clamp players when remaining changes or slot changes
watch([selectedSlot, maxPlayersSelectableDrawer], () => {
  try {
    if (players.value > maxPlayersSelectableDrawer.value) players.value = maxPlayersSelectableDrawer.value;
    if (players.value < 1) players.value = 1;
  } catch {}
});

function parseViewValue(v){
  if (!v || typeof v !== 'string') return { sheetId: currentSheetId.value || '', type: 'split', sideId: '' };
  const parts = v.split('::');
  if (parts.length === 2 && parts[1] === 'split') return { sheetId: parts[0], type: 'split', sideId: '' };
  if (parts.length === 3 && parts[1] === 'side') return { sheetId: parts[0], type: 'side', sideId: parts[2] };
  return { sheetId: currentSheetId.value || '', type: 'split', sideId: '' };
}
const parsedView = computed(() => parseViewValue(viewMode.value));
const isSplit = computed(() => parsedView.value.type === 'split');
const slotsFiltered = computed(() => {
  if (isSplit.value) return slots.value;
  const sideId = parsedView.value.sideId;
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

// Compute remaining seats robustly using capacity - occupied, with backend field fallback
function effectiveRemaining(slot){
  const cap = Math.max(0, Number(slot?.capacity ?? seatCols));
  // Derive used seats from segments (authoritative) when available
  let usedBySegments = 0;
  try {
    for (const seg of bookingSegments(slot)) usedBySegments += Math.max(0, Number(seg.length || 0));
  } catch {}
  const remBySegments = Math.max(0, cap - usedBySegments);
  // Backend-reported remaining as fallback
  const fieldRem = Number(slot?.remaining);
  const remByField = Number.isFinite(fieldRem) && fieldRem >= 0 ? fieldRem : 0;
  // Prefer the larger value; segments reflect UI occupancy more accurately
  return Math.max(remBySegments, remByField);
}

// Compute how many players can be added at this moment for a slot (1..remaining, capped at 4)
function maxPlayersForSlot(slot){
  const remaining = Math.max(0, effectiveRemaining(slot));
  const capacity = Math.max(0, Number(slot?.capacity ?? 4));
  const allowed = Math.min(4, Math.max(remaining, 1), capacity);
  // We want buttons 1..allowed
  return Array.from({ length: allowed }, (_, i) => i + 1);
}

// Build the select options across all tee sheets
const viewSelectOptions = computed(() => {
  const opts = [];
  for (const ts of (teeSheets.value || [])) {
    const sheetSides = sidesBySheet[ts.id] || [];
    if (Array.isArray(sheetSides) && sheetSides.length > 1) {
      opts.push({ value: `${ts.id}::split`, label: `${ts.name || 'Sheet'}: Split view` });
    }
    for (const sd of sheetSides) {
      opts.push({ value: `${ts.id}::side::${sd.id}`, label: `${ts.name || 'Sheet'}: ${sd.name}` });
    }
  }
  // Fallback if nothing built yet
  if (!opts.length && currentSheetId.value) {
    const nm = teeSheetName.value || 'Sheet';
    opts.push({ value: `${currentSheetId.value}::split`, label: `${nm}: Split view` });
    for (const sd of (sides.value || [])) opts.push({ value: `${currentSheetId.value}::side::${sd.id}`, label: `${nm}: ${sd.name}` });
  }
  return opts;
});

// Build booking segments for a slot: contiguous seats with same booking_id
function bookingSegments(slot){
  const result = [];
  const assigns = Array.isArray(slot.assignments) ? slot.assignments.slice(0, seatCols) : [];
  const seatBookingId = new Array(seatCols).fill(null);
  const seatAssn = new Array(seatCols).fill(null);
  for (let i = 0; i < seatCols; i++) {
    const a = assigns[i];
    const bid = a && a.booking_id ? a.booking_id : (a && a.round_leg && a.round_leg.booking ? a.round_leg.booking.id : null);
    seatBookingId[i] = bid || null;
    seatAssn[i] = a || null;
  }
  let idx = 0;
  while (idx < seatCols) {
    const bid = seatBookingId[idx];
    if (!bid) { idx += 1; continue; }
    const start = idx;
    let end = idx + 1;
    while (end < seatCols && seatBookingId[end] === bid) end += 1;
    const firstAssn = seatAssn[start];
    const ownerNm = (firstAssn && typeof firstAssn.owner_name === 'string') ? firstAssn.owner_name.trim() : '';
    // Build names ensuring the owner is shown first, then unique explicit names
    const explicitOrdered = [];
    for (let j = start; j < end; j++) {
      const a = seatAssn[j];
      const nmRaw = (typeof a?.customer_name === 'string' && a.customer_name.trim())
        ? a.customer_name.trim()
        : ((typeof a?.player_name === 'string' && a.player_name.trim()) ? a.player_name.trim() : '');
      if (!nmRaw) continue;
      if (ownerNm && nmRaw === ownerNm) continue; // skip duplicates of owner
      explicitOrdered.push(nmRaw);
    }
    const seen = new Set();
    const uniqueExplicit = [];
    for (const nm of explicitOrdered) {
      const key = nm.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueExplicit.push(nm);
      if (uniqueExplicit.length >= seatCols - 1) break;
    }
    const segFullNames = [];
    if (ownerNm) segFullNames.push(ownerNm);
    for (const nm of uniqueExplicit) segFullNames.push(nm);
    // If still short, fill remaining with Guest to match occupied seats count
    while (segFullNames.length < (end - start)) segFullNames.push('Guest');
    const segNames = segFullNames.map(n => (isSplit.value ? formatInitialLastCompact(n) : formatInitialLast(n)));
    const anyRide = (function(){
      for (let j = start; j < end; j++) {
        const a = seatAssn[j];
        const direct = a?.walk_ride ? String(a.walk_ride).toLowerCase() : '';
        const viaLeg = a?.round_leg?.walk_ride ? String(a.round_leg.walk_ride).toLowerCase() : '';
        if (direct === 'ride' || direct === 'riding' || viaLeg === 'ride' || viaLeg === 'riding') return true;
      }
      return false;
    })();
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
    const rawStatus = String(firstAssn?.status || firstAssn?.round_leg?.booking?.status || '').toLowerCase();
    const norm = rawStatus.includes('checked') ? 'checked-in' : (rawStatus === 'paid' ? 'paid' : (rawStatus === 'booked' || rawStatus === 'active' ? 'booked' : 'booked'));
    const statusClass = `status-${norm}`;
    result.push({
      key: `${slot.id || slot.start_time}:${bid}:${start}`,
      startSeat: start,
      length: segFullNames.length,
      names: segNames,
      fullNames: segFullNames,
      walkRide,
      holes,
      isReround,
      legIndex: (function(){ const li = typeof firstAssn?.leg_index === 'number' ? firstAssn.leg_index : (firstAssn?.round_leg?.leg_index || 0); return li || 0; })(),
      statusClass,
      bookingId: bid,
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

// Determine if a specific seat index (1-based) is empty for a slot
function isSeatEmpty(slot, seatIndex){
  const idx = Number(seatIndex) - 1;
  if (idx < 0 || idx >= seatCols) return false;
  // If any booking segment covers this seat, it's occupied
  for (const seg of bookingSegments(slot)) {
    if (idx >= seg.startSeat && idx < seg.startSeat + seg.length) return false;
  }
  // Fallback: treat first (capacity - remaining) seats as occupied (left-fill assumption)
  const used = Math.max(0, Number(slot?.capacity ?? seatCols) - effectiveRemaining(slot));
  if (seatIndex <= used) return false;
  return true;
}

// Label logic: show remaining capacity, capped at 4, but never more than seats available from this hovered seat to end
function hoverLabel(slot, seatIndex){
  const i = Math.max(1, Math.min(seatCols, Number(seatIndex) || 1));
  const remaining = Math.max(0, effectiveRemaining(slot));
  if (remaining <= 0) return 0;
  if (!isSeatEmpty(slot, i)) return 0;
  const hasSegments = (() => { try { return bookingSegments(slot).length > 0; } catch { return false; } })();
  if (hasSegments) {
    // Partially booked row: label by position among empty seats (left-to-right), capped by remaining
    const emptyList = [];
    for (let s = 1; s <= seatCols; s++) if (isSeatEmpty(slot, s)) emptyList.push(s);
    const pos = emptyList.indexOf(i) + 1; // 1..N
    if (pos <= 0) return 0;
    return Math.min(pos, remaining);
  }
  // Empty row: map columns 1..4 to +1..+4 (cap by remaining)
  return Math.min(i, remaining);
}

async function onViewModeChange(){
  try { localStorage.setItem('teeSheet:viewModeV2', viewMode.value); } catch {}
  const pv = parseViewValue(viewMode.value);
  if (pv.sheetId && pv.sheetId !== currentSheetId.value) {
    currentSheetId.value = pv.sheetId;
    try { localStorage.setItem('teeSheet:lastSheet', currentSheetId.value); } catch {}
    teeSheetName.value = (teeSheets.value.find(s => s.id === currentSheetId.value)?.name) || '';
    await load({ preserveSheet: true });
  }
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
  load({ preserveSheet: true });
}

function shiftDay(delta){
  const d = new Date(date.value + 'T00:00:00');
  d.setDate(d.getDate() + Number(delta||0));
  date.value = d.toISOString().substring(0,10);
  load({ preserveSheet: true });
}

function openDatePicker(){
  try { datePicker.value && datePicker.value.showPicker ? datePicker.value.showPicker() : datePicker.value.click(); } catch { /* fallback click */ try { datePicker.value && datePicker.value.click(); } catch {} }
}

function onDatePicked(){
  load({ preserveSheet: true });
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

function templateColor(slot){
  const c = (slot && slot.template_color) || '';
  if (typeof c === 'string' && c.trim()) return c;
  return '#e5e7eb';
}

async function load(opts = {}) {
  const preserveSheet = !!opts.preserveSheet;
  // Ensure a tee sheet id is selected; fallback to first available
  let teeSheetId = currentSheetId.value || localStorage.getItem('teeSheet:lastSheet');
  if (!teeSheetId) {
    try {
      const { data } = await settingsAPI.listTeeSheets();
      teeSheets.value = Array.isArray(data) ? data : [];
      if (teeSheets.value.length) {
        teeSheetId = teeSheets.value[0].id;
        teeSheetName.value = teeSheets.value[0].name || '';
        currentSheetId.value = teeSheetId;
        try { localStorage.setItem('teeSheet:lastSheet', teeSheetId); } catch {}
      }
    } catch {}
  }
  if (!teeSheetId) { slots.value = []; return; }
  // If we have an id but no name yet, attempt to resolve it
  if (!teeSheetName.value) {
    try {
      const { data: sheets } = await settingsAPI.listTeeSheets();
      teeSheets.value = Array.isArray(sheets) ? sheets : [];
      const found = teeSheets.value.find(s => s?.id === teeSheetId);
      if (found) teeSheetName.value = found.name || '';
    } catch {}
  }
  try {
    const { data: sideList } = await settingsAPI.listSides(teeSheetId);
    sides.value = Array.isArray(sideList) ? sideList : [];
    sidesBySheet[teeSheetId] = sides.value;
    // Initialize view selection if empty
    if (!viewMode.value) {
      if (sides.value.length > 1) {
        viewMode.value = `${teeSheetId}::split`;
      } else if (sides.value.length === 1) {
        viewMode.value = `${teeSheetId}::side::${sides.value[0].id}`;
      }
      try { localStorage.setItem('teeSheet:viewModeV2', viewMode.value); } catch {}
    }
  } catch { sides.value = []; }
  const params = { date: date.value, teeSheets: teeSheetId, customerView: 'false', classId: 'Full', groupSize: '1' };
  try {
    const res = await api.get('/tee-times/available', { params });
    let data = res.data || [];
    // If no slots, probe other sheets to auto-select one that has slots for this date
    if ((!Array.isArray(data) || data.length === 0) && !preserveSheet) {
      try {
        const { data: sheets } = await settingsAPI.listTeeSheets();
        teeSheets.value = Array.isArray(sheets) ? sheets : [];
        if (teeSheets.value.length) {
          for (const s of teeSheets.value) {
            if (!s?.id || s.id === teeSheetId) continue;
            const probe = await api.get('/tee-times/available', { params: { ...params, teeSheets: s.id } });
            const probeList = probe.data || [];
            if (Array.isArray(probeList) && probeList.length) {
              data = probeList;
              teeSheetId = s.id;
              teeSheetName.value = s.name || teeSheetName.value;
              currentSheetId.value = teeSheetId;
              try { localStorage.setItem('teeSheet:lastSheet', teeSheetId); } catch {}
              // Set a sensible default selection for the newly chosen sheet
              try {
                const { data: otherSides } = await settingsAPI.listSides(teeSheetId);
                sidesBySheet[teeSheetId] = Array.isArray(otherSides) ? otherSides : [];
                if (sidesBySheet[teeSheetId].length > 1) viewMode.value = `${teeSheetId}::split`;
                else if (sidesBySheet[teeSheetId].length === 1) viewMode.value = `${teeSheetId}::side::${sidesBySheet[teeSheetId][0].id}`;
                localStorage.setItem('teeSheet:viewModeV2', viewMode.value);
              } catch {}
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
  // Background: fetch sides for all sheets to populate view options
  if (!teeSheets.value.length) {
    try { const { data: sheets } = await settingsAPI.listTeeSheets(); teeSheets.value = Array.isArray(sheets) ? sheets : []; } catch {}
  }
  try {
    await Promise.all((teeSheets.value || []).map(async s => {
      if (!s?.id || sidesBySheet[s.id]) return;
      try { const { data: sList } = await settingsAPI.listSides(s.id); sidesBySheet[s.id] = Array.isArray(sList) ? sList : []; } catch {}
    }));
  } catch {}
}

function openAdd(slot) {
  resetBookingForm();
  draftSlot.value = slot;
  holes.value = 18;
  players.value = 1;
  walkRide.value = 'walk';
  syncExtraPlayersForCurrentCount();
  // Open in side drawer instead of modal
  selectedSlot.value = slot;
  bookingInDrawer.value = true;
  actionsOpen.value = false;
  drawerOpen.value = true;
  bookingOpen.value = false;
  // If 18 is not feasible for this slot, default to 9 to avoid misleading selection
  if (!canBook18ForDraft.value) holes.value = 9;
}

function openAddWithPlayers(slot, n){
  resetBookingForm();
  draftSlot.value = slot;
  holes.value = 18;
  players.value = Math.max(1, Math.min(4, Number(n||1)));
  walkRide.value = 'walk';
  syncExtraPlayersForCurrentCount();
  selectedSlot.value = slot;
  bookingInDrawer.value = true;
  actionsOpen.value = false;
  drawerOpen.value = true;
  bookingOpen.value = false;
  if (!canBook18ForDraft.value) holes.value = 9;
}

function onSeatClick(slot, seatIndex){
  const n = hoverLabel(slot, seatIndex);
  if (n > 0) openAddWithPlayers(slot, n);
}

function closeBooking(){
  bookingOpen.value = false;
  draftSlot.value = null;
  // Clear lead input and selection on close
  resetBookingForm();
}

const leadSelectedLabel = computed(() => leadSelected.value ? leadSelected.value.label : '');
const canReserve = computed(() => !!draftSlot.value && players.value >= 1 && players.value <= maxPlayersForDraft.value && (leadSelected.value || !!leadName.value.trim() || !!leadQuery.value.trim()));
const reserveDisabledReason = computed(() => {
  if (!draftSlot.value) return 'No slot selected';
  if (players.value < 1 || players.value > maxPlayersForDraft.value) return `Players must be 1-${maxPlayersForDraft.value}`;
  if (!leadName.value.trim()) return 'Lead name required';
  return '';
});

function resetBookingForm(){
  leadSelected.value = null;
  leadQuery.value = '';
  leadName.value = '';
  leadOpen.value = false;
  extraPlayers.value = [];
  hasPlayerEdits.value = false;
}

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
      players: Array.from({ length: players.value }).map((_, i) => {
        if (i === 0) {
          return {
            customer_id: leadSelected.value?.id || null,
            name: leadSelected.value ? '' : (leadName.value || leadQuery.value || ''),
            email: '',
            walkRide: walkRide.value,
          };
        }
        const row = extraPlayers.value[i - 1] || { selected: null, query: '' };
        return {
          customer_id: row.selected?.id || null,
          name: row.selected ? '' : (row.query || ''),
          email: '',
          walkRide: walkRide.value,
        };
      }),
      legs: [{ tee_time_id: draftSlot.value.id, round_option_id: null, leg_index: 0 }],
    };
    if (leadSelected.value && leadSelected.value.id) {
      body.owner_customer_id = leadSelected.value.id;
    }
    console.log('Reserve payload', body);
    await bookingsAPI.create(body);
    showToast('Reserved');
    if (bookingInDrawer.value) {
      bookingInDrawer.value = false;
      drawerOpen.value = false;
      resetBookingForm();
      draftSlot.value = null;
    } else {
      closeBooking();
    }
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
  // Mark players tab dirty on change
  hasPlayerEdits.value = true;
});

function syncExtraPlayersForCurrentCount(){
  const needed = Math.max(0, Number(players.value || 1) - 1);
  const arr = [];
  for (let i = 0; i < needed; i++) arr.push({ query: '', open: false, selected: null, options: [] });
  extraPlayers.value = arr;
}

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
  hasPlayerEdits.value = true;
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
  hasPlayerEdits.value = true;
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

// Compact version for tight layouts: initial + truncated last name (max 8 chars)
function formatInitialLastCompact(label){
  if (!label || label === 'Guest') return 'Guest';
  const parts = String(label).trim().split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join(' ');
  const initial = first ? first.charAt(0).toUpperCase() + '.' : '';
  const max = 8;
  const trunc = last.length > max ? last.slice(0, max - 1) + '…' : last;
  return `${initial} ${trunc}`.trim();
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

// Save changes made in Players tab to the booking (currently supports player add/remove)
async function savePlayerEdits() {
  if (!selectedBookingId.value) { showToast('No booking selected'); return; }
  // Compute delta players vs initial
  const delta = Number(players.value || 1) - Number(initialPlayersCount.value || 1);
  try {
    busy.value = true;
    // Build desired players array to persist names/ids
    const desired = [];
    // Lead
    desired.push({
      customer_id: leadSelected.value?.id || null,
      name: leadSelected.value ? '' : (leadName.value || leadQuery.value || ''),
      email: '',
    });
    // Extras
    for (let i = 0; i < Math.max(0, players.value - 1); i++) {
      const row = extraPlayers.value[i] || { selected: null, query: '' };
      desired.push({
        customer_id: row.selected?.id || null,
        name: row.selected ? '' : (row.query || ''),
        email: '',
      });
    }
    const payload = { players: desired };
    // Also include add/remove so backend can capacity-check before reconciliation
    if (delta > 0) payload.add = delta; else if (delta < 0) payload.remove = Math.abs(delta);
    // Include holes change if toggled (backend will add/remove second leg accordingly)
    if (Number(initialHoles.value) !== Number(holes.value)) payload.holes = Number(holes.value);
    await bookingsAPI.editPlayers(selectedBookingId.value, payload);
    // TODO: walk/ride and holes edits would require additional endpoints (not yet available)
    showToast('Saved');
    hasPlayerEdits.value = false;
    initialPlayersCount.value = players.value;
    initialHoles.value = holes.value;
    await load();
  } catch (e) {
    // Show specific backend error when available and revert invalid change
    const msg = (e && e.response && (e.response.data?.error || e.response.data?.message)) || e.message || 'Save failed';
    showToast(msg);
    // Revert players on validation failures
    if (/Minimum players not met/i.test(msg) || /Window not open/i.test(msg) || /No calendar assignment/i.test(msg)) {
      players.value = initialPlayersCount.value;
    }
  } finally {
    busy.value = false;
  }
}

function openDrawer(slot, seg) {
  selectedSlot.value = slot;
  activeTab.value = 'Players';
  // Seed form from clicked booking segment if available
  try {
    selectedBookingId.value = seg?.bookingId || null;
    clickedLegIndex.value = typeof seg?.legIndex === 'number' ? seg.legIndex : 0;
    const names = Array.isArray(seg?.fullNames) ? seg.fullNames : (Array.isArray(seg?.names) ? seg.names : []);
    const playerCount = Math.max(1, names.length || occupiedCount(slot));
    players.value = Math.min(playerCount, seatCols);
    syncExtraPlayersForCurrentCount();
    // Lead player
    leadSelected.value = null;
    leadName.value = names[0] && names[0] !== 'Guest' ? names[0] : '';
    leadQuery.value = leadName.value;
    // Extra players
    for (let i = 1; i < players.value; i++) {
      const nm = names[i] || '';
      const row = extraPlayers.value[i - 1];
      if (row) {
        row.selected = null;
        row.query = nm && nm !== 'Guest' ? nm : '';
        row.open = false;
        row.options = [];
      }
    }
    // Meta
    holes.value = seg?.holes === 18 ? 18 : 9;
    walkRide.value = seg?.walkRide === 'ride' ? 'ride' : 'walk';
    // Capture initial state for change tracking
    initialPlayersCount.value = players.value;
    initialHoles.value = holes.value;
    initialWalkRide.value = walkRide.value;
    hasPlayerEdits.value = false;
    // Build reround players list: if clicked first leg (0) find the next segment of same booking; if second leg (1) find previous
    reroundPlayers.value = [];
    try {
      const all = bookingSegments(slot).filter(s => s.bookingId === (seg?.bookingId || null));
      if (all.length >= 2) {
        // Sort by startSeat to ensure order left->right
        all.sort((a,b)=>a.startSeat-b.startSeat);
        const idx = all.findIndex(s => s.startSeat === seg.startSeat && s.length === seg.length);
        const opposite = clickedLegIndex.value === 0 ? all[idx+1] : all[idx-1];
        if (opposite && Array.isArray(opposite.fullNames)) reroundPlayers.value = opposite.fullNames;
      }
    } catch {}
  } catch {}
  actionsOpen.value = false;
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

function promptCancelBooking(){
  if (!selectedBookingId.value) { showToast('No booking selected'); return; }
  confirmCancelOpen.value = true;
}

async function confirmCancel(){
  if (!selectedBookingId.value) { confirmCancelOpen.value = false; return; }
  try {
    busy.value = true;
    await bookingsAPI.cancel(selectedBookingId.value);
    showToast('Booking canceled');
    actionsOpen.value = false;
    confirmCancelOpen.value = false;
    drawerOpen.value = false;
    bookingInDrawer.value = false;
    await load();
  } catch (e) {
    const msg = e?.response?.data?.error || 'Failed to cancel booking';
    showToast(msg);
    confirmCancelOpen.value = false;
  } finally {
    busy.value = false;
  }
}
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
// Close actions menu when drawer closes
watch(drawerOpen, (isOpen) => {
  if (!isOpen) actionsOpen.value = false;
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
.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-bottom: 12px; position: sticky; top: 64px; z-index: 20; background: #fff; padding-top: 8px; padding-bottom: 8px; box-shadow: 0 1px 0 rgba(0,0,0,0.06); margin-left: -16px; margin-right: -16px; padding-left: 16px; padding-right: 16px; }
.col-header { flex: 1 0 100%; order: 2; display: grid; grid-template-columns: 120px repeat(4, 1fr); background:#fafafa; height:36px; border-top:1px solid #eee; border-bottom:none; margin-left:-16px; margin-right:-16px; margin-top: 8px; }
.col-header .cell{ padding:6px 8px; font-size:14px; font-weight:400; border-left:1px solid #eee; display:flex; align-items:center; }
.col-header .cell.time{ border-left:none; padding-left: 16px; }
.controls { --ctl-h: 38px; }
.date-controls { display: flex; gap: 8px; align-items: center; }
.date-controls .link { background: transparent; border: 1px solid transparent; color: #111827; height: var(--ctl-h); padding: 0 12px; display: inline-flex; align-items: center; cursor: pointer; border-radius: 8px; transition: background .15s, color .15s; }
.date-controls .link:hover { background: #eef2ff; color: #3730a3; }
.date-controls .link .arrow { color: #6366f1; margin-right: 6px; }
.date-controls .icon { background: #fff; border: 1px solid #ddd; border-radius: 8px; width: var(--ctl-h); height: var(--ctl-h); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.date-controls .icon:hover { background: #f9fafb; }
.date-controls .date-display { background: #fff; border: 1px solid #ddd; border-radius: 8px; height: var(--ctl-h); padding: 0 12px; display: inline-flex; align-items: center; cursor: pointer; }
.date-controls .date-display .caret { margin-left: 6px; color: #6b7280; }
.hidden-date { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
.grid { border: none; border-radius: 0; overflow: hidden; --row-h: 44px; margin-left: -16px; margin-right: -16px; }
.row { display: grid; grid-template-columns: 120px repeat(4, 1fr); border-top: 1px solid #f1f3f6; position: relative; }
.row .tpl-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 8px; z-index: 0; }
/* Ensure first row renders its own top border (header has no bottom border) */
.row::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 0.5px; background: #f1f3f6; }
.row:not(.header) { height: var(--row-h); }
.row.header { background: #fafafa; border-top: 1px solid #eee; border-bottom: 1px solid #eee; height: 36px; }
.cell { padding: 6px 8px; border-left: 1px solid #eee; font-size: 16px; }
.row.header .cell { font-size: 14px; font-weight: 400; }
.cell.time { border-left: none; white-space: nowrap; font-size: 18px; display: flex; align-items: center; padding-left: 16px; }
.cell.seat { min-height: 36px; display: flex; align-items: center; }
.split { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.split-col { display: flex; flex-direction: column; gap: 8px; }
.split-title { font-weight: 600; padding: 4px 2px; }
.grid.mini { margin-left: -16px; margin-right: -16px; }
.grid.mini .row { display: grid; grid-template-columns: 110px repeat(4, 1fr); }
/* Split view/narrow: hide walk/ride/re-round icons to prevent overlap and allow more room */
.grid.mini .booking-chip .info { display: none; }
/* Split view/narrow: remove per-player badge and tighten padding */
.grid.mini .booking-chip .player-cell .badge { display: none; }
.grid.mini .booking-chip .names { gap: 8px; }
.grid.mini .booking-chip .player-cell { padding-left: 10px; gap: 6px; }
.grid.mini .booking-chip .player-cell:first-child { padding-left: 32px; }
.grid.mini .booking-chip .names .player-cell:nth-child(n+2) { padding-left: 12px; }
/* Split view/narrow: let names flex and truncate with ellipsis; slightly smaller font */
.grid.mini .booking-chip .player-cell .nm { min-width: 0; max-width: 100%; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 16px; }
/* Hide legacy add buttons (replaced with hover +N) */
.add { display:none; }
/* Seat hit areas: cover full cell, show +N only on hovered cell */
.seat-hit { position: relative; height: 100%; width: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer; grid-row: 1; z-index: 1; border: 1px dashed transparent; border-radius: 8px; transition: background .12s ease-in-out, border-color .12s ease-in-out; }
.seat-hit.disabled { cursor: default; }
.seat-hit .hover-label { opacity: 0; transform: translateY(2px); transition: opacity .12s ease-in-out, transform .12s ease-in-out; color: #0f172a; font-weight: 700; font-size: 12px; padding: 0; pointer-events: none; }
.row:hover .seat-hit:hover { background: #f1f5f9; border-color: #cbd5e1; }
.row:hover .seat-hit:hover .hover-label { opacity: 1; transform: translateY(0); }
.chip { font-size: 12px; padding: 4px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; }
.chip .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: currentColor; }
.chip.active { background: #e8f8ef; color: #1a7f37; border-color: #bde5cd; }
/* booking spanning chip styled as grid item inside row */
.booking-chip { display: grid; align-items: center; gap: 0; font-size: 14px; padding: 4px 0; border-radius: 6px; background: #e8f8ef; color: #1a7f37; grid-row: 1; position: relative; margin: 0; height: 100%; line-height: 1.2; box-sizing: border-box; z-index: 2; border: 1px solid rgba(189,229,205,0.6); }
.booking-chip.status-booked { background: #fef9c3; color: #854d0e; border-color: rgba(250,204,21,0.35); }
.booking-chip.status-paid { background: #dbeafe; color: #1e3a8a; border-color: rgba(147,197,253,0.40); }
.booking-chip.status-checked-in { background: #dcfce7; color: #166534; border-color: rgba(134,239,172,0.45); }
.booking-chip .leftbar { position: absolute; left: 0; top: 0; bottom: 0; width: 28px; background: rgba(250, 204, 21, 0.28); border-right: 1px solid rgba(250, 204, 21, 0.5); display: flex; align-items: center; justify-content: center; }
.booking-chip .leftbar .holes { font-weight: 800; color: #854d0e; font-size: 18px; }
.booking-chip .names { display: grid; width: 100%; gap: 0; justify-items: start; padding-left: 0; }
.booking-chip .player-cell { display: inline-flex; align-items: center; gap: 8px; padding: 2px 10px; padding-left: 32px; min-width: 0; }
.booking-chip .names .player-cell:nth-child(n+2) { padding-left: 34px; }
.booking-chip .player-cell .nm { display: inline-block; min-width: 160px; }
.booking-chip .player-cell .badge { width: 28px; height: 28px; border-radius: 50%; background: rgba(250, 204, 21, 0.35); color: #854d0e; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex: 0 0 auto; }
.booking-chip .player-cell .nm { text-align: left; font-size: 21px; font-weight: 400; }
.booking-chip .player-cell .nm.strong { font-weight: 600; }
.booking-chip .names .player-cell:last-child { padding-right: 28px; }
.booking-chip .info { position: absolute; right: 8px; display: inline-flex; gap: 6px; }
.toast { position: fixed; bottom: 16px; right: 16px; background: rgba(0,0,0,0.8); color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 13px; z-index: 4000; }
.drawer { position: fixed; top: 0; right: 0; width: 420px; height: 100vh; background: #fff; box-shadow: -2px 0 8px rgba(0,0,0,0.1); display: flex; flex-direction: column; z-index: 2000; }
.drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #eee; }
.drawer-header .drawer-actions { display:flex; align-items:center; gap:6px; position: relative; }
.drawer-header .drawer-actions .icon-btn { width: 36px; height: 36px; display:inline-flex; align-items:center; justify-content:center; border-radius:6px; border:1px solid transparent; background: transparent; cursor:pointer; }
.drawer-header .drawer-actions .icon-btn:focus { outline: none; border-color: #cbd5e1; }
.actions-menu { position:absolute; top: 42px; right: 40px; width: 220px; background:#fff; border:1px solid #e5e7eb; box-shadow: 0 6px 18px rgba(0,0,0,0.12); border-radius:8px; padding:8px; z-index: 2100; }
.actions-menu hr { border: none; border-top: 1px solid #eee; margin: 8px 0; }
.actions-menu .full { width: 100%; text-align: left; padding:8px 10px; background:transparent; border:none; cursor:pointer; border-radius:6px; }
.actions-menu .full:hover { background:#f3f4f6; }
.actions-menu .danger { background:#fee2e2; color:#991b1b; }
.actions-menu .danger:hover { background:#fecaca; }
.actions-menu .reason { margin-top: 6px; }
.actions-menu .reason input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 6px; }
.confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index: 2200; }
.confirm-dialog { background:#fff; border-radius:10px; border:1px solid #e5e7eb; box-shadow: 0 8px 24px rgba(0,0,0,0.18); width: 360px; max-width: calc(100vw - 32px); padding:16px; }
.confirm-title { font-weight: 700; margin-bottom: 8px; }
.confirm-actions { display:flex; gap:8px; justify-content:flex-end; margin-top: 12px; }
.confirm-actions .danger { background:#ef4444; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; }
.confirm-actions button { background:#f3f4f6; color:#111827; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; }
.drawer-title { display: flex; flex-direction: column; gap: 2px; }
.drawer-time { font-size: 28px; font-weight: 800; line-height: 1.1; }
.drawer-meta { color: #6b7280; font-size: 12px; }
.close { background: transparent; border: none; font-size: 18px; cursor: pointer; }
.tabs { display: flex; gap: 6px; padding: 8px 8px 0; border-bottom: 1px solid #eee; }
.tab { padding: 6px 8px; border: none; background: transparent; cursor: pointer; border-bottom: 2px solid transparent; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; }
.tab.active { border-color: #42b883; color: #2c3e50; font-weight: 600; }
/* hide text but keep for screen readers */
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.panel { padding: 12px 16px; overflow: auto; flex: 1 1 auto; }
.drawer-footer { padding: 10px 16px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 8px; }
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
/* Base label and inputs; detailed border/focus handled by global .form-outline in App.vue */
.form-grid label { font-size: 14px; letter-spacing: .02em; color: #6b7280; font-weight: 600; }
.form-grid input, .form-grid select { padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; box-sizing: border-box; font-family: var(--font-body, inherit); font-size: 16px; background: #fff; }
.form-grid input:focus, .form-grid select:focus { outline: none; border-color: #1d4ed8; box-shadow: none; }
.combo { position: relative; width: 100%; }
.combo { position: relative; }
.dropdown { position: absolute; left: 0; right: 0; top: calc(100% + 4px); background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,0.08); z-index: 1100; max-height: 220px; overflow: auto; }
.opt { padding: 6px 10px; cursor: pointer; line-height: 1.2; }
.opt:hover { background: #f6f7f9; }
.opt .name { font-weight: 600; }
.opt .email { color: #6b7280; font-size: 12px; }
.player-circles { display: flex; gap: 12px; align-items: center; }
.player-circles .circle { width: 48px; height: 48px; border-radius: 50%; background: #fff; border: 1px solid #d1d5db; color: #111827; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; line-height: 1; cursor: pointer; transition: background .15s, color .15s, border-color .15s, transform .08s; }
.player-circles .circle:hover { background: #f3f4f6; }
.player-circles .circle:active { transform: scale(0.98); }
.player-circles .circle.active { background: #ccf9ff; color: #111827; border-color: #99e6f5; }
.player-circles .circle.disabled, .player-circles .circle:disabled { cursor: not-allowed; opacity: .55; background: #f5f5f5; border-color: #e5e7eb; pointer-events: none; }
.player-circles .circle.disabled:hover, .player-circles .circle:disabled:hover { background: #f5f5f5; }
.seg { display: inline-flex; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
.seg__btn { padding: 6px 10px; border: none; background: #fff; cursor: pointer; }
.seg__btn.active { background: #eef6ff; color: #1d4ed8; }
.seg__btn.disabled, .seg__btn:disabled { cursor: not-allowed; color: #9ca3af; background: #f3f4f6; pointer-events: none; }
.seg__btn.disabled:hover, .seg__btn:disabled:hover { background: #f3f4f6; }
.actions-row { display: flex; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid #eee; }
.drawer-footer { display: flex; justify-content: space-between; padding: 12px 16px; border-top: 1px solid #eee; }

/* Icon-only button for settings */
.icon-btn { background: #fff; border: 1px solid #ddd; border-radius: 8px; width: var(--ctl-h); height: var(--ctl-h); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.icon-btn:hover { background: #f9fafb; }

/* Styled select with caret for view selector */
.select-wrap { position: relative; display: inline-block; }
.view-select { appearance: none; -webkit-appearance: none; background: #fff; border: 1px solid #ddd; border-radius: 8px; height: var(--ctl-h); padding: 0 28px 0 12px; font-size: 14px; line-height: var(--ctl-h); }
.select-wrap .caret { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #6b7280; pointer-events: none; }
/* Wide screen overrides for split view: restore badges/icons and font size */
@media (min-width: 1500px) {
  .grid.mini .booking-chip .info { display: inline-flex; }
  .grid.mini .booking-chip .player-cell .badge { display: inline-flex; }
  .grid.mini .booking-chip .player-cell { padding-left: 32px; gap: 8px; }
  .grid.mini .booking-chip .player-cell:first-child { padding-left: 32px; }
  .grid.mini .booking-chip .names .player-cell:nth-child(n+2) { padding-left: 34px; }
  .grid.mini .booking-chip .player-cell .nm { font-size: 21px; }
  .grid.mini .booking-chip .names { gap: 0; }
}

/* Medium screens: show badges, hide right-side icons, moderate font size */
@media (min-width: 900px) and (max-width: 1499px) {
  .grid.mini .booking-chip .info { display: none; }
  .grid.mini .booking-chip .player-cell .badge { display: inline-flex; }
  .grid.mini .booking-chip .player-cell { padding-left: 28px; gap: 6px; }
  .grid.mini .booking-chip .player-cell:first-child { padding-left: 28px; }
  .grid.mini .booking-chip .names .player-cell:nth-child(n+2) { padding-left: 30px; }
  .grid.mini .booking-chip .player-cell .nm { font-size: 18px; }
  .grid.mini .booking-chip .names { gap: 6px; }
}
</style>


