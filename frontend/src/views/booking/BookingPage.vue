<template>
  <div class="booking-page" data-cy="booking-page">
    <!-- Header -->
    <header class="bk-header">
      <button class="menu-toggle" @click="menuOpen = true" aria-label="Open menu">
        <v-icon class="icon" :icon="'fa:fal fa-bars'" />
      </button>
      <div class="title">
        <div class="course">{{ courseName || formattedSlug }}</div>
        <div class="subtitle">Book Your Tee Time</div>
      </div>
      <button class="filter-toggle" @click="drawerOpen = true" aria-label="Open filters">
        <v-icon class="icon" :icon="'fa:fal fa-filter'" />
      </button>
    </header>

    <div class="content">
      <!-- Desktop left nav -->
      <aside class="leftnav">
        <button class="ln-item" @click="goBook()"><v-icon :icon="'fa:fal fa-calendar'" class="ico" /> Book Tee Time</button>
        <button class="ln-item" @click="goMine()"><v-icon :icon="'fa:fal fa-user'" class="ico" /> My Tee Times</button>
        <button v-if="!isAuthed" class="ln-item" @click="openLogin"><v-icon :icon="'fa:fal fa-right-to-bracket'" class="ico" /> Sign In</button>
        <button v-else class="ln-item" @click="doLogout"><v-icon :icon="'fa:fal fa-right-from-bracket'" class="ico" /> Logout</button>
      </aside>
      <!-- Filters -->
      <aside class="filters">
        <div class="card">
          <div class="card-title">Filters</div>
          <div class="grp">
            <div class="label">Holes</div>
            <div class="seg">
              <button :class="['seg-btn', { active: holes === 9 }]" @click="setHoles(9)">9</button>
              <button :class="['seg-btn', { active: holes === 18 }]" @click="setHoles(18)">18</button>
            </div>
          </div>
          <div class="grp">
            <div class="label">Starting Side</div>
            <div class="seg">
              <button v-for="sd in sidesDisplay" :key="sd.id" :class="['seg-btn', { active: sidePref === sd.id }]" @click="setSide(sd.id)">{{ sd.name }}</button>
            </div>
          </div>
          <div class="grp">
            <div class="label">Players</div>
            <div class="seg">
              <button v-for="n in 4" :key="n" :class="['seg-btn', { active: groupSize === n }]" @click="setGroupSize(n)">{{ n }}</button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Results -->
      <main class="results">
        <div class="sticky-wrap">
        <div class="datebar">
          <div class="top">
            <button class="nav" @click="shiftDate(-1)"><v-icon :icon="'fa:fal fa-chevron-left'" /></button>
            <div class="date">
              <div class="dmy">{{ dateDisplay }}</div>
              <div class="dow">{{ weekday }}</div>
            </div>
            <button class="nav" @click="shiftDate(1)"><v-icon :icon="'fa:fal fa-chevron-right'" /></button>
          </div>
          <div class="divider" />
          <div class="info">
            <div class="left">
              <div class="item"><v-icon :icon="'fa:fal fa-cloud'" class="ico" /> {{ temperatureF != null ? (temperatureF + '°F') : '--' }}</div>
              <div class="item"><v-icon :icon="'fa:fal fa-wind'" class="ico" /> {{ windPlaceholder }}</div>
            </div>
            <div class="vsep" />
            <div class="right">
              <div class="item"><v-icon :icon="'fa:fal fa-sunrise'" class="ico" /> {{ sunriseDisplay || '--:--' }}</div>
              <div class="item"><v-icon :icon="'fa:fal fa-sunset'" class="ico" /> {{ sunsetDisplay || '--:--' }}</div>
            </div>
          </div>
        </div>

      <!-- Tee sheet selector -->
      <div class="sheetbar" v-if="sheetOptions.length > 1">
        <div class="select-wrap">
          <select v-model="selectedSheetId" class="select">
            <option v-for="opt in sheetOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
          </select>
          <v-icon class="chev" :icon="'fa:fal fa-chevron-down'" />
        </div>
      </div>
      </div>

        <div class="slot-list">
          <div v-if="loading" class="empty">Loading…</div>
          <div v-else-if="slots.length === 0" class="empty">No tee times available. Please try a different day.</div>
          <div v-else v-for="slot in displayedSlots" :key="slot.id" class="slot-card" @click="openDetail(slot)">
            <div class="slot-main">
              <div class="time">{{ timeLocal(slot.start_time) }}</div>
              <div class="meta">
                <span class="meta-item"><v-icon :icon="'fa:fal fa-flag'" class="mi" /> <span>{{ holesLabel(slot) }}</span></span>
                <span class="sep" aria-hidden="true"></span>
                <span class="meta-item"><span>{{ sideName(slot.side_id) }}</span></span>
                <span class="sep" aria-hidden="true"></span>
                <span class="meta-item"><v-icon :icon="'fa:fal fa-users'" class="mi" /> <span>{{ slot.remaining }}</span></span>
              </div>
            </div>
            <div class="price-badge">{{ priceDisplay(slot) }}</div>
          </div>
        </div>
      </main>
    </div>

    <!-- Mobile Filters Drawer (right side) -->
    <div v-if="drawerOpen" class="drawer-backdrop" @click="drawerOpen = false"></div>
    <aside class="drawer" :class="{ open: drawerOpen }" aria-label="Filters">
      <div class="drawer-header">
        <div class="drawer-title">Filters</div>
        <button class="close" @click="drawerOpen = false" aria-label="Close">✕</button>
      </div>
      <div class="drawer-body">
        <div class="grp">
          <div class="label">Holes</div>
          <div class="seg">
            <button :class="['seg-btn', { active: holes === 9 }]" @click="setHoles(9); drawerOpen=false">9</button>
            <button :class="['seg-btn', { active: holes === 18 }]" @click="setHoles(18); drawerOpen=false">18</button>
          </div>
        </div>
        <div class="grp">
          <div class="label">Starting Side</div>
          <div class="seg">
            <button v-for="sd in sidesDisplay" :key="sd.id" :class="['seg-btn', { active: sidePref === sd.id }]" @click="setSide(sd.id); drawerOpen=false">{{ sd.name }}</button>
          </div>
        </div>
        <div class="grp">
          <div class="label">Players</div>
          <div class="seg">
            <button v-for="n in 4" :key="n" :class="['seg-btn', { active: groupSize === n }]" @click="setGroupSize(n); drawerOpen=false">{{ n }}</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Mobile Left Menu Drawer -->
    <div v-if="menuOpen" class="drawer-backdrop" @click="menuOpen=false"></div>
    <aside class="drawer left" :class="{ open: menuOpen }" aria-label="Menu">
      <div class="drawer-header">
        <div class="drawer-title">Menu</div>
        <button class="close" @click="menuOpen=false" aria-label="Close">✕</button>
      </div>
      <div class="drawer-body">
        <button class="ln-item full" @click="goBook(); menuOpen=false"><v-icon :icon="'fa:fal fa-calendar'" class="ico" /> Book Tee Time</button>
        <button class="ln-item full" @click="goMine(); menuOpen=false"><v-icon :icon="'fa:fal fa-user'" class="ico" /> My Tee Times</button>
        <button v-if="!isAuthed" class="ln-item full" @click="menuOpen=false; openLogin()"><v-icon :icon="'fa:fal fa-right-to-bracket'" class="ico" /> Sign In</button>
        <button v-else class="ln-item full" @click="menuOpen=false; doLogout()"><v-icon :icon="'fa:fal fa-right-from-bracket'" class="ico" /> Logout</button>
      </div>
    </aside>

    <!-- Simple auth modal for customer login -->
    <div v-if="authOpen" class="modal-backdrop" @click="authOpen=false"></div>
    <div v-if="authOpen" class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="drawer-title">Sign In</div>
        <button class="close" @click="authOpen=false">✕</button>
      </div>
      <div class="modal-body">
        <div class="row"><input v-model="authForm.email" class="inp" placeholder="Email" type="email" /></div>
        <div class="row"><input v-model="authForm.password" class="inp" placeholder="Password" type="password" /></div>
        <div v-if="authError" class="err">{{ authError }}</div>
      </div>
      <div class="modal-actions">
        <button class="reserve" @click="submitLogin">Sign In</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { teeTimesAPI, bookingAPI, customerAuthAPI, apiUtils, authAPI } from '@/services/api'

