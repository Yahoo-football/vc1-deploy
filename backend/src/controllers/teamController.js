const { Team, User, Field, Booking, TeamMember, MatchResult, Notification, Rating, BookingJoinRequest } = require('../models');
const { sequelize } = require('../models');
const { Op } = require('sequelize');
const { getUploadDir, resolveManagedUploadPath } = require('../utils/storagePaths');

// Support async handler for this module.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Get team base includes for the current flow.
const getTeamBaseIncludes = () => [
  {
    model: User,
    as: 'captain',
    attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'phone', 'address', 'dateOfBirth', 'avatarUrl', 'status', 'role']
  },
  {
    model: Field,
    as: 'homeField',
    attributes: ['id', 'name', 'address', 'city', 'province', 'country', 'latitude', 'longitude'],
    required: false
  }
];

// Get team details includes for the current flow.
const getTeamDetailsIncludes = () => [
  ...getTeamBaseIncludes(),
  {
    model: TeamMember,
    as: 'teamMembers',
    attributes: ['teamId', 'userId', 'role', 'status', 'joinedAt', 'isActive'],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'phone', 'address', 'dateOfBirth', 'avatarUrl', 'status', 'role']
      }
    ],
    required: false
  },
  {
    model: Booking,
    as: 'bookings',
    required: false
  }
];

// Get user display name for the current flow.
const getUserDisplayName = async (userId) => {
  const actor = await User.findByPk(userId, {
    attributes: ['username', 'firstName', 'lastName']
  });

  if (!actor) return 'A user';

  const fullName = `${actor.firstName || ''} ${actor.lastName || ''}`.trim();
  return fullName || actor.username || 'A user';
};

const normalizeShirtColor = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return null;

  return normalized.startsWith('#') ? normalized : `#${normalized}`;
};

const normalizeJerseyColors = (values) => {
  if (values === undefined) return undefined;
  if (values === null) return null;
  if (!Array.isArray(values)) return null;

  const normalized = values
    .map((value) => normalizeShirtColor(value))
    .filter((value) => /^#[0-9A-F]{6}$/i.test(String(value || '')));

  return Array.from(new Set(normalized)).slice(0, 5);
};

const resolveTeamJerseyColors = (payload) => {
  const normalizedList = normalizeJerseyColors(payload?.jerseyColors);
  if (normalizedList !== undefined) {
    return normalizedList && normalizedList.length > 0 ? normalizedList : null;
  }

  const normalizedSingle = normalizeShirtColor(payload?.shirtColor);
  if (normalizedSingle && /^#[0-9A-F]{6}$/i.test(normalizedSingle)) {
    return [normalizedSingle];
  }

  return undefined;
};

const attachMemberCounts = async (teams = []) => {
  if (!Array.isArray(teams) || teams.length === 0) return [];

  const teamIds = teams.map((team) => Number(team.id)).filter(Boolean);
  const memberCountRows = await TeamMember.findAll({
    where: {
      teamId: { [Op.in]: teamIds },
      status: 'active',
      isActive: true
    },
    attributes: [
      'teamId',
      [sequelize.fn('COUNT', sequelize.col('userId')), 'memberCount']
    ],
    group: ['teamId'],
    raw: true
  });

  const memberCountByTeamId = memberCountRows.reduce((acc, row) => {
    acc[Number(row.teamId)] = Number(row.memberCount || 0);
    return acc;
  }, {});

  return teams.map((team) => {
    const teamJson = team?.toJSON ? team.toJSON() : team;
    return {
      ...teamJson,
      memberCount: memberCountByTeamId[Number(teamJson.id)] || 0
    };
  });
};
const getAllTeams = asyncHandler(async (req, res) => {
  const limit = Number.isFinite(Number(req.query.limit)) ? Math.min(Number(req.query.limit), 100) : undefined;
  const offset = Number.isFinite(Number(req.query.offset)) ? Math.max(Number(req.query.offset), 0) : undefined;
  const includeDetails =
    req.query.includeDetails === 'true' || req.query.includeDetails === '1' || req.query.details === 'true' || req.query.details === '1';

  const teams = await Team.findAll({
    include: includeDetails ? getTeamDetailsIncludes() : getTeamBaseIncludes(),
    order: [['createdAt', 'DESC']],
    ...(limit ? { limit } : {}),
    ...(offset ? { offset } : {})
  });

  const teamsWithMemberCounts = includeDetails ? teams : await attachMemberCounts(teams);

  res.json({ success: true, data: teamsWithMemberCounts });
});

const getTeamById = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, {
    include: getTeamDetailsIncludes()
  });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  res.json({ success: true, data: team });
});

