let leafletPromise = null;

const LEAFLET_SCRIPT_ID = 'leaflet-script';
const LEAFLET_STYLE_ID = 'leaflet-style';
const LEAFLET_SCRIPT_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_STYLE_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

// Support ensure leaflet style for this module.
const ensureLeafletStyle = () => {
  if (document.getElementById(LEAFLET_STYLE_ID)) return;

  const link = document.createElement('link');
  link.id = LEAFLET_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = LEAFLET_STYLE_URL;
  link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  link.crossOrigin = '';
  document.head.appendChild(link);
};

export const loadLeaflet = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet can only be loaded in the browser.'));
  }

  if (window.L) {
    return Promise.resolve(window.L);
  }

  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      ensureLeafletStyle();

      const existing = document.getElementById(LEAFLET_SCRIPT_ID);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.L));
        existing.addEventListener('error', () => reject(new Error('Failed to load Leaflet.')));
        return;
      }

      const script = document.createElement('script');
      script.id = LEAFLET_SCRIPT_ID;
      script.src = LEAFLET_SCRIPT_URL;
      script.async = true;
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error('Failed to load Leaflet.'));
      document.body.appendChild(script);
    });
  }

  return leafletPromise;
};
