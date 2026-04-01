const ROLE_UPGRADE_CONFIG = {
  captain: {
    title: 'Captain Access',
    feeUsd: 20,
    description: 'Create bookings, lead a team, approve join requests, and open matches for opponents.',
    benefits: [
      'Create and manage team bookings',
      'Approve or reject join requests',
      'Organize open matches faster'
    ]
  },
  field_owner: {
    title: 'Field Owner Access',
    feeUsd: 40,
    description: 'List your fields, review venue bookings, and manage schedules from one owner dashboard.',
    benefits: [
      'Publish and manage football fields',
      'Approve field booking requests',
      'Track venue revenue and schedules'
    ]
  }
};

const getRoleUpgradeConfig = (role) => ROLE_UPGRADE_CONFIG[role] || null;

module.exports = {
  ROLE_UPGRADE_CONFIG,
  getRoleUpgradeConfig
};
