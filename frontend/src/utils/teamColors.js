export const DEFAULT_JERSEY_COLOR = '#22C55E';
export const JERSEY_COLOR_PRESETS = [
  '#22C55E',
  '#2563EB',
  '#DC2626',
  '#F59E0B',
  '#7C3AED',
  '#111827',
  '#FFFFFF',
  '#EC4899',
  '#0EA5E9',
  '#6B7280'
];

export const normalizeHexColor = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  const withHash = normalized.startsWith('#') ? normalized : `#${normalized}`;
  return /^#[0-9A-F]{6}$/.test(withHash) ? withHash : null;
};

export const normalizeJerseyColors = (colors) => {
  if (!Array.isArray(colors)) return [];
  const normalized = colors
    .map((color) => normalizeHexColor(color))
    .filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, 5);
};

export const getNextJerseyColor = (colors = []) => {
  const normalizedColors = normalizeJerseyColors(colors);
  return (
    JERSEY_COLOR_PRESETS.find((preset) => !normalizedColors.includes(preset)) ||
    DEFAULT_JERSEY_COLOR
  );
};

export const getTeamJerseyColors = (team) => {
  const list = normalizeJerseyColors(team?.jerseyColors || team?.jersey_colors);
  if (list.length > 0) return list;

  const fallbackSingle = normalizeHexColor(team?.shirtColor || team?.shirt_color);
  if (fallbackSingle) return [fallbackSingle];

  return [DEFAULT_JERSEY_COLOR];
};

export const getContrastingTextColor = (hexColor) => {
  const color = normalizeHexColor(hexColor);
  if (!color) return '#111827';

  const cleanHex = color.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
  return luminance > 160 ? '#111827' : '#F9FAFB';
};
