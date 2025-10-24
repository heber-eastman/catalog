<template>
  <v-app>
    <v-app-bar app color="white" elevation="0" class="app-header">
      <!-- Mobile hamburger menu button -->
      <v-app-bar-nav-icon 
        v-if="isAuthenticated && !isAuthPage && !smAndUp" 
        @click="drawerOpen = !drawerOpen"
      />
      
      <v-app-bar-title>
        <v-icon class="me-2" :icon="'fa:fal fa-golf-ball-tee'" />
        Golf Course Management
      </v-app-bar-title>

      <v-spacer />

      <!-- Authenticated User Menu -->
      <div v-if="isAuthenticated" class="d-flex align-center">
        <v-btn
          variant="text"
          @click="logout"
          class="logout-icon-btn"
          aria-label="Logout"
        >
          <v-icon :icon="'fa:fal fa-right-from-bracket'" />
        </v-btn>
      </div>
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer
      v-if="isAuthenticated && !isAuthPage"
      v-model="drawerOpen"
      :permanent="smAndUp"
      :temporary="!smAndUp"
      :width="smAndUp ? 64 : 280"
      app
      class="navigation-drawer"
    >
      <v-list nav density="compact" class="nav-list">
        <!-- Navigation Items -->
        <!-- Dashboard -->
        <v-tooltip 
          :disabled="!smAndUp" 
          location="end" 
          :text="'Dashboard'"
        >
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              :to="'/dashboard'"
              :prepend-icon="'fa:fal fa-gauge'"
              data-cy="nav-dashboard"
              :class="smAndUp ? 'narrow-nav-item' : 'full-nav-item'"
            >
              <v-list-item-title v-if="!smAndUp">Dashboard</v-list-item-title>
            </v-list-item>
          </template>
        </v-tooltip>

        <!-- Tee Sheet (Staff/Admin) -->
        <v-tooltip 
          v-if="['Admin','Manager','Staff'].includes(userRole)"
          :disabled="!smAndUp" 
          location="end" 
          :text="'Tee Sheet'"
        >
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              :to="'/tee-sheet'"
              :prepend-icon="'fa:fal fa-calendar'"
              data-cy="nav-tee-sheet"
              :class="smAndUp ? 'narrow-nav-item' : 'full-nav-item'"
            >
              <v-list-item-title v-if="!smAndUp">Tee Sheet</v-list-item-title>
            </v-list-item>
          </template>
        </v-tooltip>

        <!-- Customers -->
        <v-tooltip 
          :disabled="!smAndUp" 
          location="end" 
          :text="'Customers'"
        >
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              :to="'/customers'"
              :prepend-icon="'fa:fal fa-users'"
              data-cy="nav-customers"
              :class="smAndUp ? 'narrow-nav-item' : 'full-nav-item'"
            >
              <v-list-item-title v-if="!smAndUp">Customers</v-list-item-title>
            </v-list-item>
          </template>
        </v-tooltip>

        <!-- Staff -->
        <v-tooltip 
          :disabled="!smAndUp" 
          location="end" 
          :text="'Staff'"
        >
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              :to="'/staff'"
              :prepend-icon="'fa:fal fa-id-badge'"
              data-cy="nav-staff"
              :class="smAndUp ? 'narrow-nav-item' : 'full-nav-item'"
            >
              <v-list-item-title v-if="!smAndUp">Staff</v-list-item-title>
            </v-list-item>
          </template>
        </v-tooltip>

        <!-- Super Admin Only Section -->
        <template v-if="isSuperAdmin">
          <v-divider class="my-2" />
          
          <!-- Courses -->
          <v-tooltip 
            :disabled="!smAndUp" 
            location="end" 
            :text="'Golf Courses'"
          >
            <template v-slot:activator="{ props }">
              <v-list-item
                v-bind="props"
                :to="'/super-admin/courses'"
                :prepend-icon="'fa:fal fa-flag'"
                data-cy="nav-courses"
                :class="smAndUp ? 'narrow-nav-item' : 'full-nav-item'"
              >
                <v-list-item-title v-if="!smAndUp">Golf Courses</v-list-item-title>
              </v-list-item>
            </template>
          </v-tooltip>

          <!-- Super Admins -->
          <v-tooltip 
            :disabled="!smAndUp" 
            location="end" 
            :text="'Super Admins'"
          >
            <template v-slot:activator="{ props }">
              <v-list-item
                v-bind="props"
                :to="'/super-admin/admins'"
                :prepend-icon="'fa:fal fa-shield-halved'"
                data-cy="nav-super-admins"
                :class="smAndUp ? 'narrow-nav-item' : 'full-nav-item'"
              >
                <v-list-item-title v-if="!smAndUp">Super Admins</v-list-item-title>
              </v-list-item>
            </template>
          </v-tooltip>
        </template>

        <!-- Settings pinned at bottom -->
        <div style="flex:1 1 auto;"></div>
        <v-tooltip 
          v-if="['Admin','Manager'].includes(userRole)"
          :disabled="!smAndUp" 
          location="end" 
          :text="'Settings'"
        >
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              :to="'/settings'"
              :prepend-icon="'fa:fal fa-gear'"
              data-cy="nav-settings"
              :class="[smAndUp ? 'narrow-nav-item' : 'full-nav-item', { 'v-list-item--active': isSettingsRoute }]"
            >
              <v-list-item-title v-if="!smAndUp">Settings</v-list-item-title>
            </v-list-item>
          </template>
        </v-tooltip>

      </v-list>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { apiUtils } from './services/api'

