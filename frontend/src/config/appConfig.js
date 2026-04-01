const RAW_API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export const APP_CONFIG = {
  apiBaseUrl: RAW_API_BASE_URL,
  apiOrigin:
    typeof window !== 'undefined' && RAW_API_BASE_URL.startsWith('/')
      ? window.location.origin
      : RAW_API_BASE_URL.replace(/\/api\/?$/, ''),
  defaultProfilePath: '/uploads/profile/default_profile.jpg',
  brand: {
    shortName: 'FA',
    englishName: 'Football Booking',
    displayName: 'អាណាចក្រភ្នំស្វាយ'
  }
};

export const buildAssetUrl = (assetPath, fallbackPath = APP_CONFIG.defaultProfilePath) => {
  const rawPath = assetPath || fallbackPath;
  if (!rawPath) return '';
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return `${APP_CONFIG.apiOrigin}${normalizedPath}`;
};