const getMyTeams = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [captainedTeams, memberships] = await Promise.all([
    Team.findAll({ where: { captainId: userId }, attributes: ['id'] }),
    TeamMember.findAll({
      where: { userId, status: 'active', isActive: true },
      attributes: ['teamId']
    })
  ]);

  const teamIds = Array.from(
    new Set([...captainedTeams.map((t) => t.id), ...memberships.map((m) => m.teamId)])
  );

  if (teamIds.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const teams = await Team.findAll({
    where: { id: teamIds },
    include: getTeamBaseIncludes(),
    order: [['createdAt', 'DESC']]
  });

  const teamsWithMemberCounts = await attachMemberCounts(teams);

  res.json({ success: true, data: teamsWithMemberCounts });
});

const getCaptainedTeams = asyncHandler(async (req, res) => {
  const teams = await Team.findAll({
    where: { captainId: req.user.id },
    include: getTeamBaseIncludes(),
    order: [['createdAt', 'DESC']]
  });

  const teamsWithMemberCounts = await attachMemberCounts(teams);

  res.json({ success: true, data: teamsWithMemberCounts });
});

const getMyInvitations = asyncHandler(async (req, res) => {
  const invitations = await TeamMember.findAll({
    where: {
      userId: req.user.id,
      status: 'pending',
      isActive: false
    },
    include: [
      {
        model: Team,
        as: 'team',
        include: getTeamBaseIncludes()
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  const inviteTeams = invitations
    .map((invitation) => invitation.team)
    .filter(Boolean);

  const inviteTeamsWithMemberCounts = await attachMemberCounts(inviteTeams);

  res.json({ success: true, data: inviteTeamsWithMemberCounts });
});

const createTeam = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { name, description, skillLevel, maxPlayers, homeFieldId, logoUrl, isActive } = req.body;
    const jerseyColors = resolveTeamJerseyColors(req.body);
    const shirtColor = jerseyColors?.[0] || normalizeShirtColor(req.body.shirtColor);

    const team = await Team.create({
      name,
      description,
      skillLevel,
      maxPlayers,
      homeFieldId,
      logoUrl,
      shirtColor,
      jerseyColors,
      isActive,
      captainId: req.user.id
    }, { transaction });

    await TeamMember.create({
      teamId: team.id,
      userId: req.user.id,
      role: 'captain',
      status: 'active',
      joinedAt: new Date(),
      isActive: true
    }, { transaction });

    await transaction.commit();
    res.status(201).json({ success: true, data: team });
  } catch (error) {
    await transaction.rollback();
    console.error('Create team error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

const updateTeam = asyncHandler(async (req, res) => {
  try {
    const team = await Team.findByPk(req.params.id);

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (team.captainId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this team' });
    }

    const updatableFields = ['name', 'description', 'skillLevel', 'maxPlayers', 'homeFieldId', 'logoUrl', 'isActive'];
    const updateData = {};
    for (const key of updatableFields) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    const jerseyColors = resolveTeamJerseyColors(req.body);
    if (jerseyColors !== undefined) {
      updateData.jerseyColors = jerseyColors;
      updateData.shirtColor = Array.isArray(jerseyColors) && jerseyColors.length > 0 ? jerseyColors[0] : null;
    } else if (req.body.shirtColor !== undefined) {
      const normalizedColor = normalizeShirtColor(req.body.shirtColor);
      updateData.shirtColor = normalizedColor;
      updateData.jerseyColors = normalizedColor ? [normalizedColor] : null;
    }

    const updatedTeam = await team.update(updateData);
    res.json({ success: true, data: updatedTeam });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

const deleteTeam = asyncHandler(async (req, res) => {
  try {
    const team = await Team.findByPk(req.params.id);

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (team.captainId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this team' });
    }

    await sequelize.transaction(async (transaction) => {
      const teamBookingRows = await Booking.findAll({
        where: {
          [Op.or]: [
            { teamId: team.id },
            { opponentTeamId: team.id }
          ]
        },
        attributes: ['id'],
        transaction
      });
      const bookingIds = teamBookingRows.map((booking) => Number(booking.id)).filter(Boolean);

      if (bookingIds.length > 0) {
        await Rating.destroy({
          where: { bookingId: { [Op.in]: bookingIds } },
          transaction
        });
        await MatchResult.destroy({
          where: { bookingId: { [Op.in]: bookingIds } },
          transaction
        });
        await BookingJoinRequest.destroy({
          where: { bookingId: { [Op.in]: bookingIds } },
          transaction
        });
      }

      await BookingJoinRequest.destroy({
        where: { requesterTeamId: team.id },
        transaction
      });

      await Rating.destroy({
        where: {
          [Op.or]: [
            { teamIdRater: team.id },
            { teamIdRated: team.id }
          ]
        },
        transaction
      });

      await MatchResult.destroy({
        where: {
          [Op.or]: [
            { homeTeamId: team.id },
            { awayTeamId: team.id }
          ]
        },
        transaction
      });

      await TeamMember.destroy({
        where: { teamId: team.id },
        transaction
      });

      if (bookingIds.length > 0) {
        await Booking.destroy({
          where: { id: { [Op.in]: bookingIds } },
          transaction
        });
      }

      await Notification.destroy({
        where: {
          type: 'team_invite',
          metadata: {
            teamId: team.id
          }
        },
        transaction
      });

      await team.destroy({ transaction });
    });

    res.json({ success: true, data: { id: team.id }, message: 'Team deleted successfully.' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

const requestJoinTeam = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId', 'name'] });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  if (team.captainId === req.user.id) {
    return res.status(400).json({ success: false, message: 'You are already the captain of this team' });
  }

  const existing = await TeamMember.findOne({
    where: {
      teamId: team.id,
      userId: req.user.id
    }
  });

  if (existing) {
    if (existing.status === 'active') {
      return res.status(400).json({ success: false, message: 'You are already a member of this team' });
    }
    if (existing.status === 'pending') {
      return res.status(400).json({ success: false, message: 'Join request is already pending' });
    }
    if (existing.status === 'inactive') {
      await existing.update({
        role: 'player',
        status: 'pending',
        isActive: true,
        joinedAt: null
      });

      const requesterName = await getUserDisplayName(req.user.id);
      await Notification.create({
        userId: team.captainId,
        title: `Join request for ${team.name}`,
        message: `${requesterName} requested to join your team "${team.name}".`,
        type: 'system',
        metadata: { teamId: team.id, requesterId: req.user.id, event: 'team_join_request' }
      });

      return res.status(201).json({ success: true, data: existing, message: 'Join request submitted' });
    }
  }

  const request = await TeamMember.create({
    teamId: team.id,
    userId: req.user.id,
    role: 'player',
    status: 'pending',
    isActive: true
  });

  const requesterName = await getUserDisplayName(req.user.id);
  await Notification.create({
    userId: team.captainId,
    title: `Join request for ${team.name}`,
    message: `${requesterName} requested to join your team "${team.name}".`,
    type: 'system',
    metadata: { teamId: team.id, requesterId: req.user.id, event: 'team_join_request' }
  });

  res.status(201).json({ success: true, data: request, message: 'Join request submitted' });
});

const leaveTeam = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId', 'name'] });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  if (team.captainId === req.user.id) {
    return res.status(400).json({
      success: false,
      message: 'Team captain cannot leave the team. Transfer captaincy or delete the team instead.'
    });
  }

  const membership = await TeamMember.findOne({
    where: {
      teamId: team.id,
      userId: req.user.id
    }
  });

  if (!membership || membership.status === 'inactive') {
    return res.status(400).json({ success: false, message: 'You are not an active member of this team' });
  }

  const captainNotifications = await Notification.findAll({
    where: { userId: team.captainId, type: 'system', isRead: false },
    order: [['createdAt', 'DESC']],
    limit: 100
  });

  const hasPendingLeaveRequest = captainNotifications.some((item) => {
    const meta = item.metadata || {};
    return (
      meta.event === 'team_leave_request' &&
      Number(meta.teamId) === Number(team.id) &&
      Number(meta.requesterId) === Number(req.user.id)
    );
  });

  if (hasPendingLeaveRequest) {
    return res.status(400).json({ success: false, message: 'Leave request is already pending captain approval' });
  }

  const requesterName = await getUserDisplayName(req.user.id);
  await Notification.create({
    userId: team.captainId,
    title: `Leave request for ${team.name}`,
    message: `${requesterName} requested to leave "${team.name}".`,
    type: 'system',
    metadata: { teamId: team.id, requesterId: req.user.id, event: 'team_leave_request' }
  });

  res.json({ success: true, data: membership, message: 'Leave request sent to captain for approval' });
});

const getTeamMembers = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id'] });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const members = await TeamMember.findAll({
    where: { teamId: team.id },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'phone', 'address', 'dateOfBirth', 'avatarUrl', 'status', 'role']
      }
    ],
    order: [
      ['status', 'ASC'],
      ['role', 'ASC'],
      ['joinedAt', 'DESC']
    ]
  });

  res.json({ success: true, data: members });
});