const route = useRoute()
const router = useRouter()
const { smAndUp } = useDisplay()

// Reactive state
const isAuthenticated = ref(apiUtils.isAuthenticated())
const isSuperAdmin = ref(false)
const userRole = ref('')
const drawerOpen = ref(true) // Initialize as true, will be properly set by watcher
const isSettingsRoute = computed(() => route.path.startsWith('/settings'))

// Computed properties
const isAuthPage = computed(() => {
  const authPaths = ['/login', '/signup', '/staff/register', '/super-admin/register', '/confirm']
  return authPaths.includes(route.path)
})

// Initialize and manage drawer state based on screen size
watch(smAndUp, (newValue) => {
  console.log('📱 Screen size changed:', { 
    smAndUp: newValue, 
    isAuthenticated: isAuthenticated.value,
    isAuthPage: isAuthPage.value 
  })
  drawerOpen.value = newValue
}, { immediate: true })

// Close mobile drawer when route changes
watch(route, () => {
  console.log('🔄 Route changed:', { 
    path: route.path, 
    smAndUp: smAndUp.value,
    isAuthenticated: isAuthenticated.value,
    isAuthPage: isAuthPage.value 
  })
  if (!smAndUp.value) {
    drawerOpen.value = false
  }
})

// Methods
const checkAuthStatus = async () => {
  console.log('🔍 Checking auth status...', { 
    path: route.path, 
    isAuthPage: isAuthPage.value,
    currentAuth: isAuthenticated.value 
  })
  
  try {
    // Skip auth checks for registration pages with tokens
    if (route.path === '/staff/register' && route.query.token) {
      console.log('📝 Skipping auth check for staff registration')
      apiUtils.clearToken()
      isAuthenticated.value = false
      isSuperAdmin.value = false
      return
    }
    if (route.path === '/super-admin/register' && route.query.token) {
      console.log('📝 Skipping auth check for super admin registration')
      apiUtils.clearToken()
      isAuthenticated.value = false
      isSuperAdmin.value = false
      return
    }

    console.log('🌐 Making API call to check authentication...')
    const authStatus = await apiUtils.checkAuthenticationStatus()
    console.log('✅ Auth status received:', {
      ...authStatus,
      smAndUp: smAndUp.value,
      drawerOpen: drawerOpen.value
    })
    isAuthenticated.value = authStatus.isAuthenticated
    userRole.value = authStatus.user?.role || ''
    isSuperAdmin.value = userRole.value === 'SuperAdmin'
  } catch (error) {
    console.error('❌ Auth check failed:', error)
    isAuthenticated.value = false
    isSuperAdmin.value = false
  }
}

const logout = async () => {
  try {
    await apiUtils.logout()
    isAuthenticated.value = false
    isSuperAdmin.value = false
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
    // Force logout even if API call fails
    apiUtils.clearToken()
    isAuthenticated.value = false
    isSuperAdmin.value = false
    router.push('/login')
  }
}

// Lifecycle
onMounted(() => {
  checkAuthStatus()
})

// Watch route changes for auth status
watch(route, () => {
  checkAuthStatus()
})
</script>

<style>
/* Global styles */
html, body { font-family: 'Barlow Semi Condensed', 'Roboto', sans-serif; }
.v-application { font-family: 'Barlow Semi Condensed', 'Roboto', sans-serif; }
/* Ensure teleported overlays (dialogs/menus) also use global font */
.v-overlay-container { font-family: 'Barlow Semi Condensed', 'Roboto', sans-serif; }

/* Typography */
.body {
  font-size: 16px;
  font-weight: 400;
}

