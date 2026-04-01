export const ROLE_UPGRADE_CONFIG = {
  captain: {
    title: 'Captain Access',
    feeUsd: 20,
    description: 'Create bookings, lead your team, approve members, and unlock open-match coordination.',
    benefits: [
      'Create team bookings',
      'Manage team membership',
      'Approve join requests',
      'Open and respond to matches'
    ],
    badge: 'Most Popular',
    accent: 'emerald'
  },
  field_owner: {
    title: 'Field Owner Access',
    feeUsd: 40,
    description: 'List venues, review booking requests, and manage your field business from an owner dashboard.',
    benefits: [
      'Publish football fields',
      'Control venue schedules',
      'Review booking requests',
      'Track field operations'
    ],
    badge: 'Business',
    accent: 'sky'
  }
};

export const getRoleUpgradeConfig = (role) => ROLE_UPGRADE_CONFIG[role] || null;