const getTeamMatchHistory = asyncHandler(async (req, res) => {
  const teamId = Number(req.params.id);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid team id' });
  }

  const team = await Team.findByPk(teamId, { attributes: ['id', 'name', 'captainId'] });
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const isAdmin = req.user.role === 'admin';
  const isCaptainOfTeam = team.captainId === req.user.id;
  let isActiveMember = false;

  if (!isAdmin && !isCaptainOfTeam) {
    const membership = await TeamMember.findOne({
      where: { teamId, userId: req.user.id, status: 'active', isActive: true },
      attributes: ['teamId']
    });
    isActiveMember = !!membership;
  }

  if (!isAdmin && !isCaptainOfTeam && !isActiveMember) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view match history for this team'
    });
  }

  const completedMatches = await MatchResult.findAll({
    where: {
      matchStatus: 'completed',
      [Op.or]: [{ homeTeamId: teamId }, { awayTeamId: teamId }]
    },
    include: [
      {
        model: Team,
        as: 'homeTeam',
        attributes: ['id', 'name', 'captainId', 'logoUrl'],
        include: [{
          model: User,
          as: 'captain',
          attributes: ['id', 'username', 'firstName', 'lastName', 'email', 'phone', 'address', 'dateOfBirth', 'avatarUrl', 'status', 'role'],
          required: false
        }]
      },
      {
        model: Team,
        as: 'awayTeam',
        attributes: ['id', 'name', 'captainId', 'logoUrl'],
        include: [{
          model: User,
          as: 'captain',
          attributes: ['id', 'username', 'firstName', 'lastName', 'email', 'phone', 'address', 'dateOfBirth', 'avatarUrl', 'status', 'role'],
          required: false
        }]
      },
      { model: Booking, as: 'booking', attributes: ['startTime', 'fieldId'], include: [{ model: Field, as: 'field', attributes: ['id', 'name'], required: false }], required: false }
    ],
    order: [['recordedAt', 'DESC']]
  });

  const bookingIds = completedMatches
    .map((match) => Number(match.bookingId))
    .filter((bookingId) => Number.isInteger(bookingId) && bookingId > 0);

  const ratingRows = bookingIds.length
    ? await Rating.findAll({
        where: {
          bookingId: { [Op.in]: bookingIds }
        },
        attributes: [
          'id',
          'bookingId',
          'teamIdRater',
          'teamIdRated',
          'rating',
          'review',
          'sportsmanshipScore',
          'skillLevelScore',
          'punctualityScore',
          'teamOrganizationScore',
          'createdAt'
        ]
      })
    : [];

  const ratingMap = new Map();
  ratingRows.forEach((row) => {
    ratingMap.set(`${Number(row.bookingId)}:${Number(row.teamIdRater)}`, row);
  });

  const matches = completedMatches.map((match) => {
    const isHome = Number(match.homeTeamId) === teamId;
    const myScore = isHome ? Number(match.homeScore) : Number(match.awayScore);
    const opponentScore = isHome ? Number(match.awayScore) : Number(match.homeScore);
    const opponentTeam = isHome ? match.awayTeam : match.homeTeam;
    const currentUserTeamId =
      Number(match.homeTeam?.captainId) === Number(req.user.id)
        ? Number(match.homeTeamId)
        : Number(match.awayTeam?.captainId) === Number(req.user.id)
        ? Number(match.awayTeamId)
        : req.user.role === 'admin'
        ? teamId
        : null;
    const existingRating =
      currentUserTeamId !== null ? ratingMap.get(`${Number(match.bookingId)}:${Number(currentUserTeamId)}`) : null;

    let result = 'Draw';
    if (myScore > opponentScore) result = 'Win';
    if (myScore < opponentScore) result = 'Loss';

    return {
      id: match.id,
      bookingId: match.bookingId,
      fieldId: match.booking?.fieldId || match.booking?.field?.id || null,
      teamName: isHome ? match.homeTeam?.name || 'Unknown Team' : match.awayTeam?.name || 'Unknown Team',
      teamLogoUrl: isHome ? match.homeTeam?.logoUrl || null : match.awayTeam?.logoUrl || null,
      teamCaptain: isHome ? match.homeTeam?.captain || null : match.awayTeam?.captain || null,
      teamCaptainName:
        isHome
          ? `${match.homeTeam?.captain?.firstName || ''} ${match.homeTeam?.captain?.lastName || ''}`.trim() ||
            match.homeTeam?.captain?.username ||
            'Unknown captain'
          : `${match.awayTeam?.captain?.firstName || ''} ${match.awayTeam?.captain?.lastName || ''}`.trim() ||
            match.awayTeam?.captain?.username ||
            'Unknown captain',
      opponentTeamName: opponentTeam?.name || 'Unknown Team',
      opponentTeamLogoUrl: opponentTeam?.logoUrl || null,
      opponentCaptain: opponentTeam?.captain || null,
      opponentCaptainName:
        `${opponentTeam?.captain?.firstName || ''} ${opponentTeam?.captain?.lastName || ''}`.trim() ||
        opponentTeam?.captain?.username ||
        'Unknown captain',
      date: match.booking?.startTime || match.recordedAt || match.createdAt,
      fieldName: match.booking?.field?.name || null,
      finalScore: `${myScore}-${opponentScore}`,
      myScore,
      opponentScore,
      result,
      status: 'completed',
      opponentTeamId: opponentTeam?.id || null,
      opponentTeamLogoUrl: opponentTeam?.logoUrl || null,
      canRate: Boolean(match.bookingId && currentUserTeamId !== null && !existingRating),
          rating: existingRating
        ? {
            id: existingRating.id,
            value: existingRating.rating,
            review: existingRating.review,
            sportsmanshipScore: existingRating.sportsmanshipScore,
            skillLevelScore: existingRating.skillLevelScore,
            punctualityScore: existingRating.punctualityScore,
            teamOrganizationScore: existingRating.teamOrganizationScore,
            createdAt: existingRating.createdAt
          }
        : null
    };
  });

  const stats = matches.reduce(
    (acc, match) => {
      if (match.result === 'Win') acc.wins += 1;
      else if (match.result === 'Loss') acc.losses += 1;
      else acc.draws += 1;
      return acc;
    },
    { total: matches.length, wins: 0, losses: 0, draws: 0 }
  );

  res.json({
    success: true,
    data: {
      teamId: team.id,
      teamName: team.name,
      stats,
      matches
    }
  });
});

