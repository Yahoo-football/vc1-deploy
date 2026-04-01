const { User, Field, Booking, Team, MatchResult, TeamMember } = require('../models');
const { Op } = require('sequelize');

// Support async handler for this module.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const getDashboardStats = asyncHandler(async (req, res) => {
  const role = req.user?.role;
  const userId = req.user?.id;

  // Admin: platform-wide stats
  if (role === 'admin') {
    const [
      totalUsers,
      totalFields,
      totalBookings,
      totalTeams,
      activeBookings,
      completedMatches
    ] = await Promise.all([
      User.count(),
      Field.count(),
      Booking.count(),
      Team.count(),
      Booking.count({ where: { status: 'confirmed' } }),
      MatchResult.count({ where: { matchStatus: 'completed' } })
    ]);

    return res.json({
      success: true,
      data: {
        role,
        users: totalUsers,
        fields: totalFields,
        bookings: totalBookings,
        teams: totalTeams,
        activeBookings,
        completedMatches
      }
    });
  }

  // Field owner: only own fields + bookings for those fields
  if (role === 'field_owner') {
    const myFields = await Field.findAll({ where: { ownerId: userId }, attributes: ['id'], raw: true });
    const fieldIds = myFields.map((f) => f.id);

    const [fieldCount, bookingCount, activeBookings] = await Promise.all([
      Field.count({ where: { ownerId: userId } }),
      fieldIds.length ? Booking.count({ where: { fieldId: { [Op.in]: fieldIds } } }) : 0,
      fieldIds.length
        ? Booking.count({ where: { fieldId: { [Op.in]: fieldIds }, status: { [Op.in]: ['pending', 'confirmed'] } } })
        : 0
    ]);

    return res.json({
      success: true,
      data: {
        role,
        fields: fieldCount,
        teams: 0,
        bookings: bookingCount,
        activeBookings
      }
    });
  }

  // Player/Captain: team-aware stats
  if (role === 'player' || role === 'captain') {
    const activeMembershipTeams = await TeamMember.findAll({
      where: { userId, status: 'active', isActive: true },
      attributes: ['teamId'],
      group: ['teamId'],
      raw: true
    });
    const membershipTeamIds = activeMembershipTeams.map((team) => team.teamId);

    let bookingWhere = { createdBy: userId };
    if (role === 'player' && membershipTeamIds.length > 0) {
      bookingWhere = {
        [Op.or]: [
          { createdBy: userId },
          { teamId: { [Op.in]: membershipTeamIds } },
          { opponentTeamId: { [Op.in]: membershipTeamIds } }
        ]
      };
    }
    if (role === 'captain') {
      const captainedTeams = await Team.findAll({ where: { captainId: userId }, attributes: ['id'], raw: true });
      const captainedTeamIds = captainedTeams.map((team) => team.id);
      bookingWhere = captainedTeamIds.length > 0
        ? {
            [Op.or]: [
              { createdBy: userId },
              { teamId: { [Op.in]: captainedTeamIds } },
              { opponentTeamId: { [Op.in]: captainedTeamIds } }
            ]
          }
        : { createdBy: userId };
    }

    const [totalFields, bookingCount, activeBookings] = await Promise.all([
      Field.count(),
      Booking.count({ where: bookingWhere }),
      Booking.count({ where: { ...bookingWhere, status: { [Op.in]: ['pending', 'confirmed'] } } })
    ]);

    let pendingJoinRequests = 0;
    if (role === 'captain') {
      const captainedTeams = await Team.findAll({ where: { captainId: userId }, attributes: ['id'], raw: true });
      const captainedTeamIds = captainedTeams.map((t) => t.id);
      pendingJoinRequests = captainedTeamIds.length
        ? await TeamMember.count({
            where: { teamId: { [Op.in]: captainedTeamIds }, status: 'pending', isActive: true }
          })
        : 0;
    }

    return res.json({
      success: true,
      data: {
        role,
        fields: totalFields,
        teams: activeMembershipTeams.length,
        bookings: bookingCount,
        activeBookings,
        ...(role === 'captain' ? { pendingJoinRequests } : {})
      }
    });
  }

  // Default fallback
  return res.json({
    success: true,
    data: { role: role || 'unknown', fields: 0, teams: 0, bookings: 0, activeBookings: 0 }
  });
});

const searchResources = asyncHandler(async (req, res) => {
  const { q, type } = req.query;
  
  if (!q) {
    return res.status(400).json({ success: false, message: 'Search query is required' });
  }

  let results = {};

  if (!type || type === 'users') {
    results.users = await User.findAll({
      where: {
        [User.sequelize.Sequelize.Op.or]: [
          { username: { [User.sequelize.Sequelize.Op.like]: `%${q}%` } },
          { email: { [User.sequelize.Sequelize.Op.like]: `%${q}%` } },
          { firstName: { [User.sequelize.Sequelize.Op.like]: `%${q}%` } },
          { lastName: { [User.sequelize.Sequelize.Op.like]: `%${q}%` } }
        ]
      },
      limit: 10
    });
  }

  if (!type || type === 'fields') {
    results.fields = await Field.findAll({
      where: {
        [Field.sequelize.Sequelize.Op.or]: [
          { name: { [Field.sequelize.Sequelize.Op.like]: `%${q}%` } },
          { description: { [Field.sequelize.Sequelize.Op.like]: `%${q}%` } },
          { address: { [Field.sequelize.Sequelize.Op.like]: `%${q}%` } }
        ]
      },
      limit: 10
    });
  }

  if (!type || type === 'teams') {
    results.teams = await Team.findAll({
      where: {
        [Team.sequelize.Sequelize.Op.or]: [
          { name: { [Team.sequelize.Sequelize.Op.like]: `%${q}%` } },
          { description: { [Team.sequelize.Sequelize.Op.like]: `%${q}%` } }
        ]
      },
      limit: 10
    });
  }

  res.json({ success: true, data: results });
});

module.exports = {
  getDashboardStats,
  searchResources
};
