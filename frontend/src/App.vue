<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <!-- Mobile hamburger menu button -->
      <v-app-bar-nav-icon 
        v-if="isAuthenticated && !isAuthPage && !smAndUp" 
        @click="drawerOpen = !drawerOpen"
      />
      
      <v-app-bar-title>
        <v-icon class="me-2">mdi-golf</v-icon>
        Golf Course Management
      </v-app-bar-title>

      <v-spacer />

      <!-- Authenticated User Menu -->
      <div v-if="isAuthenticated" class="d-flex align-center">
        <span class="me-4">Welcome back!</span>
        <v-btn
          variant="text"
          @click="logout"
          prepend-icon="mdi-logout"
          data-cy="logout-button"
        >
          Logout
        </v-btn>
      </div>
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer
      v-if="isAuthenticated && !isAuthPage"
      v-model="drawerOpen"
      :permanent="smAndUp"
      :temporary="!smAndUp"
      :width="smAndUp ? 80 : 280"
      app
      class="navigation-drawer"
    >
      <v-list nav density="compact">
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
              :prepend-icon="'mdi-view-dashboard'"
              data-cy="nav-dashboard"
              :class="smAndUp ? 'narrow-nav-item' : 'full-nav-item'"
            >
              <v-list-item-title v-if="!smAndUp">Dashboard</v-list-item-title>
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
              :prepend-icon="'mdi-account-group'"
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
              :prepend-icon="'mdi-account-tie'"
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
                :prepend-icon="'mdi-golf'"
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
                :prepend-icon="'mdi-shield-account'"
                data-cy="nav-super-admins"
                :class="smAndUp ? 'narrow-nav-item' : 'full-nav-item'"
              >
                <v-list-item-title v-if="!smAndUp">Super Admins</v-list-item-title>
              </v-list-item>
            </template>
          </v-tooltip>
        </template>
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
import apiUtils from './services/api'

const route = useRoute()
const router = useRouter()
const { smAndUp } = useDisplay()

// Reactive state
const isAuthenticated = ref(false)
const isSuperAdmin = ref(false)
const drawerOpen = ref(true) // Initialize as true, will be properly set by watcher

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
    isSuperAdmin.value = authStatus.isSuperAdmin
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
.v-application {
  font-family: 'Roboto', sans-serif;
}

/* Navigation drawer base styles */
.navigation-drawer {
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

/* Narrow navigation item styles for desktop */
.narrow-nav-item {
  margin: 2px 8px;
  border-radius: 8px;
  text-align: center;
}

.narrow-nav-item .v-list-item__prepend {
  margin-inline-end: 0;
  align-self: center;
}

.narrow-nav-item .v-list-item__content {
  display: none;
}

/* Full navigation item styles for mobile */
.full-nav-item {
  margin: 2px 8px;
  border-radius: 8px;
}

.full-nav-item .v-list-item__prepend {
  margin-inline-end: 16px;
}

/* Hover effects */
.narrow-nav-item:hover,
.full-nav-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}
</style>