const getJoinRequests = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId'] });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const isAdmin = req.user.role === 'admin';
  const isCaptainOfTeam = team.captainId === req.user.id;

  if (!isAdmin && !isCaptainOfTeam) {
    return res.status(403).json({ success: false, message: 'Not authorized to view join requests for this team' });
  }

  const requests = await TeamMember.findAll({
    // Join requests are pending + isActive=true.
    // Invitations are pending + isActive=false and should not be captain-approvable here.
    where: { teamId: team.id, status: 'pending', isActive: true },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'phone', 'address', 'dateOfBirth', 'avatarUrl', 'status', 'role']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  res.json({ success: true, data: requests });
});

const addTeamMember = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId'] });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const isAdmin = req.user.role === 'admin';
  const isCaptainOfTeam = team.captainId === req.user.id;

  if (!isAdmin && !isCaptainOfTeam) {
    return res.status(403).json({ success: false, message: 'Not authorized to manage members for this team' });
  }

  const { userId, role } = req.body;

  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({ success: false, message: 'userId must be a positive integer' });
  }

  const allowedRoles = ['player', 'substitute'];
  if (role !== undefined && !allowedRoles.includes(role)) {
    return res.status(400).json({ success: false, message: `role must be one of: ${allowedRoles.join(', ')}` });
  }

  const existing = await TeamMember.findOne({ where: { teamId: team.id, userId: parsedUserId } });

  if (existing && existing.status === 'active') {
    return res.status(400).json({ success: false, message: 'User is already an active member of this team' });
  }

  if (existing) {
    await existing.update({
      status: 'active',
      joinedAt: existing.joinedAt || new Date(),
      isActive: true,
      role: role || existing.role
    });
    return res.json({ success: true, data: existing, message: 'Member added successfully' });
  }

  const member = await TeamMember.create({
    teamId: team.id,
    userId: parsedUserId,
    role: role || 'player',
    status: 'active',
    joinedAt: new Date(),
    isActive: true
  });

  res.status(201).json({ success: true, data: member, message: 'Member added successfully' });
});

