export const formatRoleLabel = (role, fallback = 'Player') => {
  if (!role) return fallback;
  return String(role)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};