const route = useRoute()
const router = useRouter()
const drawerOpen = ref(false)
const menuOpen = ref(false)

// Course
const courseSlug = computed(() => String(route.params?.courseSlug || route.query?.course || route.query?.courseSlug || localStorage.getItem('cust:courseSlug') || '').trim())
const courseName = ref('')
const formattedSlug = computed(() => courseSlug.value ? courseSlug.value.replace(/[-_]/g,' ').replace(/\b\w/g, c => c.toUpperCase()) : '')

// Sheets & sides
const teeSheetIds = ref([])
const sheetOptions = ref([])
const selectedSheetId = ref('')
const sideIdToName = ref({})

// Filters/state
const dateISO = ref(new Date().toISOString().substring(0,10))
const holes = ref(null) // 9 or 18
const sidePref = ref(null) // side_id
const groupSize = ref(null) // 1..4

const slots = ref([])
const displayedSlots = computed(() => {
  let arr = Array.isArray(slots.value) ? slots.value : []
  // Hide tee times with no remaining capacity
  arr = arr.filter(s => Number(s?.remaining ?? 0) > 0)
  if (holes.value === 18) {
    arr = arr.filter(s => !!(s?.allows_18 || s?.can_start_18 || String(s?.holes_label || '').includes('18')))
  }
  return arr
})
const loading = ref(false)
const isAuthed = ref(false)
const authOpen = ref(false)
const authForm = ref({ email: '', password: '' })
const authError = ref('')

