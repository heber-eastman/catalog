<template>
  <div class="tt-detail" data-cy="booking-tee-time">
    <header class="hdr">
      <button class="nav" @click="goBack()"><v-icon :icon="'fa:fal fa-chevron-left'" /></button>
      <div class="title-block">
        <div class="course">{{ courseName || formattedSlug }}</div>
        <div class="date">{{ dateText }}</div>
      </div>
    </header>

    <div class="time-big">{{ timeDisplay }}</div>
    <div class="meta">{{ holesLabel }} • {{ sideName }} • <span v-if="pricePerPlayer">${{ pricePerPlayer }}</span></div>

    <div class="group">
      <div class="label">Players</div>
      <div class="circles">
        <button v-for="n in 4" :key="'p'+n" :class="['circle',{active: players===n}]" @click="players=n">{{ n }}</button>
      </div>
    </div>

  <!-- Auth Modal -->
  <div v-if="authOpen" class="modal-backdrop" @click="authOpen=false"></div>
  <div v-if="authOpen" class="modal" role="dialog" aria-modal="true">
    <div class="modal-header">
      <div class="tabs">
        <button :class="['tab',{active: authMode==='login'}]" @click="authMode='login'">Log in</button>
        <button :class="['tab',{active: authMode==='signup'}]" @click="authMode='signup'">Sign up</button>
      </div>
      <button class="close" @click="authOpen=false">✕</button>
    </div>
    <div class="modal-body">
      <div v-if="authMode==='signup'" class="row">
        <input v-model="form.first_name" placeholder="First name" class="inp" />
        <input v-model="form.last_name" placeholder="Last name" class="inp" />
      </div>
      <div class="row">
        <input v-model="form.email" placeholder="Email" class="inp" type="email" />
      </div>
      <div class="row">
        <input v-model="form.password" placeholder="Password" class="inp" type="password" />
      </div>
      <div v-if="authError" class="err">{{ authError }}</div>
    </div>
    <div class="modal-actions">
      <button class="reserve" @click="submitAuth">{{ authMode==='signup' ? 'Create account' : 'Log in' }}</button>
    </div>
  </div>
    <div class="group">
      <div class="label">Holes</div>
      <div class="circles">
        <button :class="['circle',{active: holes===9}]" @click="holes=9">9</button>
        <button :class="['circle',{active: holes===18, disabled: !canStart18}]" :disabled="!canStart18" @click="canStart18 ? holes=18 : null">18</button>
      </div>
    </div>

    <div class="group">
      <div class="label">Walking/Riding</div>
      <div class="circles">
        <button :class="['circle',{active: walkRide==='walk'}]" @click="walkRide='walk'"><v-icon :icon="'fa:fal fa-person-walking'" /></button>
        <button :class="['circle',{active: walkRide==='ride'}]" @click="walkRide='ride'"><v-icon :icon="'fa:fal fa-car-side'" /></button>
      </div>
    </div>

    <div class="total">Total Price <span class="amt">${{ totalPrice }}</span></div>

    <div class="actions">
      <button class="reserve" @click="reserve">Reserve Tee Time</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { teeTimesAPI, bookingsAPI, bookingAPI, customerAuthAPI, apiUtils } from '@/services/api'

const route = useRoute()
const router = useRouter()

const teeTimeId = String(route.params.teeTimeId || '')
const dateISO = String(route.query.date || '')
const sheetId = String(route.query.sheetId || '')

const slot = ref(null)
const courseName = ref('')
const players = ref(1)
const holes = ref(9)
const walkRide = ref('ride')
const authOpen = ref(false)
const authMode = ref('login') // 'login' | 'signup'
const authError = ref('')
const form = ref({ first_name: '', last_name: '', email: '', password: '' })

