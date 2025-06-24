import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
  timeout: 10000,
  withCredentials: true, // Include cookies for JWT authentication
});

// Request interceptor to add authorization header if JWT token exists
api.interceptors.request.use(
  config => {
    // Get JWT token from localStorage if available
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle JWT token refresh and auth errors
api.interceptors.response.use(
  response => {
    // If response includes a new token, store it
    const newToken = response.headers.authorization;
    if (newToken && newToken.startsWith('Bearer ')) {
      const token = newToken.substring(7);
      localStorage.setItem('jwt_token', token);
    }
    return response;
  },
  error => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      // Clear invalid token and user data
      apiUtils.clearToken();
      // Only redirect if not already on login page and not in test environment
      if (typeof window !== 'undefined' && window.location.pathname !== '/login' && !window.location.pathname.includes('/login')) {
        console.log('Authentication failed, redirecting to login');
        // Use router navigation if available, otherwise fall back to window.location
        if (window.app && window.app.$router) {
          window.app.$router.push('/login');
        } else {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth API methods
export const authAPI = {
  signup: data => api.post('/signup', data),
  confirm: token => api.get(`/confirm?token=${token}`),
  login: credentials => api.post('/auth/login', credentials),
  superAdminLogin: credentials =>
    api.post('/auth/super-admin/login', credentials),
  logout: () => {
    // Clear localStorage
    apiUtils.clearToken();
    // Make a request to clear the HTTP-only cookie
    return api.post('/auth/logout').catch(() => {
      // Ignore errors - we're logging out anyway
      return Promise.resolve();
    });
  },
  getCurrentUser: () => api.get('/auth/me'),
};

// Customer API methods
export const customerAPI = {
  getAll: (params = {}) => api.get('/customers', { params }),
  getById: id => api.get(`/customers/${id}`),
  create: data => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: id => api.delete(`/customers/${id}`),
  import: file => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/customers/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  export: (params = {}) => api.get('/customers/export', { params }),
};

// Notes API methods
export const notesAPI = {
  getByCustomer: customerId => api.get(`/customers/${customerId}/notes`),
  create: (customerId, data) =>
    api.post(`/customers/${customerId}/notes`, data),
  update: (customerId, noteId, data) =>
    api.put(`/customers/${customerId}/notes/${noteId}`, data),
  delete: (customerId, noteId) =>
    api.delete(`/customers/${customerId}/notes/${noteId}`),
};

// Staff API methods
export const staffAPI = {
  getAll: () => api.get('/staff'),
  invite: data => api.post('/staff/invite', data),
  register: data => api.post('/staff/register', data),
  update: (id, data) => api.put(`/staff/${id}`, data),
  deactivate: id => api.delete(`/staff/${id}`),
  resendInvite: data => api.post('/staff/resend-invite', data),
  revokeInvite: data => api.post('/staff/revoke-invite', data),
};

// Super Admin API methods
export const superAdminAPI = {
  // Course management
  getCourses: (params = {}) => api.get('/super-admin/courses', { params }),
  createCourse: data => api.post('/super-admin/courses', data),
  updateCourse: (id, data) => api.put(`/super-admin/courses/${id}`, data),
  updateCourseStatus: (id, status) =>
    api.patch(`/super-admin/courses/${id}/status`, { status }),

  // Super admin management
  getSuperAdmins: (params = {}) =>
    api.get('/super-admin/super-admins', { params }),
  inviteSuperAdmin: data => api.post('/super-admin/super-admins/invite', data),
  registerSuperAdmin: data =>
    api.post('/super-admin/super-admins/register', data),
  updateSuperAdmin: (id, data) =>
    api.put(`/super-admin/super-admins/${id}`, data),
  deactivateSuperAdmin: id => api.delete(`/super-admin/super-admins/${id}`),
  resendInvite: data =>
    api.post('/super-admin/super-admins/resend-invite', data),
  revokeInvite: data =>
    api.post('/super-admin/super-admins/revoke-invite', data),
  // Add method aliases that the component expects - using email as backend expects
  resendInvitation: (adminId, email) =>
    api.post('/super-admin/super-admins/resend-invite', { email }),
  revokeInvitation: (adminId, email) =>
    api.post('/super-admin/super-admins/revoke-invite', { email }),
};

// Utility functions
export const apiUtils = {
  isAuthenticated: () => {
    // Check if we have a token in localStorage OR if we have a user stored (indicating cookie auth)
    return (
      !!localStorage.getItem('jwt_token') ||
      !!localStorage.getItem('current_user')
    );
  },
  getToken: () => localStorage.getItem('jwt_token'),
  setToken: token => localStorage.setItem('jwt_token', token),
  clearToken: () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('current_user');
  },
  setUser: user => localStorage.setItem('current_user', JSON.stringify(user)),
  getUser: () => {
    const user = localStorage.getItem('current_user');
    return user ? JSON.parse(user) : null;
  },
};

export default api;