const weekday = computed(() => new Date(dateISO.value + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' }))
const dateDisplay = computed(() => new Date(dateISO.value + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }))

function shiftDate(delta) {
  const d = new Date(dateISO.value + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  dateISO.value = d.toISOString().substring(0,10)
  load()
}

function setHoles(n) { holes.value = n; load() }
function setSide(s) { sidePref.value = s; load() }
function setGroupSize(n) { groupSize.value = n; load() }

function sideName(id){ return sideIdToName.value[id] || 'Side' }
function holesLabel(slot){ return slot && slot.allows_18 ? '9/18' : '9' }

function timeLocal(iso){
  try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) } catch { return '' }
}
function priceDisplay(){ return '$10' }

const temperatureF = ref(null)
const windPlaceholder = computed(() => '7')
const sunriseDisplay = ref('')
const sunsetDisplay = ref('')

const sidesDisplay = ref([])

async function initCourse(){
  const slug = courseSlug.value
  if (!slug) return
  try {
    const [{ data: course }, { data: sheets }] = await Promise.all([
      bookingAPI.getCourseBySlug(slug),
      bookingAPI.listCourseTeeSheetsBySlug(slug),
    ])
    courseName.value = course?.name || ''
    try { localStorage.setItem('cust:courseSlug', slug) } catch {}
    const ids = Array.isArray(sheets) ? sheets.map(s => s.id) : []
    teeSheetIds.value = ids
    sheetOptions.value = Array.isArray(sheets) ? sheets.map(s => ({ id: s.id, name: s.name })) : []
    selectedSheetId.value = ids[0] || ''
    if (selectedSheetId.value) try { localStorage.setItem('cust:lastSheet', selectedSheetId.value) } catch {}
    const map = {}
    const display = []
    for (const s of sheets) {
      if (Array.isArray(s.sides)) for (const sd of s.sides) {
        map[sd.id] = sd.name
        display.push({ id: sd.id, name: sd.name })
      }
    }
    sideIdToName.value = map
    // Deduplicate by id preserving order
    const seen = new Set();
    sidesDisplay.value = display.filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true)))
    localStorage.setItem('cust:browse:sheets', ids.join(','))
    localStorage.setItem('cust:lastSheet', ids[0] || '')
  } catch {}
}

function currentClassId(){
  // Public for unauthenticated; default Full for now when authed (mapping TBD)
  return isAuthed.value ? 'Full' : 'Public'
}
function buildParams(){
  const params = { date: dateISO.value, teeSheets: selectedSheetId.value ? [selectedSheetId.value] : teeSheetIds.value, customerView: true, classId: currentClassId() }
  if (typeof groupSize.value === 'number') params.groupSize = groupSize.value
  if (sidePref.value) params['sides[]'] = [sidePref.value]
  if (holes.value === 18) params.holes = 18
  return params
}

async function load(){
  if (!teeSheetIds.value.length) return
  loading.value = true
  try {
    const { data } = await teeTimesAPI.available(buildParams())
    // filter 18 holes client-side: require reround feasibility display hint is not available; use server pricing to include both legs
    slots.value = Array.isArray(data) ? data : []
  } catch { slots.value = [] } finally { loading.value = false }
}

async function loadDayInfo(){
  const slug = courseSlug.value
  if (!slug) return
  try {
    const { data } = await bookingAPI.getCourseDayInfo(slug, dateISO.value)
    if (data) {
      // Temperature F (round)
      temperatureF.value = typeof data.temperature_f === 'number' ? Math.round(data.temperature_f) : null
      // Format sunrise/sunset in am/pm in course timezone
      if (data.sunrise_local) sunriseDisplay.value = String(data.sunrise_local)
      if (data.sunset_local) sunsetDisplay.value = String(data.sunset_local)
    }
  } catch {}
}

