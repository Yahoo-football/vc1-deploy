const SETTINGS_DEVICE_PREFS_KEY = 'app_settings_device_preferences';

const DEFAULT_START_PAGE = 'dashboard';

const START_PAGE_PATHS = {
  app: {
    dashboard: '/app/dashboard',
    bookings: '/app/bookings',
    teams: '/app/teams',
    fields: '/app/fields',
    notifications: '/app/notifications'
  },
  owner: {
    dashboard: '/owner/dashboard',
    bookings: '/owner/bookings',
    fields: '/owner/fields'
  }
};

// Render the get stored start page.
const getStoredStartPage = () => {
  if (typeof window === 'undefined') return DEFAULT_START_PAGE;

  try {
    const raw = window.localStorage.getItem(SETTINGS_DEVICE_PREFS_KEY);
    if (!raw) return DEFAULT_START_PAGE;
    const parsed = JSON.parse(raw);
    return typeof parsed?.startPage === 'string' ? parsed.startPage : DEFAULT_START_PAGE;
  } catch {
    return DEFAULT_START_PAGE;
  }
};

export const getPreferredStartPath = (workspace = 'app') => {
  const pathMap = START_PAGE_PATHS[workspace] || START_PAGE_PATHS.app;
  const startPage = getStoredStartPage();
  return pathMap[startPage] || pathMap.dashboard;
};

