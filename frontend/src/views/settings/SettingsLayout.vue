<template>
  <div class="settings">
    <aside class="nav">
      <router-link :to="{ name: 'SettingsGeneral' }">General</router-link>
      <router-link :to="{ name: 'SettingsTeeSheetsSides' }">Tee Sheets & Sides</router-link>
      <router-link :to="{ name: 'SettingsDayTemplates' }">Day Templates</router-link>
      <router-link :to="{ name: 'SettingsTimeframes' }">Timeframes</router-link>
      <router-link :to="{ name: 'SettingsCalendar' }">Calendar</router-link>
      <router-link :to="{ name: 'SettingsClosures' }">Closures</router-link>
      <router-link :to="{ name: 'SettingsBookingClasses' }">Booking Classes</router-link>
    </aside>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>

<style scoped>
.settings { display: grid; grid-template-columns: 220px 1fr; min-height: calc(100vh - 64px); }
.nav { border-right: 1px solid #eee; padding: 12px; display: grid; gap: 8px; }
.nav a { color: #2c3e50; text-decoration: none; }
.nav a.router-link-active { font-weight: 600; }
.content { padding: 16px; }
</style>