const updateTeamMember = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId'] });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const isAdmin = req.user.role === 'admin';
  const isCaptainOfTeam = team.captainId === req.user.id;

  if (!isAdmin && !isCaptainOfTeam) {
    return res.status(403).json({ success: false, message: 'Not authorized to manage members for this team' });
  }

  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ success: false, message: 'userId must be a positive integer' });
  }

  const membership = await TeamMember.findOne({
    where: { teamId: team.id, userId: targetUserId }
  });

  if (!membership) {
    return res.status(404).json({ success: false, message: 'Team member not found' });
  }

  const { status, role } = req.body;
  const allowedStatuses = ['pending', 'active', 'inactive'];

  if (status !== undefined && !allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `status must be one of: ${allowedStatuses.join(', ')}` });
  }

  // Invitation pending (isActive=false) must be accepted/declined by invited player only.
  if (status === 'active' && membership.status === 'pending' && membership.isActive === false) {
    return res.status(403).json({
      success: false,
      message: 'Only the invited player can accept this invitation'
    });
  }

  const allowedRoles = ['player', 'substitute'];
  if (role !== undefined && !allowedRoles.includes(role)) {
    return res.status(400).json({ success: false, message: `role must be one of: ${allowedRoles.join(', ')}` });
  }

  const updateData = {};
  if (status !== undefined) {
    updateData.status = status;
    updateData.isActive = status === 'active';
    if (status === 'active') {
      updateData.joinedAt = membership.joinedAt || new Date();
    }
  }
  if (role !== undefined) updateData.role = role;

  const previousStatus = membership.status;
  const updated = await membership.update(updateData);

  if (status !== undefined && previousStatus === 'pending' && ['active', 'inactive'].includes(status)) {
    await Notification.create({
      userId: membership.userId,
      title: `Join request ${status === 'active' ? 'approved' : 'declined'}`,
      message:
        status === 'active'
          ? `Your request to join "${team.name}" was approved.`
          : `Your request to join "${team.name}" was declined.`,
      type: 'system',
      metadata: { teamId: team.id, event: 'team_join_request_result', status }
    });
  }

  res.json({ success: true, data: updated, message: 'Team member updated successfully' });
});

