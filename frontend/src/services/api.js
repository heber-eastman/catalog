import axios from 'axios';

// Build timestamp: 2025-07-09T20:47:00Z - Force cache bust
// Create axios instance with base configuration
const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL || 'https://api.catalog.golf/api/v1',
  timeout: 80000,
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

// Response interceptor to handle JWT token refresh, auth errors, and retries
api.interceptors.response.use(
  response => {
    // If response includes a new token, store it
    const newToken = response.headers.authorization;
    if (newToken && newToken.startsWith('Bearer ')) {
      const token = newToken.substring(7);
      localStorage.setItem('jwt_token', token);
    }
    // Dev fallback: if backend returns token in body, persist it
    if (response?.data && typeof response.data === 'object' && response.data.token) {
      try { localStorage.setItem('jwt_token', response.data.token); } catch {}
    }
    return response;
  },
  async error => {
    const config = error.config;

    // Enhanced retry logic for connection timeouts and network errors
    if (
      !config._retryCount &&
      (error.code === 'ECONNABORTED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.message.includes('timeout') ||
        error.message.includes('Network Error'))
    ) {
      config._retryCount = 1;
      console.log('Retrying request due to network error:', error.message);

      // Exponential backoff: wait longer for timeout errors
      const waitTime =
        error.code === 'ECONNABORTED' || error.message.includes('timeout')
          ? 3000
          : 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // For timeout errors, try with a longer timeout on retry
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        config.timeout = 90000;
      }

      return api(config);
    }

    // Second retry for persistent timeout issues
    if (
      config._retryCount === 1 &&
      (error.code === 'ECONNABORTED' || error.message.includes('timeout'))
    ) {
      config._retryCount = 2;
      console.log('Second retry attempt for timeout error');

      // Wait even longer before second retry
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Use maximum timeout for final attempt
      config.timeout = 100000;

      return api(config);
    }

    // Handle authentication errors
    if (error.response?.status === 401) {
      // Clear invalid token and user data
      apiUtils.clearToken();
      // Only redirect if not already on login page and not in test environment
      if (
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login' &&
        !window.location.pathname.includes('/login')
      ) {
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
  signup: data => {
    // Transform frontend form data to backend expected format
    const transformedData = {
      course: {
        name: data.course_name,
        street: data.street,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code,
        country: 'US', // Default to US, can be made configurable later
      },
      admin: {
        email: data.admin_email,
        password: data.admin_password,
        first_name: data.admin_first_name,
        last_name: data.admin_last_name,
      },
    };
    console.log('Original form data:', data);
    console.log('Transformed data for backend:', transformedData);
    return api.post('/signup', transformedData);
  },
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
  // Check authentication using HTTP-only cookie (async)
  checkAuthenticationStatus: async () => {
    try {
      const response = await api.get('/auth/me');
      return { isAuthenticated: true, user: response.data };
    } catch (error) {
      return { isAuthenticated: false, user: null };
    }
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
  // Add method to get current user from backend
  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      return null;
    }
  },
};

// Tee times (availability)
export const teeTimesAPI = {
  available: params => api.get('/tee-times/available', { params }),
};

// Holds
export const holdsAPI = {
  holdCart: body => api.post('/holds/cart', body),
};

// Bookings
export const bookingsAPI = {
  create: body => api.post('/bookings', body),
  reschedule: (id, body) => api.patch(`/bookings/${id}/reschedule`, body),
  cancel: id => api.delete(`/bookings/${id}`),
  mine: () => api.get('/bookings/mine'),
};

// Settings/Admin APIs (thin helpers; endpoints may be stubbed in tests)
export const settingsAPI = {
  // Tee sheets
  listTeeSheets: () => api.get('/tee-sheets'),
  createTeeSheet: data => api.post('/tee-sheets', data),

  // Sides
  listSides: teeSheetId => api.get(`/tee-sheets/${teeSheetId}/sides`),
  createSide: (teeSheetId, data) => api.post(`/tee-sheets/${teeSheetId}/sides`, data),
  updateSide: (teeSheetId, sideId, data) => api.put(`/tee-sheets/${teeSheetId}/sides/${sideId}`, data),

  // Templates
  listTemplates: teeSheetId => api.get(`/tee-sheets/${teeSheetId}/templates`),
  createTemplate: (teeSheetId, data) => api.post(`/tee-sheets/${teeSheetId}/templates`, data),

  // Timeframes
  listTimeframes: (teeSheetId, templateId) => api.get(`/tee-sheets/${teeSheetId}/templates/${templateId}/timeframes`),
  createTimeframe: (teeSheetId, templateId, data) => api.post(`/tee-sheets/${teeSheetId}/templates/${templateId}/timeframes`, data),

  // Calendar
  assignCalendar: (teeSheetId, data) => api.post(`/tee-sheets/${teeSheetId}/calendar`, data),

  // Generate (internal)
  generateDay: (teeSheetId, date) => api.post(`/internal/generate?tee_sheet_id=${encodeURIComponent(teeSheetId)}&date=${encodeURIComponent(date)}`),

  // Closures
  listClosures: teeSheetId => api.get(`/tee-sheets/${teeSheetId}/closures`),
  createClosure: (teeSheetId, data) => api.post(`/tee-sheets/${teeSheetId}/closures`, data),
};

export default api;
