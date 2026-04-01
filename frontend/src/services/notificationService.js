import apiService from './api';
import authService from './authService';

let cachedNotifications = [];
let cachedUserId = null;
let cacheLoadedAt = 0;
let inflightPromise = null;
const listeners = new Set();

const parseMetadata = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const normalizeNotifications = (items) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    metadata: parseMetadata(item.metadata)
  }));

const getCurrentUserId = () => authService.getCurrentUser()?.id || null;

const ensureCacheScope = () => {
  const userId = getCurrentUserId();
  if (cachedUserId !== userId) {
    cachedUserId = userId;
    cachedNotifications = [];
    cacheLoadedAt = 0;
    inflightPromise = null;
  }
};

const notifyListeners = () => {
  const snapshot = [...cachedNotifications];
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (_) {}
  });
};

const updateCache = (nextNotifications) => {
  cachedNotifications = normalizeNotifications(nextNotifications)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  cacheLoadedAt = Date.now();
  notifyListeners();
  return [...cachedNotifications];
};

const notificationService = {
  subscribe: (listener) => {
    ensureCacheScope();
    listeners.add(listener);
    listener([...cachedNotifications]);
    return () => listeners.delete(listener);
  },

  getCached: () => {
    ensureCacheScope();
    return [...cachedNotifications];
  },

  getAll: async (filters = {}) => {
    ensureCacheScope();
    const hasFilters = Object.keys(filters || {}).length > 0;

    if (!hasFilters) {
      const shouldUseCache = cachedNotifications.length > 0 && Date.now() - cacheLoadedAt < 5000;
      if (shouldUseCache) {
        return { success: true, data: [...cachedNotifications] };
      }

      if (inflightPromise) {
        return inflightPromise;
      }

      return notificationService.refresh();
    }

    const response = await apiService.get('/notifications', filters);
    const normalized = normalizeNotifications(response.data);
    return { ...response, data: normalized };
  },

  refresh: async () => {
    ensureCacheScope();

    if (inflightPromise) {
      return inflightPromise;
    }

    inflightPromise = apiService.get('/notifications')
      .then((response) => ({ ...response, data: updateCache(response.data) }))
      .finally(() => {
        inflightPromise = null;
      });

    return inflightPromise;
  },

  markRead: async (id) => {
    ensureCacheScope();
    const previous = [...cachedNotifications];

    if (cachedNotifications.some((item) => item.id === id && !item.isRead)) {
      updateCache(
        cachedNotifications.map((item) =>
          item.id === id
            ? {
                ...item,
                isRead: true,
                readAt: item.readAt || new Date().toISOString()
              }
            : item
        )
      );
    }

    try {
      const response = await apiService.put(`/notifications/${id}`, {
        isRead: true,
        readAt: new Date().toISOString()
      });
      return response;
    } catch (error) {
      updateCache(previous);
      throw error;
    }
  },

  markManyRead: async (ids = []) => {
    ensureCacheScope();
    const targetIds = ids.filter(Boolean);
    if (targetIds.length === 0) return { success: true };

    const previous = [...cachedNotifications];
    const readAt = new Date().toISOString();
    updateCache(
      cachedNotifications.map((item) =>
        targetIds.includes(item.id)
          ? {
              ...item,
              isRead: true,
              readAt: item.readAt || readAt
            }
          : item
      )
    );

    try {
      await Promise.allSettled(
        targetIds.map((id) =>
          apiService.put(`/notifications/${id}`, {
            isRead: true,
            readAt
          })
        )
      );
      return { success: true };
    } catch (error) {
      updateCache(previous);
      throw error;
    }
  },

  markAllRead: async () => {
    ensureCacheScope();
    const unreadIds = cachedNotifications.filter((item) => !item.isRead).map((item) => item.id);
    if (unreadIds.length === 0) return { success: true };

    await notificationService.markManyRead(unreadIds);
    return { success: true };
  },

  create: async (payload) => {
    const response = await apiService.post('/notifications', payload);
    return response;
  },

  clearCache: () => {
    cachedNotifications = [];
    cachedUserId = null;
    cacheLoadedAt = 0;
    inflightPromise = null;
    notifyListeners();
  }
};

export default notificationService;