const removeTeamMember = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId', 'name'] });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const isAdmin = req.user.role === 'admin';
  const isCaptainOfTeam = team.captainId === req.user.id;

  if (!isAdmin && !isCaptainOfTeam) {
    return res.status(403).json({ success: false, message: 'Not authorized to manage members for this team' });
  }

  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ success: false, message: 'userId must be a positive integer' });
  }

  const membership = await TeamMember.findOne({
    where: { teamId: team.id, userId: targetUserId }
  });

  if (!membership) {
    return res.status(404).json({ success: false, message: 'Team member not found' });
  }

  if (targetUserId === team.captainId) {
    return res.status(400).json({ success: false, message: 'Cannot remove team captain' });
  }

  await membership.update({ status: 'inactive', isActive: false });
  const actorName = await getUserDisplayName(req.user.id);
  await Notification.create({
    userId: targetUserId,
    title: `Removed from ${team.name}`,
    message: `${actorName} removed you from "${team.name}".`,
    type: 'system',
    metadata: { teamId: team.id, actorId: req.user.id, event: 'team_member_removed' }
  });
  res.json({ success: true, data: membership, message: 'Member removed successfully' });
});

const respondLeaveRequest = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId', 'name'] });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const isAdmin = req.user.role === 'admin';
  const isCaptainOfTeam = team.captainId === req.user.id;
  if (!isAdmin && !isCaptainOfTeam) {
    return res.status(403).json({ success: false, message: 'Not authorized to respond to leave requests for this team' });
  }

  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ success: false, message: 'userId must be a positive integer' });
  }

  const { action } = req.body || {};
  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ success: false, message: 'action must be either accept or decline' });
  }

  const membership = await TeamMember.findOne({
    where: { teamId: team.id, userId: targetUserId }
  });

  if (!membership || membership.status !== 'active' || membership.isActive !== true) {
    return res.status(400).json({ success: false, message: 'No active member found for this leave request' });
  }

  if (action === 'accept') {
    await membership.update({ status: 'inactive', isActive: false });
  }

  const captainNotifications = await Notification.findAll({
    where: { userId: req.user.id, type: 'system', isRead: false },
    order: [['createdAt', 'DESC']],
    limit: 100
  });

  await Promise.all(
    captainNotifications
      .filter((item) => {
        const meta = item.metadata || {};
        return (
          meta.event === 'team_leave_request' &&
          Number(meta.teamId) === Number(team.id) &&
          Number(meta.requesterId) === Number(targetUserId)
        );
      })
      .map((item) =>
        item.update({
          isRead: true,
          readAt: new Date().toISOString(),
          metadata: { ...(item.metadata || {}), resolvedAction: action, resolvedBy: req.user.id }
        })
      )
  );

  const actorName = await getUserDisplayName(req.user.id);
  await Notification.create({
    userId: targetUserId,
    title: `Leave request ${action === 'accept' ? 'approved' : 'declined'}`,
    message:
      action === 'accept'
        ? `${actorName} approved your request to leave "${team.name}".`
        : `${actorName} declined your request to leave "${team.name}".`,
    type: 'system',
    metadata: { teamId: team.id, actorId: req.user.id, event: 'team_leave_request_result', status: action }
  });

  res.json({
    success: true,
    data: membership,
    message: action === 'accept' ? 'Leave request approved' : 'Leave request declined'
  });
});