onMounted(async () => {
  // Apply incoming query params first (date, sheetId)
  try {
    const qd = String(route.query?.date || '').trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(qd)) dateISO.value = qd
    const qs = String(route.query?.sheetId || '').trim()
    if (qs) selectedSheetId.value = qs
  } catch {}

  await initCourse()
  await Promise.all([load(), loadDayInfo()])
  try { const st = await apiUtils.checkAuthenticationStatus(); isAuthed.value = !!st.isAuthenticated } catch {}
})

watch(dateISO, async () => {
  await Promise.all([load(), loadDayInfo()])
})

watch(selectedSheetId, async (val) => {
  try { localStorage.setItem('cust:lastSheet', String(val || '')) } catch {}
  await load()
})

function openDetail(slot){
  router.push({
    name: 'BookingTeeTime',
    params: { courseSlug: String(route.params.courseSlug||'') , teeTimeId: slot.id },
    query: { date: dateISO.value, sheetId: selectedSheetId.value || '', sideName: sideIdToName.value[slot.side_id] || '' },
  })
}

function goBook(){
  const slug = String(route.params.courseSlug||'')
  router.push({ name: 'BookingCourse', params: { courseSlug: slug }, query: { date: dateISO.value, sheetId: selectedSheetId.value || '' } })
}
function goMine(){ router.push({ name: 'MyTeeTimes' }) }
function openLogin(){ authOpen.value = true }
async function submitLogin(){
  authError.value = ''
  try {
    const { data } = await customerAuthAPI.login({ email: authForm.value.email, password: authForm.value.password })
    if (data?.token) localStorage.setItem('jwt_token', data.token)
    apiUtils.setUser(data)
    isAuthed.value = true
    authOpen.value = false
  } catch (e) { authError.value = e?.response?.data?.error || 'Login failed' }
}
async function doLogout(){
  try { await authAPI.logout() } catch {}
  try { apiUtils.clearToken() } catch {}
  isAuthed.value = false
}

// Respond to route query changes (e.g., returning from detail)
watch(() => route.query, async (q) => {
  const qd = String(q?.date || '').trim()
  const qs = String(q?.sheetId || '').trim()
  let needsReload = false
  if (/^\d{4}-\d{2}-\d{2}$/.test(qd) && qd !== dateISO.value) { dateISO.value = qd; needsReload = true }
  if (qs && qs !== selectedSheetId.value) { selectedSheetId.value = qs; needsReload = true }
  if (needsReload) await Promise.all([load(), loadDayInfo()])
}, { deep: true })
</script>