const canStart18 = computed(() => !!(slot.value && (slot.value.allows_18 || slot.value.can_start_18)))
const sideName = computed(() => (slot.value && slot.value.side && slot.value.side.name) ? slot.value.side.name : (route.query.sideName || ''))
const holesLabel = computed(() => (slot.value && (slot.value.holes_label || (slot.value.allows_18 ? '9/18' : '9'))) || '9')
const pricePerPlayer = computed(() => slot.value && slot.value.price_breakdown ? Math.round((slot.value.price_breakdown.greens_fee_cents||0)/100) : null)
const totalPrice = computed(() => {
  const per = pricePerPlayer.value || 0
  const legs = holes.value === 18 ? 2 : 1
  return per * players.value * legs
})
const timeDisplay = computed(() => {
  try { return new Date(slot.value.start_time || slot.value.start_time_local).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) } catch { return '' }
})
const formattedSlug = computed(() => String(route.params.courseSlug || '').replace(/[-_]/g,' ').replace(/\b\w/g, c => c.toUpperCase()))
const dateText = computed(() => {
  try { return new Date(dateISO + 'T00:00:00').toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' }) } catch { return '' }
})

async function load(){
  const params = { date: dateISO, teeSheets: sheetId ? [sheetId] : undefined, customerView: true }
  const { data } = await teeTimesAPI.available(params)
  const list = Array.isArray(data) ? data : []
  slot.value = list.find(s => String(s.id) === teeTimeId) || null
  if (slot.value) holes.value = slot.value.allows_18 ? 18 : 9
}

async function reserve(){
  if (!slot.value) return
  // Ensure authenticated
  const status = await apiUtils.checkAuthenticationStatus()
  if (!status.isAuthenticated) {
    authOpen.value = true
    return
  }
  const teeSheetId = String(slot.value.tee_sheet_id || '')
  const firstLegId = String(slot.value.id)
  const legs = [{ tee_time_id: firstLegId, leg_index: 0 }]
  if (holes.value === 18) {
    const nextId = String(slot.value.reround_tee_time_id || '')
    if (!nextId) { alert('18 holes not available for this start.'); return }
    legs.push({ tee_time_id: nextId, leg_index: 1 })
  }
  const party = Array.from({ length: players.value }, (_, i) => ({
    customer_id: null,
    name: i === 0 ? 'John Doe' : '',
    email: null,
    walkRide: walkRide.value,
  }))
  const body = {
    tee_sheet_id: teeSheetId,
    classId: 'Full',
    holes: holes.value,
    lead_name: 'John Doe',
    players: party,
    legs,
  }
  try {
    await bookingsAPI.create(body)
    router.push('/my-tee-times')
  } catch (e) {
    alert('Unable to create booking. Please try again.')
  }
}

async function submitAuth(){
  authError.value = ''
  try {
    if (authMode.value === 'signup') {
      const { data } = await customerAuthAPI.signup(form.value)
      if (data?.token) localStorage.setItem('jwt_token', data.token)
      apiUtils.setUser(data)
    } else {
      const { data } = await customerAuthAPI.login({ email: form.value.email, password: form.value.password })
      if (data?.token) localStorage.setItem('jwt_token', data.token)
      apiUtils.setUser(data)
    }
    authOpen.value = false
    // proceed to reserve now that we're authenticated
    await reserve()
  } catch (e) {
    authError.value = e?.response?.data?.error || 'Authentication failed'
  }
}

onMounted(load)
onMounted(async () => { try { const { data } = await bookingAPI.getCourseBySlug(String(route.params.courseSlug||'')); courseName.value = data?.name || '' } catch {} })

function goBack(){
  const slug = String(route.params.courseSlug || '')
  router.push({ name: 'BookingCourse', params: { courseSlug: slug }, query: { date: dateISO || '', sheetId: sheetId || '' } })
}
</script>

<style scoped>
.tt-detail { padding: 16px; display: grid; gap: 16px; }
.hdr { display: flex; align-items: center; gap: 12px; }
.hdr .nav { width: 36px; height: 36px; border: 1px solid #e5e7eb; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
.hdr .title-block { display: grid; gap: 2px; }
.hdr .course { font-size: 24px; font-weight: 900; }
.hdr .date { color: #6b7280; }
.time-big { font-size: 40px; font-weight: 900; }
.meta { color: #6b7280; }
.group { display: grid; gap: 8px; }
.label { font-weight: 700; font-size: 16px; }
.circles { display: flex; gap: 10px; }
.circle { width: 48px; height: 48px; border-radius: 50%; border: 1px solid #e5e7eb; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; background: #fff; }
.circle.active { background: #111827; color: #fff; border-color: #111827; }
.circle.disabled { opacity: 0.5; cursor: not-allowed; }
.total { text-align: right; color: #6b7280; }
.total .amt { font-size: 36px; font-weight: 900; color: #111827; margin-left: 8px; }
.actions { padding-top: 8px; }
.reserve { width: 100%; background: #22b8cf; color: #fff; font-weight: 800; border: none; border-radius: 12px; padding: 14px; font-size: 20px; }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 90; }
.modal { position: fixed; top: 10vh; left: 50%; transform: translateX(-50%); width: 92vw; max-width: 420px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; z-index: 100; display: grid; grid-template-rows: auto 1fr auto; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 0; }
.tabs { display: inline-flex; gap: 6px; }
.tab { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 12px; font-weight: 700; }
.tab.active { background: #111827; color: #fff; border-color: #111827; }
.modal-body { padding: 12px; display: grid; gap: 10px; }
.row { display: grid; gap: 8px; }
.inp { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
.err { color: #b91c1c; font-weight: 600; }
.modal-actions { padding: 12px; }
</style>