// Upload team logo (captain only)
const uploadTeamLogo = asyncHandler(async (req, res) => {
  const multer = require('multer');
  const fs = require('fs');
  const path = require('path');
  const serverConfig = require('../config/serverConfig');
  const maxLogoSize = serverConfig.upload.maxSize;

  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId', 'logoUrl'] });
  if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

  const isCaptainOfTeam = team.captainId === req.user.id;
  if (!isCaptainOfTeam) {
    return res.status(403).json({ success: false, message: 'Not authorized to update team logo' });
  }

  const uploadDir = getUploadDir('team-logo');
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `team_${team.id}_${Date.now()}${ext}`;
      cb(null, filename);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: maxLogoSize },
    fileFilter: (req, file, cb) => {
      if (!serverConfig.isAllowedImageUpload(file)) {
        return cb(new Error('Invalid file type'));
      }
      cb(null, true);
    }
  }).single('logo');

  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMb = Math.round(maxLogoSize / (1024 * 1024));
        return res.status(400).json({ success: false, message: `Logo image must be ${maxMb}MB or smaller` });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // delete previous logo file if exists (optional)
    try {
      if (team.logoUrl && typeof team.logoUrl === 'string' && team.logoUrl.startsWith('/uploads')) {
        const previousLogoAbsolutePath = resolveManagedUploadPath(team.logoUrl);

        if (previousLogoAbsolutePath && fs.existsSync(previousLogoAbsolutePath)) {
          fs.unlinkSync(previousLogoAbsolutePath);
        }
      }
    } catch (unlinkErr) {
      // ignore unlink errors
    }

    const publicPath = `/uploads/team-logo/${req.file.filename}`;
    await team.update({ logoUrl: publicPath });

    res.json({ success: true, data: { logoUrl: publicPath }, message: 'Logo uploaded successfully' });
  });
});

