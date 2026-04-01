
import axios from 'axios';
// =====================================
// Configuration
// =====================================
// API base URL - can be overridden by environment variable.
// Default to same-origin /api so the current frontend talks to the current backend.
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let lastToastAt = 0;
let lastToastKey = '';
const emitToast = (detail) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  const key = `${detail.type || 'info'}:${detail.title || ''}:${detail.message || ''}`;
  const now = Date.now();
  if (key === lastToastKey && now - lastToastAt < 5000) return;
  lastToastAt = now;
  lastToastKey = key;
  window.dispatchEvent(new CustomEvent('app:toast', { detail }));
};

// =====================================
// Authentication Helpers
// =====================================
export const setToken = (token) => {
  localStorage.setItem('token', token);
};

export const getToken = () => {
  return localStorage.getItem('token');
};

export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// =====================================
// Request Interceptor
// Add token to every request
// =====================================
api.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Let the browser set multipart boundaries automatically for file uploads.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (typeof config.headers?.set === 'function') {
        config.headers.set('Content-Type', undefined);
      } else {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);
// =====================================
// Response Interceptor
// Standard success & error format
// =====================================
api.interceptors.response.use(
  (response) => {
    const payload = response.data;
    const isWrapped =
      payload &&
      typeof payload === 'object' &&
      Object.prototype.hasOwnProperty.call(payload, 'success') &&
      Object.prototype.hasOwnProperty.call(payload, 'data');

    return {
      success: true,
      data: isWrapped ? payload.data : payload,
      status: response.status,
      message: (isWrapped && payload.message) || response.statusText,
    };
  },
  (error) => {
    const status = error.response?.status || 500;
    const validationErrors = error.response?.data?.errors;

    const isNetworkError = !error.response;
    const message = isNetworkError
      ? 'Cannot connect to server. Please make sure backend API is running.'
      : Array.isArray(validationErrors) && validationErrors.length > 0
        ? validationErrors.map((item) => item.message).filter(Boolean).join(' ')
      : error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'An unexpected error occurred';

    if (status === 429) {
      const retryAfterHeader = error.response?.headers?.['retry-after'];
      const retryAfterSeconds = Number(retryAfterHeader);
      const waitMinutes = Number.isFinite(retryAfterSeconds)
        ? Math.max(1, Math.ceil(retryAfterSeconds / 60))
        : null;
      const retryMessage = waitMinutes
        ? `Too many requests. Please wait about ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'} and try again.`
        : 'Too many requests. Please wait a minute and try again.';

      emitToast({
        type: 'error',
        title: 'Too Many Requests',
        message: retryMessage,
        duration: 6000
      });
    } else if (isNetworkError || status >= 500) {
      emitToast({
        type: 'error',
        title: 'Server Issue',
        message,
        duration: 5000
      });
    }

    // Handle Unauthorized (token expired/invalid)
    if (status === 401) {
      clearAuth();
      const currentPath = window.location.pathname || '/';
      const isProtectedPath = currentPath.startsWith('/app') || currentPath.startsWith('/owner');

      // Keep first-time/public users on Home. Only force leave protected areas.
      if (isProtectedPath && currentPath !== '/') {
        window.location.href = '/';
      }
    }

    // Development logging only
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        url: error.config?.url,
        status,
        message,
        data: error.response?.data,
      });
    }

    const appError = new Error(message);
    appError.success = false;
    appError.status = status;
    appError.error = message;
    appError.data = error.response?.data || null;
    appError.original = error;

    return Promise.reject(appError);
  }
);

// =====================================
// API Methods
// =====================================
const apiService = {
  // GET
  get: (url, params = {}) => api.get(url, { params }),

  // POST
  post: (url, data = {}, config = {}) => api.post(url, data, config),

  // PUT
  put: (url, data = {}, config = {}) => api.put(url, data, config),

  // PATCH
  patch: (url, data = {}, config = {}) => api.patch(url, data, config),

  // DELETE
  delete: (url) => api.delete(url),

  // File Upload
  upload: (url, formData, config = {}) => api.post(url, formData, config),
};

export default apiService;
