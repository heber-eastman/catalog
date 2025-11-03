<template>
  <div class="my-tee-times" data-cy="my-tee-times">
    <div class="bk-header">
      <button class="menu-toggle" @click="menuOpen = true" aria-label="Open menu">
        <v-icon class="icon" :icon="'fa:fal fa-bars'" />
      </button>
      <div class="title">My Tee Times</div>
      <button class="refresh" @click="reload" data-cy="refresh"><v-icon :icon="'fa:fal fa-rotate'" /></button>
    </div>
    <div v-if="!rows.length" class="empty">No upcoming bookings.</div>
    <div v-else class="list">
      <div v-for="r in rows" :key="r.id" class="row card">
        <div class="r1">{{ r.dateShort }} @ {{ r.timeText }}</div>
        <div class="r2">{{ r.players }} player{{ r.players === 1 ? '' : 's' }}</div>
      </div>
    </div>

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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { bookingsAPI, apiUtils, authAPI } from '@/services/api';

const route = useRoute();
const router = useRouter();
const list = ref([]);
const rows = ref([]);
const menuOpen = ref(false);
const isAuthed = ref(false);

async function reload() {
  const { data } = await bookingsAPI.mine();
  list.value = Array.isArray(data) ? data : [];
  const now = new Date();
  const upcoming = [];
  for (const b of list.value) {
    const firstLeg = (b.legs || []).find(l => l.leg_index === 0);
    const tt = firstLeg && firstLeg.tee_time ? firstLeg.tee_time : null;
    const startIso = tt ? (tt.start_time_local || tt.start_time) : null;
    const start = startIso ? new Date(startIso) : null;
    if (!start || start <= now) continue;
    const players = typeof b.players === 'number' ? b.players : (firstLeg && Array.isArray(firstLeg.assignments) ? firstLeg.assignments.length : null);
    const timeText = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const dateText = start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const dateShort = start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    upcoming.push({ id: b.id, dateText, dateShort, timeText, players: players || 1 });
  }
  // sort by time ascending
  rows.value = upcoming.sort((a, b) => a.timeText.localeCompare(b.timeText));
}

function goBook(){
  const slug = String(route.params.courseSlug || localStorage.getItem('cust:courseSlug') || '');
  if (slug) router.push({ name: 'BookingCourse', params: { courseSlug: slug } });
  else router.push({ name: 'Booking' });
}
function goMine(){ router.push({ name: 'MyTeeTimes' }); }
function openLogin(){ window.location.href = '/login'; }
async function doLogout(){
  try { await authAPI.logout() } catch {}
  try { apiUtils.clearToken() } catch {}
  isAuthed.value = false
}

onMounted(reload);
onMounted(async () => { try { const st = await apiUtils.checkAuthenticationStatus(); isAuthed.value = !!st.isAuthenticated } catch {} })
</script>

<style scoped>
.bk-header { display: flex; align-items: center; padding: 8px 12px; }
.bk-header .menu-toggle { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; margin-right: 8px; }
.bk-header .title { font-size: 24px; font-weight: 700; }
.bk-header .refresh { margin-left: auto; }
.list { display: grid; gap: 8px; margin-top: 12px; padding: 0 12px; }
.row { padding: 0; border-bottom: none; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px 12px; }
.card .r1 { font-weight: 800; }
.card .r2 { color: #6b7280; margin-top: 2px; }
.empty { color: #666; margin-top: 12px; }

/* Drawer for mobile menu */
.drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 60; }
.drawer { position: fixed; top: 0; left: 0; height: 100vh; width: 86vw; max-width: 360px; background: #fff; border-right: 1px solid #e5e7eb; transform: translateX(-100%); transition: transform .2s ease-in-out; z-index: 70; display: grid; grid-template-rows: auto 1fr; }
.drawer.open { transform: translateX(0); }
.drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e5e7eb; }
.drawer-title { font-weight: 700; font-size: 16px; }
.drawer-body { padding: 16px; display: grid; gap: 10px; }
.ln-item.full { text-align: left; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; display: inline-flex; align-items: center; gap: 10px; }
.ico { font-size: 16px; }
</style>