const deleteTeamLogo = asyncHandler(async (req, res) => {
  const fs = require('fs');
  const path = require('path');

  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId', 'logoUrl'] });
  if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

  const isCaptainOfTeam = team.captainId === req.user.id;
  if (!isCaptainOfTeam) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete team logo' });
  }

  const currentLogo = team.logoUrl;
  if (!currentLogo) {
    return res.json({ success: true, data: { logoUrl: null }, message: 'Team logo already removed' });
  }

  try {
    if (typeof currentLogo === 'string' && currentLogo.startsWith('/uploads')) {
      const absolutePath = resolveManagedUploadPath(currentLogo);

      if (absolutePath && fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
  } catch (_unlinkErr) {
      // Ignore file cleanup issues and still clear the DB value.
  }

  await team.update({ logoUrl: null });

  res.json({ success: true, data: { logoUrl: null }, message: 'Team logo deleted successfully' });
});

// captain/admin can invite a player by creating a pending membership and notifying them
const invitePlayer = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId', 'name'] });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const isAdmin = req.user.role === 'admin';
  const isCaptainOfTeam = team.captainId === req.user.id;

  if (!isAdmin && !isCaptainOfTeam) {
    return res.status(403).json({ success: false, message: 'Not authorized to invite players to this team' });
  }

  const { email } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const targetUser = await User.findOne({ where: { email: normalizedEmail } });
  const parsedUserId = targetUser ? targetUser.id : null;

  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'No player account found with this email' });
  }

  if (targetUser.role !== 'player') {
    return res.status(400).json({ success: false, message: 'Only users with player role can be invited' });
  }

  if (parsedUserId === team.captainId) {
    return res.status(400).json({ success: false, message: 'Cannot invite yourself' });
  }

  const existing = await TeamMember.findOne({ where: { teamId: team.id, userId: parsedUserId } });
  if (existing) {
    if (existing.status === 'active') {
      return res.status(400).json({ success: false, message: 'User is already an active member of this team' });
    }
    if (existing.status === 'pending') {
      return res.status(400).json({ success: false, message: 'There is already a pending request or invitation for this user' });
    }
  }

  let membership;
  if (existing) {
    membership = await existing.update({
      role: 'player',
      status: 'pending',
      isActive: false
    });
  } else {
    membership = await TeamMember.create({
      teamId: team.id,
      userId: parsedUserId,
      role: 'player',
      status: 'pending',
      isActive: false
    });
  }

  const inviterName = await getUserDisplayName(req.user.id);
  await Notification.create({
    userId: parsedUserId,
    title: `Invitation to join ${team.name}`,
    message: `You have been invited by ${inviterName} to join the team "${team.name}".`,
    type: 'team_invite',
    metadata: { teamId: team.id, inviterId: req.user.id }
  });

  res.status(201).json({ success: true, data: membership, message: 'Invitation sent' });
});

// invitee can accept the invitation
const acceptInvite = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId', 'name'] });
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const userId = req.user.id;
  const membership = await TeamMember.findOne({ where: { teamId: team.id, userId } });
  if (!membership || membership.status !== 'pending' || membership.isActive) {
    return res.status(400).json({ success: false, message: 'No pending invitation found' });
  }

  await membership.update({ status: 'active', joinedAt: membership.joinedAt || new Date(), isActive: true });
  const inviteeName = await getUserDisplayName(req.user.id);
  await Notification.create({
    userId: team.captainId,
    title: `Invitation accepted`,
    message: `${inviteeName} accepted your invitation to join "${team.name}".`,
    type: 'system',
    metadata: { teamId: team.id, inviteeId: req.user.id, event: 'team_invite_accepted' }
  });
  res.json({ success: true, data: membership, message: 'Invitation accepted' });
});

// invitee can decline the invitation
const declineInvite = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id, { attributes: ['id', 'captainId', 'name'] });
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const userId = req.user.id;
  const membership = await TeamMember.findOne({ where: { teamId: team.id, userId } });
  if (!membership || membership.status !== 'pending' || membership.isActive) {
    return res.status(400).json({ success: false, message: 'No pending invitation found' });
  }

  await membership.update({ status: 'inactive', isActive: false });
  const inviteeName = await getUserDisplayName(req.user.id);
  await Notification.create({
    userId: team.captainId,
    title: `Invitation declined`,
    message: `${inviteeName} declined your invitation to join "${team.name}".`,
    type: 'system',
    metadata: { teamId: team.id, inviteeId: req.user.id, event: 'team_invite_declined' }
  });
  res.json({ success: true, data: membership, message: 'Invitation declined' });
});

module.exports = {
  getAllTeams,
  getTeamById,
  getMyTeams,
  getMyInvitations,
  getCaptainedTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  requestJoinTeam,
  leaveTeam,
  getTeamMembers,
  getTeamMatchHistory,
  getJoinRequests,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  respondLeaveRequest,
  invitePlayer,
  acceptInvite,
  declineInvite,
  uploadTeamLogo,
  deleteTeamLogo
};
