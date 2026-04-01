import authService from './authService';
import { APP_CONFIG } from '../config/appConfig';

const buildRealtimeUrl = () => {
  const apiBase = APP_CONFIG.apiBaseUrl;
  return `${apiBase.replace(/\/api\/?$/, '')}/api/realtime/stream`;
};

let eventSource = null;
let reconnectTimer = null;
let reconnectDelay = 1000;
const listeners = new Set();

const notifyListeners = (message) => {
  listeners.forEach((listener) => {
    try {
      listener(message);
    } catch (_) {}
  });
};

const cleanupConnection = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
};

const scheduleReconnect = () => {
  if (reconnectTimer || listeners.size === 0) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    realtimeService.ensureConnected();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 10000);
};

const realtimeService = {
  ensureConnected() {
    const token = authService.getToken();
    if (!token || eventSource || listeners.size === 0) return;

    cleanupConnection();
    const streamUrl = `${buildRealtimeUrl()}?token=${encodeURIComponent(token)}`;
    eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
      reconnectDelay = 1000;
      notifyListeners({ event: 'sse:open' });
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        notifyListeners(parsed);
      } catch (_) {}
    };

    eventSource.onerror = () => {
      cleanupConnection();
      scheduleReconnect();
    };
  },

  subscribe(listener) {
    listeners.add(listener);
    this.ensureConnected();

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        if (reconnectTimer) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        cleanupConnection();
      }
    };
  }
};

export default realtimeService;
