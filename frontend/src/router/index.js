import { createRouter, createWebHistory } from 'vue-router';
import { apiUtils, settingsAPI } from '@/services/api';
import Home from '@/views/Home.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/settings/SettingsLayout.vue'),
    meta: { requiresAuth: true, roles: ['Admin', 'Manager'] },
    children: [
      { path: '', redirect: { name: 'SettingsGeneral' } },
      { path: 'general', name: 'SettingsGeneral', component: () => import('@/views/settings/General.vue') },
      // Tee sheet scoped routes (require :teeSheetId)
      { path: 'tee-sheets/:teeSheetId/v2/general', name: 'SettingsV2GeneralInfo', component: () => import('@/views/settings/v2/GeneralInfo.vue') },
      { path: 'tee-sheets/:teeSheetId/sides', name: 'SettingsTeeSheetsSides', component: () => import('@/views/settings/TeeSheetsSides.vue') },
      { path: 'tee-sheets/:teeSheetId/day-templates', name: 'SettingsDayTemplates', component: () => import('@/views/settings/DayTemplates.vue') },
      { path: 'tee-sheets/:teeSheetId/timeframes', name: 'SettingsTimeframes', component: () => import('@/views/settings/Timeframes.vue') },
      // V2 Settings pages
      { path: 'tee-sheets/:teeSheetId/v2/templates', name: 'SettingsV2Templates', component: () => import('@/views/settings/v2/Templates.vue') },
      { path: 'tee-sheets/:teeSheetId/v2/seasons', name: 'SettingsV2Seasons', component: () => import('@/views/settings/v2/Seasons.vue') },
      { path: 'tee-sheets/:teeSheetId/v2/overrides', name: 'SettingsV2Overrides', component: () => import('@/views/settings/v2/Overrides.vue') },
      { path: 'tee-sheets/:teeSheetId/calendar', name: 'SettingsCalendar', component: () => import('@/views/settings/Calendar.vue') },
      { path: 'tee-sheets/:teeSheetId/closures', name: 'SettingsClosures', component: () => import('@/views/settings/Closures.vue') },
      { path: 'tee-sheets/:teeSheetId/booking-classes', name: 'SettingsBookingClasses', component: () => import('@/views/settings/BookingClasses.vue') },
    ],
  },
  {
    path: '/settings/tee-sheet',
    name: 'SettingsTeeSheetEntry',
    meta: { requiresAuth: true, roles: ['Admin', 'Manager'] },
    beforeEnter: async (to, from, next) => {
      // Resolve last or first available tee sheet id
      let id = null;
      try { id = localStorage.getItem('teeSheet:lastSheet'); } catch {}
      if (!id) {
        try {
          const { data } = await settingsAPI.listTeeSheets();
          id = data?.[0]?.id || null;
          if (id) localStorage.setItem('teeSheet:lastSheet', id);
        } catch {}
      }
      if (id) {
        next({ name: 'SettingsTeeSheetsSides', params: { teeSheetId: id } });
      } else {
        next({ name: 'SettingsGeneral' });
      }
    },
  },
  // Legacy redirects without :teeSheetId
  { path: '/settings/tee-sheets-sides', beforeEnter: async (to, from, next) => {
      let id = null; try { id = localStorage.getItem('teeSheet:lastSheet'); } catch {}
      if (!id) { try { const { data } = await settingsAPI.listTeeSheets(); id = data?.[0]?.id; } catch {} }
      next(id ? { name: 'SettingsTeeSheetsSides', params: { teeSheetId: id } } : { name: 'SettingsGeneral' });
    } },
  { path: '/settings/day-templates', beforeEnter: async (to, from, next) => {
      let id = null; try { id = localStorage.getItem('teeSheet:lastSheet'); } catch {}
      if (!id) { try { const { data } = await settingsAPI.listTeeSheets(); id = data?.[0]?.id; } catch {} }
      next(id ? { name: 'SettingsDayTemplates', params: { teeSheetId: id } } : { name: 'SettingsGeneral' });
    } },
  { path: '/settings/timeframes', beforeEnter: async (to, from, next) => {
      let id = null; try { id = localStorage.getItem('teeSheet:lastSheet'); } catch {}
      if (!id) { try { const { data } = await settingsAPI.listTeeSheets(); id = data?.[0]?.id; } catch {} }
      next(id ? { name: 'SettingsTimeframes', params: { teeSheetId: id } } : { name: 'SettingsGeneral' });
    } },
  { path: '/settings/calendar', beforeEnter: async (to, from, next) => {
      let id = null; try { id = localStorage.getItem('teeSheet:lastSheet'); } catch {}
      if (!id) { try { const { data } = await settingsAPI.listTeeSheets(); id = data?.[0]?.id; } catch {} }
      next(id ? { name: 'SettingsCalendar', params: { teeSheetId: id } } : { name: 'SettingsGeneral' });
    } },
  { path: '/settings/closures', beforeEnter: async (to, from, next) => {
      let id = null; try { id = localStorage.getItem('teeSheet:lastSheet'); } catch {}
      if (!id) { try { const { data } = await settingsAPI.listTeeSheets(); id = data?.[0]?.id; } catch {} }
      next(id ? { name: 'SettingsClosures', params: { teeSheetId: id } } : { name: 'SettingsGeneral' });
    } },
  { path: '/settings/booking-classes', beforeEnter: async (to, from, next) => {
      let id = null; try { id = localStorage.getItem('teeSheet:lastSheet'); } catch {}
      if (!id) { try { const { data } = await settingsAPI.listTeeSheets(); id = data?.[0]?.id; } catch {} }
      next(id ? { name: 'SettingsBookingClasses', params: { teeSheetId: id } } : { name: 'SettingsGeneral' });
    } },
  {
    path: '/tee-sheet',
    name: 'TeeSheet',
    component: () => import('@/views/TeeSheet.vue'),
    meta: { requiresAuth: true, roles: ['Admin', 'Manager', 'Staff'] },
  },
  {
    path: '/browse',
    name: 'Browse',
    component: () => import('@/views/customer/Browse.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/booking',
    name: 'Booking',
    component: () => import('@/views/booking/BookingPage.vue'),
    meta: {},
  },
  {
    path: '/booking/:courseSlug',
    name: 'BookingCourse',
    component: () => import('@/views/booking/BookingPage.vue'),
    meta: {},
  },
  {
    path: '/booking/:courseSlug/tee-time/:teeTimeId',
    name: 'BookingTeeTime',
    component: () => import('@/views/booking/BookingTeeTime.vue'),
    meta: {},
  },
  {
    path: '/cart',
    name: 'Cart',
    component: () => import('@/views/customer/Cart.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/my-tee-times',
    name: 'MyTeeTimes',
    component: () => import('@/views/customer/MyTeeTimes.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
  },
  // Authentication routes
  {
    path: '/signup',
    name: 'Signup',
    component: () => import('@/views/auth/Signup.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/confirm',
    name: 'Confirm',
    component: () => import('@/views/auth/Confirm.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { requiresGuest: true },
  },
  // Protected routes - require authentication
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/customers',
    name: 'Customers',
    component: () => import('@/views/customers/CustomersList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/customers/:id',
    name: 'CustomerProfile',
    component: () => import('@/views/customers/CustomerProfile.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/staff',
    name: 'Staff',
    component: () => import('@/views/staff/StaffList.vue'),
    meta: { requiresAuth: true, roles: ['Admin', 'Manager'] },
  },
  {
    path: '/staff/register',
    name: 'StaffRegister',
    component: () => import('@/views/staff/StaffRegister.vue'),
    meta: { requiresGuest: true },
  },
  // Super Admin routes
  {
    path: '/super-admin',
    name: 'SuperAdmin',
    redirect: '/super-admin/courses',
    meta: { requiresAuth: true, roles: ['SuperAdmin'] },
  },
  {
    path: '/super-admin/courses',
    name: 'SuperAdminCourses',
    component: () => import('@/views/super-admin/CoursesList.vue'),
    meta: { requiresAuth: true, roles: ['SuperAdmin'] },
  },
  {
    path: '/super-admin/super-admins',
    name: 'SuperAdminUsers',
    component: () => import('@/views/super-admin/SuperAdminsList.vue'),
    meta: { requiresAuth: true, roles: ['SuperAdmin'] },
  },
  {
    path: '/super-admin/register',
    name: 'SuperAdminRegister',
    component: () => import('@/views/super-admin/SuperAdminRegister.vue'),
    meta: { requiresGuest: true },
  },
  // Catch-all 404 route
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest);

  // Check authentication status (both localStorage and cookie)
  let isAuthenticated = apiUtils.isAuthenticated(); // Check localStorage first

  if (!isAuthenticated) {
    // If not found in localStorage, check with backend using HTTP-only cookie
    const authStatus = await apiUtils.checkAuthenticationStatus();
    isAuthenticated = authStatus.isAuthenticated;
  }

  if (requiresAuth && !isAuthenticated) {
    // Redirect to login if authentication is required but user is not authenticated
    next('/login');
  } else if (requiresGuest && isAuthenticated) {
    // Redirect to dashboard if guest route is accessed but user is authenticated
    next('/dashboard');
  } else {
    // Allow navigation
    next();
  }
});

export default router;
