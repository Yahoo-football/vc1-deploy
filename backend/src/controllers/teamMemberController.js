const { TeamMember, Team, User, Notification } = require('../models');

// Support async handler for this module.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Build invitation id for rendering.
const buildInvitationId = (teamId, userId) => `${teamId}:${userId}`;

// Resolve team member from identifier into a display-safe value.
const resolveTeamMemberFromIdentifier = async (identifier) => {
  if (!identifier) return null;

  if (typeof identifier === 'string' && identifier.includes(':')) {
    const [teamIdRaw, userIdRaw] = identifier.split(':');
    const teamId = Number(teamIdRaw);
    const userId = Number(userIdRaw);
    if (!Number.isInteger(teamId) || !Number.isInteger(userId)) return null;
    return TeamMember.findOne({ where: { teamId, userId } });
  }

  const numericId = Number(identifier);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  return TeamMember.findByPk(numericId);
};

// Get invitation expiry hours for the current flow.
const getInvitationExpiryHours = () => {
  const parsed = Number(process.env.INVITATION_EXPIRE_HOURS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 168; // default 7 days
};

// Check whether invitation expired is true.
const isInvitationExpired = (teamMember) => {
  const expiryHours = getInvitationExpiryHours();
  const createdAt = teamMember?.createdAt ? new Date(teamMember.createdAt) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
  const expiresAt = new Date(createdAt.getTime() + expiryHours * 60 * 60 * 1000);
  return Date.now() > expiresAt.getTime();
};

// Get captain id for the current flow.
const getCaptainId = (team) => {
  if (!team) return null;
  if (team.captainId !== undefined && team.captainId !== null) return Number(team.captainId);
  if (team.captain_id !== undefined && team.captain_id !== null) return Number(team.captain_id);
  return null;
};

const getAllTeamMembers = asyncHandler(async (req, res) => {
  const { teamId, userId, status } = req.query;
  const whereClause = {};
  
  if (teamId) whereClause.teamId = teamId;
  if (userId) whereClause.userId = userId;
  if (status) whereClause.status = status;

  if (req.user.role !== 'admin') {
    let canViewTeamMembers = false;

    if (teamId) {
      const team = await Team.findByPk(teamId);
      canViewTeamMembers = team && getCaptainId(team) === req.user.id;
    }

    if (!canViewTeamMembers) {
      if (!userId) {
        whereClause.userId = req.user.id;
      } else if (Number(userId) !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to view these team members' });
      }
    }
  }
  
  const teamMembers = await TeamMember.findAll({
    where: whereClause,
    include: [
      {
        model: Team,
        as: 'team',
        include: [
          {
            model: User,
            as: 'captain',
            attributes: ['id', 'username', 'firstName', 'lastName']
          }
        ]
      },
      { model: User, as: 'user', attributes: ['id', 'username', 'email', 'firstName', 'lastName'] }
    ]
  });

  const data = teamMembers.map((member) => {
    const plain = member.toJSON();
    return {
      ...plain,
      id: plain.id ?? buildInvitationId(plain.teamId, plain.userId),
      invitationId: buildInvitationId(plain.teamId, plain.userId)
    };
  });

  res.json({ success: true, data });
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
        include: [
          {
            model: User,
            as: 'captain',
            attributes: ['id', 'username', 'firstName', 'lastName']
          }
        ]
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  const data = invitations
    .filter((inv) => !isInvitationExpired(inv))
    .map((inv) => {
      const plain = inv.toJSON();
      return {
        ...plain,
        id: plain.id ?? buildInvitationId(plain.teamId, plain.userId),
        invitationId: buildInvitationId(plain.teamId, plain.userId)
      };
    });

  res.json({ success: true, data });
});

const getTeamMemberById = asyncHandler(async (req, res) => {
  const teamMember = await TeamMember.findByPk(req.params.id, {
    include: [
      { model: Team, as: 'team' },
      { model: User, as: 'user', attributes: ['id', 'username', 'email', 'firstName', 'lastName'] }
    ]
  });
  
  if (!teamMember) {
    return res.status(404).json({ success: false, message: 'Team member not found' });
  }
  
  res.json({ success: true, data: teamMember });
});

const createTeamMember = asyncHandler(async (req, res) => {
  try {
    const { teamId, userId, role } = req.body;

    if (!teamId || !userId) {
      return res.status(400).json({ success: false, message: 'teamId and userId are required' });
    }

    const team = await Team.findByPk(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (req.user.role !== 'admin' && getCaptainId(team) !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the team captain can invite players' });
    }

    const existingMember = await TeamMember.findOne({ where: { teamId, userId } });
    if (existingMember) {
      return res.status(400).json({ success: false, message: 'User is already invited or already in this team' });
    }

    const teamMember = await TeamMember.create({
      teamId,
      userId,
      role: role || 'player',
      status: 'pending',
      joinedAt: null,
      isActive: false
    });

    await Notification.create({
      userId,
      title: 'Team invitation',
      message: `You have been invited to join ${team.name}.`,
      type: 'team_invite',
      metadata: {
        teamId: team.id,
        teamMemberId: buildInvitationId(teamMember.teamId, teamMember.userId),
        invitedBy: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      data: {
        ...teamMember.toJSON(),
        id: teamMember.id ?? buildInvitationId(teamMember.teamId, teamMember.userId),
        invitationId: buildInvitationId(teamMember.teamId, teamMember.userId)
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const updateTeamMember = asyncHandler(async (req, res) => {
  try {
    const teamMember = await TeamMember.findByPk(req.params.id);
    
    if (!teamMember) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    
    // Authorization check
    if (teamMember.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this team member' });
    }
    
    const updatedTeamMember = await teamMember.update(req.body);
    res.json({ success: true, data: updatedTeamMember });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const respondToInvitation = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['active', 'inactive'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be active or inactive' });
  }

  const teamMemberRecord = await resolveTeamMemberFromIdentifier(req.params.id);
  if (!teamMemberRecord) {
    return res.status(404).json({ success: false, message: 'Invitation not found' });
  }

  const teamMember = await TeamMember.findOne({
    where: {
      teamId: teamMemberRecord.teamId,
      userId: teamMemberRecord.userId
    },
    include: [{ model: Team, as: 'team' }]
  });

  if (!teamMember) {
    return res.status(404).json({ success: false, message: 'Invitation not found' });
  }

  const isRecipient = Number(teamMember.userId) === req.user.id;
  const teamCaptainId = getCaptainId(teamMember.team);
  const isCaptain = req.user.role === 'admin' || teamCaptainId === req.user.id;

  if (!isRecipient && !isCaptain) {
    return res.status(403).json({ success: false, message: 'Not authorized to respond to this invitation' });
  }

  if (teamMember.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'This invitation was already processed' });
  }

  if (isInvitationExpired(teamMember)) {
    await teamMember.update({
      status: 'inactive',
      joinedAt: null,
      isActive: false
    });
    return res.status(400).json({
      success: false,
      message: 'This invitation has expired'
    });
  }

  const updatedTeamMember = await teamMember.update({
    status,
    joinedAt: status === 'active' ? new Date() : null,
    isActive: status === 'active'
  });

  if (isRecipient && teamCaptainId && teamCaptainId !== req.user.id) {
    const teamName = teamMember.team?.name || 'your team';
    await Notification.create({
      userId: teamCaptainId,
      title: 'Invitation response',
      message: `A player has ${status} the invitation to join ${teamName}.`,
      type: 'team_invite',
      metadata: {
        teamId: teamMember.teamId,
        teamMemberId: buildInvitationId(teamMember.teamId, teamMember.userId),
        respondedBy: req.user.id,
        status
      }
    });
  }

  res.json({ success: true, data: updatedTeamMember });
});

const deleteTeamMember = asyncHandler(async (req, res) => {
  try {
    const teamMember = await TeamMember.findByPk(req.params.id);
    
    if (!teamMember) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    
    // Authorization check
    if (teamMember.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this team member' });
    }
    
    await teamMember.destroy();
    res.json({ success: true, message: 'Team member deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = {
  getAllTeamMembers,
  getMyInvitations,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  respondToInvitation,
  deleteTeamMember
};