/* Global form typography (site-wide) */
:root {
  --font-body: 16px;
  --font-label: 16px;
}

label { font-size: var(--font-label); }
input, select, textarea { font-size: var(--font-body); }

/* Vuetify field/input overrides */
.v-field .v-label, .v-label { font-size: var(--font-label) !important; }
.v-field__input, .v-input input, .v-select .v-field__input, .v-text-field input { font-size: var(--font-body) !important; }

/* Make icons appear lighter globally */
.v-icon {
  opacity: 0.85;
}

/* Navigation drawer base styles */
.navigation-drawer {
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.nav-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  align-items: center;
  padding: 12px 0 0 0;
}

/* Narrow navigation item styles for desktop */
.narrow-nav-item {
  margin: 0;
  width: 48px;
  height: 48px;
  min-height: 48px;
  border-radius: 8px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0 !important;
  padding-inline-start: 0 !important;
  padding-inline-end: 0 !important;
}

.narrow-nav-item .v-list-item__prepend {
  margin-inline-end: 0;
  align-self: center;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 48px;
  min-width: 48px;
  height: 48px; /* ensure equal height to tile for perfect centering */
  margin-inline-start: 0 !important;
}

.narrow-nav-item .v-list-item__prepend .v-icon {
  margin: 0 !important;
  font-size: 24px !important;
  width: 24px;
  height: 24px;
  line-height: 24px; /* align the glyph within its box */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #333333 !important;
  opacity: 1 !important;
}

/* Icon color on hover/active to match Figma selected icon color */
.narrow-nav-item:hover .v-list-item__prepend .v-icon,
.narrow-nav-item.v-list-item--active .v-list-item__prepend .v-icon,
.full-nav-item:hover .v-list-item__prepend .v-icon,
.full-nav-item.v-list-item--active .v-list-item__prepend .v-icon {
  color: #003D7A !important;
  opacity: 1 !important;
}

/* Neutralize Vuetify list padding variables for icon-only tiles */
.narrow-nav-item {
  --v-list-item-padding-start: 0px;
  --v-list-item-padding-end: 0px;
  --v-list-item-prepend-width: 0px;
}

.narrow-nav-item .v-list-item__content {
  display: none;
}

/* Remove spacer that offsets the icon */
.narrow-nav-item .v-list-item__spacer {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
}

/* Full navigation item styles for mobile */
.full-nav-item {
  margin: 2px 8px;
  border-radius: 8px;
}

.full-nav-item .v-list-item__prepend {
  margin-inline-end: 16px;
}

/* Hover/active effects aligned to Figma */
.narrow-nav-item:hover,
.narrow-nav-item.v-list-item--active {
  background-color: #ccf9ff !important;
}

.full-nav-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}

.full-nav-item.v-list-item--active {
  background-color: #ccf9ff !important;
}

/* Ensure Vuetify overlays don't tint the active color */
.narrow-nav-item.v-list-item--active .v-list-item__overlay,
.full-nav-item.v-list-item--active .v-list-item__overlay {
  background-color: #ccf9ff !important;
  opacity: 1 !important;
}
/* Global outlined input style to align forms across app */
.form-outline .field { position: relative; margin-bottom: 10px; }
/* Only float labels for fields explicitly marked with .float */
.form-outline .field.float > label { position: absolute; top: -9px; left: 16px; padding: 0 4px; background: #fff; font-size: 12px; color: #6b7280; font-weight: 600; line-height: 1; letter-spacing: .02em; z-index: 1; }
/* Non-floating fields keep normal block labels (prevents affecting circle selectors) */
.form-outline .field:not(.float) > label { position: static; padding: 0; background: transparent; font-size: 14px; }
.form-outline .field .combo input,
.form-outline .field input,
.form-outline .field select,
.form-outline .field textarea { padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; box-sizing: border-box; background: #fff; font-family: var(--font-body, inherit); font-size: 16px; }
.form-outline .field.float .combo { margin-top: 0; }
.form-outline .field.float .combo input { padding-top: 16px; padding-bottom: 10px; }
.form-outline .field input:focus,
.form-outline .field select:focus,
.form-outline .field textarea:focus { outline: none; border-color: #1d4ed8; box-shadow: none; }
</style>

<style scoped>
/* Make logout icon button compact */
.logout-icon-btn {
  min-width: 0;
  padding: 6px;
}
/* Subtle bottom border for the global header */
.app-header {
  border-bottom: 1px solid #e5e7eb; /* neutral-200 */
}
/* Align right-side controls with site gutter */
.app-header :deep(.v-toolbar__content) {
  padding-right: 24px; /* match page gutter */
}
</style>
