<template>
  <v-app>
    <v-app-bar app color="primary" dark>
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

      <!-- Guest Actions -->
      <div v-else class="d-flex align-center ga-2">
        <v-btn variant="text" @click="$router.push('/login')"> Login </v-btn>
        <v-btn variant="outlined" @click="$router.push('/signup')">
          Sign Up
        </v-btn>
      </div>

      <v-btn icon="mdi-theme-light-dark" @click="toggleTheme" class="ml-2" />
    </v-app-bar>

    <!-- Navigation Drawer - Only show for authenticated users -->
    <v-navigation-drawer v-if="isAuthenticated && !isAuthPage" app permanent>
      <v-list nav>
        <v-list-item
          to="/dashboard"
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
        />

        <v-list-item
          to="/customers"
          prepend-icon="mdi-account-multiple"
          title="Customers"
        />

        <v-list-item
          to="/staff"
          prepend-icon="mdi-account-group"
          title="Staff Management"
        />

        <!-- Super Admin Section -->
        <template v-if="isSuperAdmin">
          <v-divider class="my-2" />
          <v-list-subheader>Super Admin</v-list-subheader>
          <v-list-item
            to="/super-admin/courses"
            prepend-icon="mdi-golf"
            title="Golf Courses"
          />
          <v-list-item
            to="/super-admin/super-admins"
            prepend-icon="mdi-shield-account"
            title="Super Admins"
          />
        </template>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container :fluid="isAuthPage">
        <router-view />
      </v-container>
    </v-main>

    <v-footer v-if="!isAuthPage" app>
      <span>
        &copy; {{ new Date().getFullYear() }} Golf Course Management System.
        Built with Vue 3 & Vuetify.
      </span>
    </v-footer>
  </v-app>
</template>

<script setup>
console.log('🚀 NEW APP.VUE LOADED - DEBUG VERSION!', new Date().toISOString());

import { ref, computed, onMounted, watch } from 'vue';
import { useTheme } from 'vuetify';
import { useRouter, useRoute } from 'vue-router';
import { authAPI, apiUtils } from '@/services/api';

const theme = useTheme();
const router = useRouter();
const route = useRoute();

const isAuthenticated = ref(false);
const isSuperAdmin = ref(false);

// Check if current page is an auth page (login, signup, confirm)
const isAuthPage = computed(() => {
  const authPages = ['/login', '/signup', '/confirm'];
  return authPages.some(page => route.path.startsWith(page));
});

const toggleTheme = () => {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark';
};

const logout = async () => {
  try {
    await authAPI.logout();
    isAuthenticated.value = false;
    isSuperAdmin.value = false;
    router.push('/login');
  } catch (error) {
    console.error('Logout error:', error);
    // Even if logout fails, clear local state
    apiUtils.clearToken();
    isAuthenticated.value = false;
    isSuperAdmin.value = false;
    router.push('/login');
  }
};

const checkAuthStatus = async () => {
  console.log('🔍 checkAuthStatus called');

  // First check localStorage for immediate response
  if (apiUtils.isAuthenticated()) {
    isAuthenticated.value = true;
    console.log('✅ User is authenticated via localStorage');

    // Check user role from localStorage first
    let userInfo = apiUtils.getUser();
    console.log('👤 User info from localStorage:', userInfo);

    if (userInfo && userInfo.role) {
      console.log('🔑 User role:', userInfo.role, 'Checking if SuperAdmin...');
      isSuperAdmin.value = userInfo.role === 'SuperAdmin';
      console.log('🎯 isSuperAdmin set to:', isSuperAdmin.value);
    } else {
      console.log('⚠️ No user role in localStorage, fetching from backend...');
      // If no user info in localStorage, fetch from backend
      userInfo = await apiUtils.getCurrentUser();
      console.log('👤 User info from backend:', userInfo);
      if (userInfo) {
        apiUtils.setUser(userInfo);
        isSuperAdmin.value = userInfo.role === 'SuperAdmin';
        console.log(
          '🎯 isSuperAdmin set to (from backend):',
          isSuperAdmin.value
        );
      }
    }
    return;
  }

  console.log('🍪 Checking authentication via cookie...');
  // Then check with backend using HTTP-only cookie
  const { isAuthenticated: cookieAuth, user } =
    await apiUtils.checkAuthenticationStatus();
  isAuthenticated.value = cookieAuth;
  console.log('🍪 Cookie auth result:', cookieAuth, 'User:', user);

  if (cookieAuth && user) {
    // Store user info and check role
    apiUtils.setUser(user);
    isSuperAdmin.value = user.role === 'SuperAdmin';
    console.log('🎯 isSuperAdmin set to (from cookie):', isSuperAdmin.value);
  } else {
    isSuperAdmin.value = false;
    console.log('🎯 isSuperAdmin set to false (no auth)');
  }
};

// Watch for route changes to update auth status
watch(route, () => {
  checkAuthStatus();
});

// Check auth status on mount
onMounted(() => {
  checkAuthStatus();
});
</script>

<style>
/* Global styles */
.v-application {
  font-family: 'Roboto', sans-serif;
}
</style>
