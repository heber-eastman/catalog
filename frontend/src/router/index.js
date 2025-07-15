import { createRouter, createWebHistory } from 'vue-router';
import { apiUtils } from '@/services/api';
import Home from '@/views/Home.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
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