<style scoped>
.booking-page { display: grid; gap: 16px; padding: 16px; }
.bk-header { display: flex; align-items: center; padding: 8px 0; }
.bk-header .menu-toggle { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; margin-right: 8px; }
.bk-header .title .course { font-size: 24px; font-weight: 700; }
.bk-header .title .subtitle { color: #6b7280; font-size: 14px; }
.bk-header .filter-toggle { margin-left: auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; width: 48px; height: 48px; display: inline-flex; align-items: center; justify-content: center; }
.bk-header .filter-toggle .icon { font-size: 20px; }
.content { display: grid; grid-template-columns: 200px 300px 1fr; gap: 16px; }
.leftnav { display: none; flex-direction: column; gap: 8px; }
.leftnav .ln-item { text-align: left; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; display: inline-flex; align-items: center; gap: 10px; }
.leftnav .ico { font-size: 16px; }
.filters .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
.card-title { font-weight: 700; margin-bottom: 12px; }
.grp { margin-top: 16px; }
.label { font-weight: 600; margin-bottom: 8px; }
.seg { display: flex; gap: 12px; flex-wrap: wrap; }
.seg-btn { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px 16px; font-weight: 600; }
.seg-btn.active { background: #111827; color: #fff; border-color: #111827; }

.results .datebar { display: grid; grid-template-rows: auto 1px auto; gap: 10px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
.results .datebar .top { display: grid; grid-template-columns: 40px 1fr 40px; align-items: center; }
.results .datebar .nav { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; }
.results .datebar .nav .v-icon { font-size: 16px; }
.results .datebar .date { text-align: center; display: grid; gap: 0px; }
.results .datebar .dmy { font-size: 30px; font-weight: 900; color: #111827; }
.results .datebar .dow { color: #6b7280; font-size: 18px; font-weight: 500; }
.results .datebar .divider { height: 1px; background: #e5e7eb; margin: 4px 8px; }
.results .datebar .info { display: grid; grid-template-columns: 1fr 1px 1fr; align-items: center; color: #6b7280; padding: 0 6px 4px; }
.results .datebar .info .left { justify-self: start; display: inline-flex; align-items: center; gap: 14px; }
.results .datebar .info .right { justify-self: end; display: inline-flex; align-items: center; gap: 14px; }
.results .datebar .info .ico { font-size: 18px; margin-right: 6px; }
.results .datebar .info .vsep { width: 1px; height: 18px; background: #e5e7eb; justify-self: center; }

/* Tee sheet selector */
.sheetbar { padding: 6px 0 18px; }
.sheetbar .select-wrap { position: relative; width: 100%; }
.sheetbar .select { width: 100%; padding: 10px 36px 10px 12px; border: 1px solid #e5e7eb; border-radius: 12px; appearance: none; -webkit-appearance: none; background-color: #fff; }
.sheetbar .chev { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #6b7280; pointer-events: none; font-size: 16px; }
.meta { display: flex; gap: 12px; padding: 12px 4px; }
.capsule { background: #fff; border: 1px solid #e5e7eb; border-radius: 999px; padding: 8px 12px; color: #374151; }

.slot-list { display: grid; gap: 8px; }
.slot-card { position: relative; background: #fff; border: 1px solid #e6e8ec; border-radius: 12px; padding: 12px 16px 4px 16px; box-shadow: 0 1px 0 rgba(0,0,0,0.02); }
.slot-card .slot-main { display: grid; grid-template-rows: auto auto; row-gap: 0px; padding-top: 12px; padding-bottom: 0; }
/* Figma-accurate time typography + spacing */
.slot-card .time { font-size: 29px; line-height: 1; font-weight: 900; letter-spacing: 0; color: #0f172a; margin: 0; }
/* Meta row alignment and spacing */
.slot-card .meta { color: #646a77; display: inline-flex; align-items: center; gap: 0; margin: 0; font-size: 16px; }
.slot-card .meta .sep { width: 3px; height: 3px; background: #cbd5e1; border-radius: 50%; display: inline-block; margin: 0 6px; }
.slot-card .meta .mi { font-size: 16px; margin-right: 8px; color: #787d87; transform: translateY(1px); }
.slot-card .meta .meta-item:first-child .mi { margin-left: -3px; }
.slot-card .price-badge { position: absolute; right: 12px; top: 6px; background: #22b8cf; color: #fff; font-weight: 900; border-radius: 12px; padding: 6px 10px; font-size: 18px; }

.empty { color: #6b7280; padding: 16px; }

/* Drawer */
.drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 140; }
.drawer { position: fixed; top: 0; right: 0; height: 100vh; width: 86vw; max-width: 360px; background: #fff; border-left: 1px solid #e5e7eb; transform: translateX(100%); transition: transform .2s ease-in-out; z-index: 150; display: grid; grid-template-rows: auto 1fr; }
.drawer.open { transform: translateX(0); }
.drawer.left { left: 0; right: auto; border-left: none; border-right: 1px solid #e5e7eb; transform: translateX(-100%); }
.drawer.left.open { transform: translateX(0); }
.drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e5e7eb; }
.drawer-title { font-weight: 700; font-size: 16px; }
.drawer-header .close { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; width: 36px; height: 36px; }
.drawer-body { padding: 16px; overflow: auto; }

@media (max-width: 960px) {
  .content { grid-template-columns: 1fr; }
  .filters { display: none; }
  .bk-header { position: sticky; top: 0; z-index: 100; background: #fff; }
  .sticky-wrap { position: sticky; top: 64px; z-index: 90; background: #fff; padding-top: 6px; }
  .results { padding-top: 0; }
}
@media (min-width: 961px) {
  .leftnav { display: flex; }
}

/* Auth modal styles */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 300; }
.modal { position: fixed; top: 10vh; left: 50%; transform: translateX(-50%); width: 92vw; max-width: 420px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; z-index: 310; display: grid; grid-template-rows: auto 1fr auto; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 0; }
.modal-body { padding: 12px; display: grid; gap: 10px; }
.row { display: grid; gap: 8px; }
.inp { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
.err { color: #b91c1c; font-weight: 600; }
.modal-actions { padding: 12px; }
</style>
