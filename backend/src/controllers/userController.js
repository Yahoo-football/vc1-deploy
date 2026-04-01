const { Op } = require('sequelize');
const {
  User,
  Field,
  Booking,
  Team,
  Notification,
  TeamMember,
  BookingJoinRequest,
  MatchResult,
  Rating,
  RoleRequest,
  ChatConversation,
  ChatMessage,
  sequelize
} = require('../models');
const bcrypt = require('bcryptjs');

// Support async handler for this module.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const uniqueIds = (values = []) =>
  Array.from(new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    attributes: { exclude: ['password'] },
    include: [
      { model: Field, as: 'fields' },
      { model: Booking, as: 'createdBookings' },
      { model: Team, as: 'teams', through: { attributes: [] } },
      { model: Notification, as: 'notifications' }
    ]
  });
  res.json({ success: true, data: users });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    attributes: { exclude: ['password'] },
    include: [
      {
        model: Field,
        as: 'fields',
        where: { isArchived: false },
        required: false,
        attributes: ['id', 'name', 'city', 'pricePerHour', 'status', 'fieldType', 'surfaceType']
      },
      {
        model: Team,
        as: 'captainedTeams',
        required: false,
        attributes: ['id', 'name', 'isActive', 'skillLevel', 'createdAt']
      },
      {
        model: Team,
        as: 'teams',
        required: false,
        attributes: ['id', 'name', 'isActive', 'skillLevel'],
        through: {
          attributes: ['role', 'status', 'joinedAt', 'isActive']
        }
      },
      { model: Booking, as: 'createdBookings', attributes: ['id'], required: false },
      { model: Notification, as: 'notifications', attributes: ['id'], required: false }
    ]
  });
  
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  
  res.json({ success: true, data: user });
});

const createUser = asyncHandler(async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, phone, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role: role || 'player'
    });
    
    const userJson = user.toJSON();
    delete userJson.password;

    res.status(201).json({ success: true, data: userJson });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const updateUser = asyncHandler(async (req, res) => {
  try {
    const { username, email, firstName, lastName, phone, role, status } = req.body;
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Authorization check
    if (user.id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this user' });
    }
    
    await user.update({
      username,
      email,
      firstName,
      lastName,
      phone,
      role,
      status
    });
    
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const deleteUser = asyncHandler(async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Authorization check
    if (user.id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this user' });
    }

    await sequelize.transaction(async (transaction) => {
      const ownedFields = await Field.findAll({
        where: { ownerId: user.id },
        attributes: ['id'],
        transaction
      });
      const captainedTeams = await Team.findAll({
        where: { captainId: user.id },
        attributes: ['id'],
        transaction
      });

      const ownedFieldIds = uniqueIds(ownedFields.map((field) => field.id));
      const captainedTeamIds = uniqueIds(captainedTeams.map((team) => team.id));

      const relatedBookings = await Booking.findAll({
        where: {
          [Op.or]: [
            { createdBy: user.id },
            ...(ownedFieldIds.length > 0 ? [{ fieldId: { [Op.in]: ownedFieldIds } }] : []),
            ...(captainedTeamIds.length > 0
              ? [
                  { teamId: { [Op.in]: captainedTeamIds } },
                  { opponentTeamId: { [Op.in]: captainedTeamIds } }
                ]
              : [])
          ]
        },
        attributes: ['id'],
        transaction
      });
      const relatedBookingIds = uniqueIds(relatedBookings.map((booking) => booking.id));

      if (relatedBookingIds.length > 0) {
        await Rating.destroy({
          where: { bookingId: { [Op.in]: relatedBookingIds } },
          transaction
        });
        await MatchResult.destroy({
          where: { bookingId: { [Op.in]: relatedBookingIds } },
          transaction
        });
        await BookingJoinRequest.destroy({
          where: { bookingId: { [Op.in]: relatedBookingIds } },
          transaction
        });
      }

      if (captainedTeamIds.length > 0) {
        await BookingJoinRequest.destroy({
          where: { requesterTeamId: { [Op.in]: captainedTeamIds } },
          transaction
        });
        await Rating.destroy({
          where: {
            [Op.or]: [
              { teamIdRater: { [Op.in]: captainedTeamIds } },
              { teamIdRated: { [Op.in]: captainedTeamIds } }
            ]
          },
          transaction
        });
        await MatchResult.destroy({
          where: {
            [Op.or]: [
              { homeTeamId: { [Op.in]: captainedTeamIds } },
              { awayTeamId: { [Op.in]: captainedTeamIds } }
            ]
          },
          transaction
        });
        await TeamMember.destroy({
          where: { teamId: { [Op.in]: captainedTeamIds } },
          transaction
        });
      }

      await TeamMember.destroy({
        where: { userId: user.id },
        transaction
      });

      if (relatedBookingIds.length > 0) {
        await Booking.destroy({
          where: { id: { [Op.in]: relatedBookingIds } },
          transaction
        });
      }

      if (captainedTeamIds.length > 0) {
        await Team.destroy({
          where: { id: { [Op.in]: captainedTeamIds } },
          transaction
        });
      }

      if (ownedFieldIds.length > 0) {
        await Field.destroy({
          where: { id: { [Op.in]: ownedFieldIds } },
          transaction
        });
      }

      await Notification.destroy({
        where: { userId: user.id },
        transaction
      });

      await ChatMessage.destroy({
        where: {
          [Op.or]: [{ senderId: user.id }, { recipientId: user.id }]
        },
        transaction
      });

      await ChatConversation.destroy({
        where: {
          [Op.or]: [{ userOneId: user.id }, { userTwoId: user.id }, { createdBy: user.id }]
        },
        transaction
      });

      await BookingJoinRequest.destroy({
        where: { requesterCaptainId: user.id },
        transaction
      });

      await RoleRequest.destroy({
        where: { requesterId: user.id },
        transaction
      });

      await user.destroy({ transaction });
    });

    res.json({ success: true, message: 'User and related records deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Search users by username or email (partial match)
const searchUsers = asyncHandler(async (req, res) => {
  const q = req.query.q;
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Query parameter q is required' });
  }

  const role = req.query.role;
  const teamId = req.query.teamId ? Number(req.query.teamId) : null;

  const where = {
    [Op.or]: [
      { username: { [Op.like]: `%${q}%` } },
      { email: { [Op.like]: `%${q}%` } },
      { firstName: { [Op.like]: `%${q}%` } },
      { lastName: { [Op.like]: `%${q}%` } }
    ]
  };

  if (role) {
    where.role = role;
  }

  if (teamId) {
    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ success: false, message: 'teamId must be a positive integer' });
    }

    const team = await Team.findByPk(teamId, { attributes: ['id', 'captainId'] });
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isCaptainOfTeam = team.captainId === req.user.id;
    if (!isAdmin && !isCaptainOfTeam) {
      return res.status(403).json({ success: false, message: 'Not authorized to search invite candidates for this team' });
    }

    const existingMembers = await TeamMember.findAll({
      where: {
        teamId,
        status: { [Op.in]: ['active', 'pending'] }
      },
      attributes: ['userId']
    });

    const blockedUserIds = Array.from(new Set([team.captainId, ...existingMembers.map((m) => m.userId)]));
    if (blockedUserIds.length > 0) {
      where.id = { [Op.notIn]: blockedUserIds };
    }
  }

  const users = await User.findAll({
    where,
    attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'avatarUrl'],
    limit: 10
  });

  res.json({ success: true, data: users });
});

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  searchUsers
};
