const { Booking, Field, User, Team, TeamMember, BookingJoinRequest, MatchResult, Notification, sequelize } = require('../models');
const { Op } = require('sequelize');

const BOOKING_BASE_INCLUDE = [
  {
    model: Field,
    as: 'field',
    attributes: [
      'id',
      'name',
      'address',
      'pricePerHour',
      'discountPercent',
      'status',
      'closureMessage',
      'closureStartAt',
      'closureEndAt'
    ]
  },
  {
    model: Team,
    as: 'team',
    attributes: ['id', 'name', 'skillLevel', 'maxPlayers', 'captainId', 'shirtColor', 'jerseyColors'],
    include: [
      {
        model: User,
        as: 'captain',
        attributes: ['id', 'username', 'firstName', 'lastName']
      },
      {
        model: TeamMember,
        as: 'teamMembers',
        attributes: ['userId', 'role', 'status', 'isActive'],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'firstName', 'lastName']
          }
        ],
        required: false
      }
    ],
    required: false
  },
  { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'], required: false },
  {
    model: MatchResult,
    as: 'matchResult',
    attributes: ['id', 'homeScore', 'awayScore', 'matchStatus', 'recordedAt', 'recordedBy', 'mvpPlayerId', 'matchNotes'],
    include: [{ model: User, as: 'mvpPlayer', attributes: ['id', 'username', 'firstName', 'lastName'], required: false }],
    required: false
  },
  { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
];

// Serialize booking for API responses.
const serializeBooking = (booking) => {
  const payload = booking && typeof booking.toJSON === 'function' ? booking.toJSON() : booking;
  if (!payload) return payload;
  return {
    ...payload,
    openForOpponents: Boolean(payload.isMatchmaking)
  };
};

const getActiveMemberUserIdsForTeams = async (teamIds = [], excludeUserIds = []) => {
  const normalizedTeamIds = Array.from(new Set(teamIds.map((teamId) => Number(teamId)).filter(Boolean)));
  if (normalizedTeamIds.length === 0) return [];

  const memberships = await TeamMember.findAll({
    where: {
      teamId: { [Op.in]: normalizedTeamIds },
      status: 'active',
      isActive: true
    },
    attributes: ['userId'],
    raw: true
  });

  const excludedIds = new Set(excludeUserIds.map((userId) => Number(userId)).filter(Boolean));
  return Array.from(
    new Set(
      memberships
        .map((membership) => Number(membership.userId))
        .filter((userId) => userId && !excludedIds.has(userId))
    )
  );
};

const createTeamBookingNotifications = async ({
  teamIds = [],
  excludeUserIds = [],
  title,
  message,
  type = 'booking',
  metadata = {},
  transaction
}) => {
  const recipientIds = await getActiveMemberUserIdsForTeams(teamIds, excludeUserIds);
  if (recipientIds.length === 0) return;

  await Notification.bulkCreate(
    recipientIds.map((userId) => ({
      userId,
      title,
      message,
      type,
      metadata
    })),
    transaction ? { transaction } : undefined
  );
};

const SCHEDULE_SHOWCASE_START_HOURS = [8, 10, 12, 14, 16, 18, 20];

// Get schedule showcase target for the current flow.
const getScheduleShowcaseTarget = (date) => {
  const [year, month, day] = String(date || '').split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return 2;
  return (year + month + day) % 2 === 0 ? 2 : 4;
};

// Build date at hour for rendering.
const buildDateAtHour = (date, hour) => {
  const bookingDate = new Date(`${date}T00:00:00`);
  bookingDate.setHours(hour, 0, 0, 0);
  return bookingDate;
};
const getEffectiveHourlyRate = (field) => {
  const basePrice = Number(field?.pricePerHour || 0);
  const discountPercent = Math.min(100, Math.max(0, Number(field?.discountPercent || 0)));
  return Number((basePrice * (1 - discountPercent / 100)).toFixed(2));
};

const enrichScheduleWithShowcaseBookings = ({ bookings }) => bookings.map(serializeBooking);

// Support require captain role for this module.
const requireCaptainRole = (req, res) => {
  if (req.user.role !== 'captain') {
    res.status(403).json({
      success: false,
      message: 'Only team captains can use this feature.'
    });
    return false;
  }
  return true;
};

const requireOpenMatchAccess = (req, res) => {
  if (!['captain', 'field_owner'].includes(req.user.role)) {
    res.status(403).json({
      success: false,
      message: 'Only team captains or field owners can use this feature.'
    });
    return false;
  }
  return true;
};
const isClosedStatus = (booking) => booking.status === 'cancelled' || booking.status === 'completed';
// Check whether unavailable for join is true.
const isUnavailableForJoin = (booking) =>
  isClosedStatus(booking) || new Date(booking.startTime) <= new Date();
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'];

// Create booking for the current flow.
const createBooking = async (req, res) => {
  try {
    const { fieldId, startTime, endTime, teamId } = req.body;

    if (!fieldId || !startTime || !endTime || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'fieldId, startTime, endTime, and teamId are required'
      });
    }

    const field = await Field.findByPk(fieldId);
    if (!field) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }

      const requestedStart = new Date(startTime);
      const requestedEnd = new Date(endTime);
      if (Number.isNaN(requestedStart.getTime()) || Number.isNaN(requestedEnd.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid start time or end time.'
        });
      }
      if (requestedEnd <= requestedStart) {
        return res.status(400).json({
          success: false,
          message: 'End time must be after start time.'
        });
      }

      if (field.status !== 'available') {
        const nowMs = Date.now();
        const closureStart = field.closureStartAt ? new Date(field.closureStartAt) : null;
        const closureEnd = field.closureEndAt ? new Date(field.closureEndAt) : null;
        const closureStartMs = closureStart && !Number.isNaN(closureStart.getTime()) ? closureStart.getTime() : null;
        const closureEndMs = closureEnd && !Number.isNaN(closureEnd.getTime()) ? closureEnd.getTime() : null;
        const hasClosureWindow = closureStartMs !== null || closureEndMs !== null;

        const overlapsClosureWindow = hasClosureWindow
          ? requestedStart.getTime() < (closureEndMs ?? Number.POSITIVE_INFINITY) &&
            requestedEnd.getTime() > (closureStartMs ?? Number.NEGATIVE_INFINITY)
          : true;

        const canAutoReopen =
          closureEndMs !== null &&
          nowMs >= closureEndMs &&
          requestedStart.getTime() >= closureEndMs;

        if (canAutoReopen) {
          await field.update({
            status: 'available',
            closureMessage: null,
            closureStartAt: null,
            closureEndAt: null
          });
        } else if (overlapsClosureWindow) {
          return res.status(400).json({
            success: false,
            message: field.closureMessage || `This field is currently ${field.status} for the selected time. Please choose another time or field.`
          });
        }
      }

    const duration = (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60);
    const totalPrice = Number((duration * getEffectiveHourlyRate(field)).toFixed(2));

      const existingBooking = await Booking.findOne({
        where: {
          fieldId,
          status: { [Op.in]: ACTIVE_BOOKING_STATUSES },
          [Op.and]: [{ startTime: { [Op.lt]: requestedEnd } }, { endTime: { [Op.gt]: requestedStart } }]
        }
      });

      if (existingBooking) {
        return res.status(400).json({
          success: false,
          message: 'Field already has a booking for this time slot.'
        });
      }

    const booking = await Booking.create({
      createdBy: req.user.id,
      fieldId,
      teamId,
      startTime,
      endTime,
      totalPrice,
      status: 'pending',
      isMatchmaking: false
    });

    if (field.ownerId) {
      const team = await Team.findByPk(teamId, { attributes: ['id', 'name', 'shirtColor', 'jerseyColors'] });
      await Notification.create({
        userId: field.ownerId,
        title: `New booking request for ${field.name}`,
        message: `${team?.name || 'A team'} requested to book your field.`,
        type: 'booking',
        metadata: {
          event: 'booking_request',
          bookingId: booking.id,
          fieldId: field.id,
          fieldName: field.name,
          teamId: team?.id || teamId,
          teamName: team?.name || null,
          startTime,
          endTime,
          totalPrice,
          status: 'pending'
        }
      });

      await createTeamBookingNotifications({
        teamIds: [team?.id || teamId],
        excludeUserIds: [req.user.id],
        title: `Team booking request created for ${field.name}`,
        message: `${team?.name || 'Your team'} requested to book ${field.name}.`,
        metadata: {
          event: 'team_booking_created',
          bookingId: booking.id,
          fieldId: field.id,
          fieldName: field.name,
          teamId: team?.id || teamId,
          teamName: team?.name || null,
          startTime,
          endTime,
          totalPrice,
          status: 'pending'
        }
      });
    }

    res.status(201).json({ success: true, data: serializeBooking(booking) });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  }
};

// Get bookings for the current flow.
const getBookings = async (req, res) => {
  try {
    let where = {};

    if (req.user.role === 'player' || req.user.role === 'guest') {
      const memberships = await TeamMember.findAll({
        where: { userId: req.user.id, status: 'active', isActive: true },
        attributes: ['teamId'],
        raw: true
      });
      const teamIds = memberships.map((membership) => membership.teamId);
      where = teamIds.length > 0
        ? {
            [Op.or]: [
              { createdBy: req.user.id },
              { teamId: { [Op.in]: teamIds } },
              { opponentTeamId: { [Op.in]: teamIds } }
            ]
          }
        : { createdBy: req.user.id };
    }
    if (req.user.role === 'captain') {
      const captainedTeams = await Team.findAll({
        where: { captainId: req.user.id },
        attributes: ['id']
      });
      const captainedTeamIds = captainedTeams.map((team) => team.id);

      if (captainedTeamIds.length > 0) {
        where = {
          [Op.or]: [
            { createdBy: req.user.id },
            { teamId: { [Op.in]: captainedTeamIds } },
            { opponentTeamId: { [Op.in]: captainedTeamIds } }
          ]
        };
      } else {
        where = { createdBy: req.user.id };
      }
    }
    if (req.user.role === 'field_owner') {
      const fields = await Field.findAll({ where: { ownerId: req.user.id }, attributes: ['id'] });
      const fieldIds = fields.map((f) => f.id);
      where = { fieldId: { [Op.in]: fieldIds } };
    }

    const bookings = await Booking.findAll({
      where,
      include: BOOKING_BASE_INCLUDE,
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: bookings.map(serializeBooking) });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};

// Get booking by id for the current flow.
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: BOOKING_BASE_INCLUDE
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isBooker = booking.createdBy === req.user.id;
    const isAdmin = req.user.role === 'admin';

    let isOwner = false;
    if (req.user.role === 'field_owner') {
      const field = await Field.findByPk(booking.fieldId);
      isOwner = field && field.ownerId === req.user.id;
    }

    let isTeamMember = false;
    if (req.user.role === 'player' || req.user.role === 'captain') {
      const membership = await TeamMember.findOne({
        where: {
          userId: req.user.id,
          teamId: { [Op.in]: [booking.teamId, booking.opponentTeamId].filter(Boolean) },
          status: 'active',
          isActive: true
        }
      });
      isTeamMember = Boolean(membership);
    }

    if (!isBooker && !isOwner && !isAdmin && !isTeamMember) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking.'
      });
    }

    res.json({ success: true, data: serializeBooking(booking) });
  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: error.message
    });
  }
};

// Get booking schedule for the current flow.
const getBookingSchedule = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'date query is required (YYYY-MM-DD)'
      });
    }

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);
    if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD.'
      });
    }

    const [fields, bookings] = await Promise.all([
      Field.findAll({
        order: [['name', 'ASC']]
      }),
      Booking.findAll({
        where: {
          status: { [Op.notIn]: ['cancelled', 'completed'] },
          [Op.and]: [{ startTime: { [Op.lt]: dayEnd } }, { endTime: { [Op.gt]: dayStart } }]
        },
        include: BOOKING_BASE_INCLUDE,
        order: [['startTime', 'ASC']]
      })
    ]);

    res.json({
      success: true,
      data: {
        fields,
        bookings: enrichScheduleWithShowcaseBookings({ date, fields, bookings })
      }
    });
  } catch (error) {
    console.error('Get booking schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking schedule',
      error: error.message
    });
  }
};

// Get public booking schedule for the current flow.
const getPublicBookingSchedule = async (req, res) => {
  try {
    const { date } = req.query;
    const limitValue = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : null;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'date query is required (YYYY-MM-DD)'
      });
    }

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);
    if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD.'
      });
    }

    const fields = await Field.findAll({
      attributes: ['id', 'name', 'address', 'pricePerHour', 'images', 'status', 'closureMessage', 'closureStartAt', 'closureEndAt'],
      where: {
        isArchived: false
      },
      order: [['name', 'ASC']],
      ...(limit ? { limit } : {})
    });

    const fieldIds = fields.map((field) => field.id);
    if (fieldIds.length === 0) {
      return res.json({
        success: true,
        data: {
          fields: [],
          bookings: []
        }
      });
    }

    const bookings = await Booking.findAll({
      attributes: ['id', 'fieldId', 'teamId', 'startTime', 'endTime', 'status', 'createdBy', 'isMatchmaking'],
      where: {
        fieldId: { [Op.in]: fieldIds },
        status: { [Op.notIn]: ['cancelled', 'completed'] },
        [Op.and]: [{ startTime: { [Op.lt]: dayEnd } }, { endTime: { [Op.gt]: dayStart } }]
      },
      include: [
        { model: Team, as: 'team', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'], required: false },
        { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'], required: false }
      ],
      order: [['startTime', 'ASC']]
    });

    return res.json({
      success: true,
      data: {
        fields,
        bookings: enrichScheduleWithShowcaseBookings({ date, fields, bookings })
      }
    });
  } catch (error) {
    console.error('Get public booking schedule error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch public booking schedule',
      error: error.message
    });
  }
};

// Update booking status in local state.
const updateBookingStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { status, startTime, endTime } = req.body;

    const allowedStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!allowedStatuses.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowedStatuses.join(', ')}`
      });
    }

    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: Field, as: 'field' },
        { model: Team, as: 'team', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] },
        { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] }
      ],
      transaction
    });

    if (!booking) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isOwner = booking.field && booking.field.ownerId === req.user.id;
    const isBooker = booking.createdBy === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isTeamCaptain = booking.team && booking.team.captainId === req.user.id;
    const isOpponentCaptain = booking.opponentTeam && booking.opponentTeam.captainId === req.user.id;
    const isCaptain = req.user.role === 'captain';

    if ((isBooker || (isCaptain && (isTeamCaptain || isOpponentCaptain))) && status === 'cancelled') {
      const canCancelStatus = booking.status === 'pending' || booking.status === 'confirmed';
      if (!canCancelStatus) {
        return res.status(400).json({
          success: false,
          message: 'Can only cancel pending or confirmed bookings.'
        });
      }
    } else if (isOwner || isAdmin) {
      // field owner/admin
    } else {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking.'
      });
    }

    const previousStatus = booking.status;
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      cancelled: [],
      completed: []
    };

    if (!validTransitions[previousStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${previousStatus} to ${status}.`
      });
    }

    let nextStartTime = booking.startTime;
    let nextEndTime = booking.endTime;
    const hasScheduleUpdate = startTime !== undefined || endTime !== undefined;
    const isConfirmingByOwnerOrAdmin = status === 'confirmed' && previousStatus === 'pending' && (isOwner || isAdmin);

    if (hasScheduleUpdate && !isConfirmingByOwnerOrAdmin) {
      return res.status(400).json({
        success: false,
        message: 'startTime/endTime can only be updated when owner/admin confirms a pending booking.'
      });
    }

    if (hasScheduleUpdate) {
      if (!startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'Both startTime and endTime are required when updating booking date/time.'
        });
      }

      const parsedStart = new Date(startTime);
      const parsedEnd = new Date(endTime);
      if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid startTime or endTime.'
        });
      }
      if (parsedEnd <= parsedStart) {
        return res.status(400).json({
          success: false,
          message: 'endTime must be after startTime.'
        });
      }

      nextStartTime = parsedStart;
      nextEndTime = parsedEnd;
    }

    // Completing a booking is restricted to field owner/admin approval.
    if (status === 'completed' && !(isOwner || isAdmin)) {
      return res.status(403).json({
        success: false,
        message: 'Only field owner or admin can mark this booking as completed.'
      });
    }

    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      const overlappingConfirmed = await Booking.findOne({
        where: {
          id: { [Op.ne]: booking.id },
          fieldId: booking.fieldId,
          status: 'confirmed',
          [Op.and]: [{ startTime: { [Op.lt]: nextEndTime } }, { endTime: { [Op.gt]: nextStartTime } }]
        }
      });
      if (overlappingConfirmed) {
        return res.status(400).json({
          success: false,
          message: 'Another booking is already confirmed for this time slot.'
        });
      }
    }

    const updatePayload = { status };
    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      updatePayload.ownerRevenueLocked = true;
    }
    if (status === 'cancelled' && previousStatus === 'confirmed') {
      updatePayload.ownerRevenueLocked = true;
    }
    if (hasScheduleUpdate) {
      updatePayload.startTime = nextStartTime;
      updatePayload.endTime = nextEndTime;
    }
    await booking.update(updatePayload, { transaction });

    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      const teamName = booking.team?.name || 'Team';
      const opponentTeamName = booking.opponentTeam?.name || null;
      const actorName =
        req.user.role === 'field_owner'
          ? req.user.firstName || req.user.username || 'Field owner'
          : req.user.firstName || req.user.username || 'Admin';
      const fieldName = booking.field?.name || 'the field';

      const recipients = new Set();
      if (booking.team?.captainId) recipients.add(booking.team.captainId);
      else if (booking.createdBy) recipients.add(booking.createdBy);
      if (booking.opponentTeam?.captainId) recipients.add(booking.opponentTeam.captainId);

      if (recipients.size > 0) {
        await Notification.bulkCreate(
          Array.from(recipients).map((captainId) => ({
            userId: captainId,
            title: req.user.role === 'field_owner' ? 'Booking accepted by field owner' : 'Booking confirmed',
            message: opponentTeamName
              ? `${actorName} confirmed your booking at ${fieldName}: ${teamName} vs ${opponentTeamName}.`
              : `${actorName} confirmed your booking at ${fieldName} for ${teamName}.`,
            type: 'booking',
            metadata: {
              event: 'booking_confirmed',
              bookingId: booking.id,
              fieldName,
              teamName,
              opponentTeamName,
              confirmedByUserId: req.user.id
            }
          })),
          { transaction }
        );
      }

      await createTeamBookingNotifications({
        teamIds: [booking.team?.id, booking.opponentTeam?.id],
        excludeUserIds: [req.user.id],
        title: req.user.role === 'field_owner' ? 'Team booking accepted' : 'Team booking confirmed',
        message: opponentTeamName
          ? `${actorName} confirmed the match booking at ${fieldName}: ${teamName} vs ${opponentTeamName}.`
          : `${actorName} confirmed your team booking at ${fieldName} for ${teamName}.`,
        metadata: {
          event: 'booking_confirmed',
          bookingId: booking.id,
          fieldId: booking.fieldId,
          fieldName,
          teamId: booking.team?.id || null,
          teamName,
          opponentTeamId: booking.opponentTeam?.id || null,
          opponentTeamName,
          confirmedByUserId: req.user.id
        },
        transaction
      });

      const overlappingPending = await Booking.findAll({
        where: {
          id: { [Op.ne]: booking.id },
          fieldId: booking.fieldId,
          status: 'pending',
          [Op.and]: [{ startTime: { [Op.lt]: nextEndTime } }, { endTime: { [Op.gt]: nextStartTime } }]
        },
        include: [{ model: Team, as: 'team', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] }],
        transaction
      });

      if (overlappingPending.length > 0) {
        await Booking.update(
          { status: 'cancelled' },
          { where: { id: { [Op.in]: overlappingPending.map((item) => item.id) } }, transaction }
        );

        const rejectedNotifications = [];
        for (const pendingItem of overlappingPending) {
          const pendingTeamName = pendingItem.team?.name || 'Your team';
          const recipientId = pendingItem.team?.captainId || pendingItem.createdBy;
          if (!recipientId) continue;

          rejectedNotifications.push({
            userId: recipientId,
            title: 'Booking request was not selected',
            message: `Your request for ${fieldName} (${pendingTeamName}) was cancelled because another team was accepted.`,
            type: 'booking',
            metadata: {
              event: 'booking_rejected_by_competing_confirmation',
              bookingId: pendingItem.id,
              winningBookingId: booking.id,
              fieldName,
              teamName: pendingTeamName
            }
          });
        }

        if (rejectedNotifications.length > 0) {
          await Notification.bulkCreate(rejectedNotifications, { transaction });
        }

        for (const pendingItem of overlappingPending) {
          await createTeamBookingNotifications({
            teamIds: [pendingItem.team?.id],
            excludeUserIds: [req.user.id],
            title: 'Team booking request was not selected',
            message: `Your team request for ${fieldName} (${pendingItem.team?.name || 'your team'}) was cancelled because another booking was accepted.`,
            metadata: {
              event: 'booking_rejected_by_competing_confirmation',
              bookingId: pendingItem.id,
              winningBookingId: booking.id,
              fieldId: pendingItem.fieldId,
              fieldName,
              teamId: pendingItem.team?.id || null,
              teamName: pendingItem.team?.name || null
            },
            transaction
          });
        }
      }
    }

    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      const teamName = booking.team?.name || 'Team';
      const opponentTeamName = booking.opponentTeam?.name || null;
      const cancellerName =
        req.user.role === 'field_owner'
          ? req.user.firstName || req.user.username || 'Field owner'
          : req.user.firstName || req.user.username || 'A user';
      const fieldName = booking.field?.name || 'the field';

      const recipients = new Set();
      if (booking.team?.captainId) recipients.add(booking.team.captainId);
      else if (booking.createdBy) recipients.add(booking.createdBy);
      if (booking.opponentTeam?.captainId) recipients.add(booking.opponentTeam.captainId);

      if (recipients.size > 0) {
        await Notification.bulkCreate(
          Array.from(recipients).map((captainId) => ({
            userId: captainId,
            title: req.user.role === 'field_owner' ? 'Booking cancelled by field owner' : 'Booking cancelled',
            message: opponentTeamName
              ? `${cancellerName} cancelled your booking at ${fieldName}: ${teamName} vs ${opponentTeamName}.`
              : `${cancellerName} cancelled your booking at ${fieldName} for ${teamName}.`,
            type: 'booking',
            metadata: {
              event: 'booking_cancelled',
              bookingId: booking.id,
              fieldName,
              teamName,
              opponentTeamName,
              cancelledByUserId: req.user.id
            }
          })),
          { transaction }
        );
      }

      await createTeamBookingNotifications({
        teamIds: [booking.team?.id, booking.opponentTeam?.id],
        excludeUserIds: [req.user.id],
        title: req.user.role === 'field_owner' ? 'Team booking cancelled by field owner' : 'Team booking cancelled',
        message: opponentTeamName
          ? `${cancellerName} cancelled the match booking at ${fieldName}: ${teamName} vs ${opponentTeamName}.`
          : `${cancellerName} cancelled your team booking at ${fieldName} for ${teamName}.`,
        metadata: {
          event: 'booking_cancelled',
          bookingId: booking.id,
          fieldId: booking.fieldId,
          fieldName,
          teamId: booking.team?.id || null,
          teamName,
          opponentTeamId: booking.opponentTeam?.id || null,
          opponentTeamName,
          cancelledByUserId: req.user.id
        },
        transaction
      });

      const ownerRecipientId = booking.field?.ownerId;
      const cancelledByOwner = req.user.role === 'field_owner';
      if (!cancelledByOwner && ownerRecipientId) {
        await Notification.create({
          userId: ownerRecipientId,
          title: 'Captain cancelled a booking',
          message: opponentTeamName
            ? `${cancellerName} cancelled the confirmed booking at ${fieldName}: ${teamName} vs ${opponentTeamName}.`
            : `${cancellerName} cancelled the booking at ${fieldName} for ${teamName}.`,
          type: 'booking',
          metadata: {
            event: 'booking_cancelled_by_captain',
            bookingId: booking.id,
            fieldId: booking.fieldId,
            fieldName,
            teamName,
            opponentTeamName,
            cancelledByUserId: req.user.id
          }
        }, { transaction });
      }
    }

    await transaction.commit();
    res.json({ success: true, data: serializeBooking(booking) });
  } catch (error) {
    await transaction.rollback();
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
};

// Support confirm match teams for this module.
const confirmMatchTeams = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: Field, as: 'field' },
        { model: Team, as: 'team', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] },
        { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] }
      ]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isOwner = booking.field && booking.field.ownerId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to confirm this match.'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Only pending bookings can be confirmed as a match. Current status: ${booking.status}`
      });
    }

    if (!booking.teamId || !booking.opponentTeamId || !booking.team || !booking.opponentTeam) {
      return res.status(400).json({
        success: false,
        message: 'Match cannot be confirmed until both teams are assigned.'
      });
    }

    const overlappingConfirmed = await Booking.findOne({
      where: {
        id: { [Op.ne]: booking.id },
        fieldId: booking.fieldId,
        status: 'confirmed',
        [Op.and]: [{ startTime: { [Op.lt]: booking.endTime } }, { endTime: { [Op.gt]: booking.startTime } }]
      }
    });
    if (overlappingConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'Another booking is already confirmed for this time slot.'
      });
    }

    await booking.update({ status: 'confirmed', isMatchmaking: false });

    const homeTeamName = booking.team.name;
    const awayTeamName = booking.opponentTeam.name;
    const recipients = new Set();
    if (booking.team.captainId) recipients.add(booking.team.captainId);
    if (booking.opponentTeam.captainId) recipients.add(booking.opponentTeam.captainId);

    if (recipients.size > 0) {
      await Notification.bulkCreate(
        Array.from(recipients).map((captainId) => {
          const isHomeCaptain = Number(captainId) === Number(booking.team.captainId);
          const ownTeamName = isHomeCaptain ? homeTeamName : awayTeamName;
          const otherTeamName = isHomeCaptain ? awayTeamName : homeTeamName;
          return {
            userId: captainId,
            title: 'Match confirmed',
            message: `Your match with ${otherTeamName} has been confirmed.`,
            type: 'booking',
            metadata: {
              event: 'match_teams_confirmed',
              bookingId: booking.id,
              fieldId: booking.fieldId,
              fieldName: booking.field?.name || null,
              ownTeamName,
              opponentTeamName: otherTeamName,
              confirmedByUserId: req.user.id
            }
          };
        })
      );
    }

    const refreshed = await Booking.findByPk(booking.id, { include: BOOKING_BASE_INCLUDE });
    res.json({
      success: true,
      data: serializeBooking(refreshed),
      message: `Match confirmed: ${homeTeamName} vs ${awayTeamName}`
    });
  } catch (error) {
    console.error('Confirm match teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm match teams',
      error: error.message
    });
  }
};

// Toggle open for opponents in the UI.
const toggleOpenForOpponents = async (req, res) => {
  try {
    if (!requireCaptainRole(req, res)) return;
    const requestedOpenFlag = req.body.openForOpponents;
    const requestedMatchmakingFlag = req.body.isMatchmaking;
    const openForOpponents = typeof requestedOpenFlag === 'boolean' ? requestedOpenFlag : requestedMatchmakingFlag;

    if (typeof openForOpponents !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'openForOpponents (or isMatchmaking) must be a boolean'
      });
    }

    const booking = await Booking.findByPk(req.params.id, {
      include: [{ model: Team, as: 'team', attributes: ['id', 'captainId', 'name'] }]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!booking.team || booking.team.captainId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the booking owner team captain can manage Open for Opponents.'
      });
    }

    if (isClosedStatus(booking)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot open or close matchmaking for cancelled/completed bookings.'
      });
    }

    if (openForOpponents && booking.opponentTeamId) {
      return res.status(400).json({
        success: false,
        message: 'This booking already has an opponent team.'
      });
    }

    const wasMatchmaking = Boolean(booking.isMatchmaking);
    await booking.update({ isMatchmaking: openForOpponents });

    if (!wasMatchmaking && openForOpponents) {
      const audience = await User.findAll({
        where: {
          id: { [Op.ne]: req.user.id },
          role: { [Op.in]: ['player', 'captain'] },
          status: 'active'
        },
        attributes: ['id']
      });

      if (audience.length > 0) {
        await Notification.bulkCreate(
          audience.map((u) => ({
            userId: u.id,
            title: 'New Open Match',
            message: `${booking.team.name} opened a match for opponents.`,
            type: 'system',
            metadata: {
              event: 'open_match_created',
              bookingId: booking.id,
              teamId: booking.team.id
            }
          }))
        );
      }
    }

    if (!openForOpponents) {
      const pendingRequests = await BookingJoinRequest.findAll({
        where: { bookingId: booking.id, status: 'pending' },
        include: [{ model: Team, as: 'requesterTeam', attributes: ['id', 'captainId', 'name'] }]
      });

      if (pendingRequests.length > 0) {
        await BookingJoinRequest.update(
          {
            status: 'rejected',
            respondedAt: new Date(),
            respondedBy: req.user.id
          },
          {
            where: { bookingId: booking.id, status: 'pending' }
          }
        );

        await Notification.bulkCreate(
          pendingRequests
            .filter((request) => request.requesterTeam?.captainId)
            .map((request) => ({
              userId: request.requesterTeam.captainId,
              title: 'Join request closed',
              message: `Open match for "${booking.team.name}" is no longer available.`,
              type: 'system',
              metadata: { event: 'booking_join_closed', bookingId: booking.id, requestId: request.id }
            }))
        );
      }
    }

    const updatedBooking = await Booking.findByPk(req.params.id, { include: BOOKING_BASE_INCLUDE });
    res.json({ success: true, data: serializeBooking(updatedBooking) });
  } catch (error) {
    console.error('Toggle openForOpponents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update open match status',
      error: error.message
    });
  }
};

// Get open matches for the current flow.
const getOpenMatches = async (req, res) => {
  try {
    if (!requireOpenMatchAccess(req, res)) return;

    const where = {
      isMatchmaking: true,
      opponentTeamId: null,
      status: { [Op.notIn]: ['cancelled', 'completed'] },
      startTime: { [Op.gt]: new Date() }
    };

    const captainedTeams = await Team.findAll({
      where: { captainId: req.user.id },
      attributes: ['id']
    });
    const captainedTeamIds = captainedTeams.map((team) => team.id);
    if (captainedTeamIds.length > 0) {
      where.teamId = { [Op.notIn]: captainedTeamIds };
    }

    const bookings = await Booking.findAll({
      where,
      include: BOOKING_BASE_INCLUDE,
      order: [['startTime', 'ASC']]
    });

    const openMatches = bookings.map(serializeBooking);

    if (captainedTeamIds.length > 0 && openMatches.length > 0) {
      const requests = await BookingJoinRequest.findAll({
        where: {
          bookingId: { [Op.in]: openMatches.map((b) => b.id) },
          requesterTeamId: { [Op.in]: captainedTeamIds }
        },
        attributes: ['id', 'bookingId', 'requesterTeamId', 'status', 'createdAt']
      });

      const requestsByBookingId = requests.reduce((acc, request) => {
        if (!acc[request.bookingId]) acc[request.bookingId] = [];
        acc[request.bookingId].push(request);
        return acc;
      }, {});

      for (const booking of openMatches) {
        booking.myRequests = requestsByBookingId[booking.id] || [];
      }
    }

    res.json({ success: true, data: openMatches });
  } catch (error) {
    console.error('Get open matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch open matches',
      error: error.message
    });
  }
};

// Request join match from the API.
const requestJoinMatch = async (req, res) => {
  try {
    if (!requireOpenMatchAccess(req, res)) return;
    const bookingId = Number(req.params.id);
    const requesterTeamId = Number(req.body.teamId);
    const message = req.body.message || null;

    if (!Number.isInteger(requesterTeamId) || requesterTeamId <= 0) {
      return res.status(400).json({ success: false, message: 'teamId must be a positive integer' });
    }

    const requesterTeam = await Team.findOne({
      where: { id: requesterTeamId, captainId: req.user.id },
      attributes: ['id', 'name', 'captainId', 'skillLevel', 'shirtColor', 'jerseyColors']
    });
    if (!requesterTeam) {
      return res.status(403).json({
        success: false,
        message: 'You can only request using a team where you are captain.'
      });
    }

    const booking = await Booking.findByPk(bookingId, {
      include: [
        { model: Team, as: 'team', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] },
        { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'shirtColor', 'jerseyColors'] }
      ]
    });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.opponentTeamId) {
      return res.status(400).json({
        success: false,
        message: `Already matched: ${booking.team?.name || 'Team'} vs ${booking.opponentTeam?.name || 'Opponent'}`
      });
    }

    if (!booking.isMatchmaking || isUnavailableForJoin(booking)) {
      return res.status(400).json({
        success: false,
        message: 'This booking is not currently open for opponents.'
      });
    }

    if (booking.teamId === requesterTeam.id) {
      return res.status(400).json({
        success: false,
        message: 'Your own team cannot request to join this booking.'
      });
    }

    const existingRequest = await BookingJoinRequest.findOne({
      where: {
        bookingId,
        requesterTeamId: requesterTeam.id
      }
    });

    let joinRequest;
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Join request already pending for this team.'
        });
      }
      if (existingRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'This team has already been accepted for this match.'
        });
      }

      joinRequest = await existingRequest.update({
        status: 'pending',
        message,
        requesterCaptainId: req.user.id,
        respondedAt: null,
        respondedBy: null
      });
    } else {
      joinRequest = await BookingJoinRequest.create({
        bookingId,
        requesterTeamId: requesterTeam.id,
        requesterCaptainId: req.user.id,
        message,
        status: 'pending'
      });
    }

    if (booking.team?.captainId) {
      await Notification.create({
        userId: booking.team.captainId,
        title: `Join request for ${booking.team.name}`,
        message: `${requesterTeam.name} requested to join your open match.`,
        type: 'system',
        metadata: {
          event: 'booking_join_request',
          bookingId,
          requestId: joinRequest.id,
          requesterTeamId: requesterTeam.id,
          requesterTeamName: requesterTeam.name,
          requesterTeamSkillLevel: requesterTeam.skillLevel || null,
          requesterCaptainId: req.user.id,
          requesterCaptainName: req.user.firstName || req.user.username || 'Captain',
          requestMessage: message || null
        }
      });
    }

    await Notification.create({
      userId: req.user.id,
      title: 'Join request submitted',
      message: `Your team "${requesterTeam.name}" requested to play against "${booking.team?.name || 'the host team'}".`,
      type: 'system',
      metadata: {
        event: 'booking_join_request_submitted',
        bookingId,
        requestId: joinRequest.id,
        requesterTeamId: requesterTeam.id
      }
    });

    res.status(existingRequest ? 200 : 201).json({
      success: true,
      data: joinRequest,
      message: 'Join request submitted'
    });
  } catch (error) {
    console.error('Request join match error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request to join match',
      error: error.message
    });
  }
};

// Get booking join requests for the current flow.
const getBookingJoinRequests = async (req, res) => {
  try {
    if (!requireCaptainRole(req, res)) return;
    const bookingId = Number(req.params.id);

    const booking = await Booking.findByPk(bookingId, {
      include: [
        { model: Team, as: 'team', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] },
        { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'shirtColor', 'jerseyColors'] }
      ]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!booking.team || booking.team.captainId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the booking owner team captain can view join requests.'
      });
    }

    const joinRequests = await BookingJoinRequest.findAll({
      where: { bookingId },
      include: [
        {
          model: Team,
          as: 'requesterTeam',
          attributes: ['id', 'name', 'skillLevel', 'captainId', 'shirtColor', 'jerseyColors'],
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

    res.json({ success: true, data: joinRequests });
  } catch (error) {
    console.error('Get booking join requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch join requests',
      error: error.message
    });
  }
};

// Support respond to join request for this module.
const respondToJoinRequest = async (req, res) => {
  try {
    if (!requireCaptainRole(req, res)) return;
    const bookingId = Number(req.params.id);
    const requestId = Number(req.params.requestId);
    const action = req.body.action;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action must be either "accept" or "reject"'
      });
    }
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'requestId must be a positive integer'
      });
    }

    const booking = await Booking.findByPk(bookingId, {
      include: [{ model: Team, as: 'team', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] }]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (!booking.team || booking.team.captainId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the booking owner team captain can respond to join requests.'
      });
    }

    const targetRequest = await BookingJoinRequest.findByPk(requestId, {
      include: [{ model: Team, as: 'requesterTeam', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] }]
    });
    if (!targetRequest || targetRequest.bookingId !== bookingId) {
      return res.status(404).json({ success: false, message: 'Join request not found for this booking' });
    }
    if (targetRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending requests can be processed.'
      });
    }

    const updatedRequest = await sequelize.transaction(async (transaction) => {
      if (action === 'accept') {
        if (booking.opponentTeamId) {
          throw new Error(
            `Already matched: ${booking.team?.name || 'Team'} vs ${booking.opponentTeam?.name || 'Opponent'}`
          );
        }
        if (!booking.isMatchmaking || isUnavailableForJoin(booking)) {
          throw new Error('This booking can no longer accept opponents.');
        }

        await booking.update(
          {
            opponentTeamId: targetRequest.requesterTeamId,
            isMatchmaking: false
          },
          { transaction }
        );

        await BookingJoinRequest.update(
          {
            status: 'rejected',
            respondedAt: new Date(),
            respondedBy: req.user.id
          },
          {
            where: {
              bookingId,
              status: 'pending',
              id: { [Op.ne]: targetRequest.id }
            },
            transaction
          }
        );
      }

      await targetRequest.update(
        {
          status: action === 'accept' ? 'accepted' : 'rejected',
          respondedAt: new Date(),
          respondedBy: req.user.id
        },
        { transaction }
      );

      return targetRequest;
    });

    const accepted = action === 'accept';
    if (targetRequest.requesterTeam?.captainId) {
      await Notification.create({
        userId: targetRequest.requesterTeam.captainId,
        title: `Join request ${accepted ? 'accepted' : 'rejected'}`,
        message: accepted
          ? `Your team "${targetRequest.requesterTeam.name}" has been accepted for a match against "${booking.team.name}".`
          : `Your request to join "${booking.team.name}" was rejected.`,
        type: 'system',
        metadata: {
          event: 'booking_join_request_result',
          bookingId,
          requestId: targetRequest.id,
          status: accepted ? 'accepted' : 'rejected'
        }
      });
    }

    if (accepted) {
      const pendingOthers = await BookingJoinRequest.findAll({
        where: { bookingId, status: 'rejected', id: { [Op.ne]: targetRequest.id } },
        include: [{ model: Team, as: 'requesterTeam', attributes: ['captainId', 'name'] }]
      });

      if (pendingOthers.length > 0) {
        await Notification.bulkCreate(
          pendingOthers
            .filter((request) => request.requesterTeam?.captainId)
            .map((request) => ({
              userId: request.requesterTeam.captainId,
              title: 'Join request closed',
              message: `Open match for "${booking.team.name}" has been filled by another team.`,
              type: 'system',
              metadata: {
                event: 'booking_join_closed_by_acceptance',
                bookingId,
                requestId: request.id
              }
            }))
        );
      }
    }

    res.json({
      success: true,
      data: updatedRequest,
      message: `Join request ${accepted ? 'accepted' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('Respond join request error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to respond to join request',
      error: error.message
    });
  }
};

// Check whether cel matched opponent is allowed.
const cancelMatchedOpponent = async (req, res) => {
  try {
    if (!requireCaptainRole(req, res)) return;
    const bookingId = Number(req.params.id);

    const booking = await Booking.findByPk(bookingId, {
      include: [
        { model: Team, as: 'team', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] },
        { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'captainId', 'shirtColor', 'jerseyColors'] }
      ]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!booking.opponentTeamId || !booking.opponentTeam) {
      return res.status(400).json({
        success: false,
        message: 'This booking does not have an opponent to cancel.'
      });
    }

    const isHomeCaptain = booking.team?.captainId === req.user.id;
    const isOpponentCaptain = booking.opponentTeam?.captainId === req.user.id;

    if (!isHomeCaptain && !isOpponentCaptain) {
      return res.status(403).json({
        success: false,
        message: 'Only captains of matched teams can cancel this match.'
      });
    }

    const homeTeamName = booking.team?.name || 'Team A';
    const awayTeamName = booking.opponentTeam?.name || 'Team B';
    const actorTeamName = isHomeCaptain ? homeTeamName : awayTeamName;

    await sequelize.transaction(async (transaction) => {
      await BookingJoinRequest.update(
        {
          status: 'rejected',
          respondedAt: new Date(),
          respondedBy: req.user.id
        },
        {
          where: {
            bookingId: booking.id,
            requesterTeamId: booking.opponentTeamId,
            status: 'accepted'
          },
          transaction
        }
      );

      await booking.update(
        {
          opponentTeamId: null,
          isMatchmaking: false
        },
        { transaction }
      );
    });

    const otherCaptainId = isHomeCaptain ? booking.opponentTeam?.captainId : booking.team?.captainId;
    if (otherCaptainId) {
      await Notification.create({
        userId: otherCaptainId,
        title: 'Matched opponent cancelled',
        message: `${actorTeamName} cancelled the match pairing (${homeTeamName} vs ${awayTeamName}).`,
        type: 'system',
        metadata: {
          event: 'matched_opponent_cancelled',
          bookingId: booking.id,
          homeTeamName,
          awayTeamName,
          cancelledByTeam: actorTeamName
        }
      });
    }

    await Notification.create({
      userId: req.user.id,
      title: 'Match cancelled',
      message: `You cancelled the match pairing (${homeTeamName} vs ${awayTeamName}).`,
      type: 'system',
      metadata: {
        event: 'matched_opponent_cancelled_self',
        bookingId: booking.id,
        homeTeamName,
        awayTeamName
      }
    });

    const updatedBooking = await Booking.findByPk(booking.id, { include: BOOKING_BASE_INCLUDE });
    res.json({
      success: true,
      data: serializeBooking(updatedBooking),
      message: `Matched pairing cancelled: ${homeTeamName} vs ${awayTeamName}`
    });
  } catch (error) {
    console.error('Cancel matched opponent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel matched opponent',
      error: error.message
    });
  }
};

const POPULAR_SLOT_WINDOWS = [
  { startHour: 8, endHour: 10, label: 'Morning Session' },
  { startHour: 10, endHour: 12, label: 'Late Morning' },
  { startHour: 12, endHour: 14, label: 'Lunch Break' },
  { startHour: 14, endHour: 16, label: 'Afternoon Session' },
  { startHour: 16, endHour: 18, label: 'After Work' },
  { startHour: 18, endHour: 20, label: 'Evening Prime Time' },
  { startHour: 20, endHour: 22, label: 'Night Session' }
];

// Support clamp for this module.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// Support to two digits for this module.
const toTwoDigits = (value) => String(value).padStart(2, '0');

// Format slot time for display.
const formatSlotTime = (startHour, endHour) => `${toTwoDigits(startHour)}:00 - ${toTwoDigits(endHour)}:00`;

// Map to tone for the current UI state.
const rateToTone = (rate) => {
  if (rate >= 75) return 'limited';
  if (rate >= 50) return 'moderate';
  if (rate >= 25) return 'available';
  return 'cool';
};

// Map to status for the current UI state.
const rateToStatus = (rate) => {
  if (rate >= 75) return 'Limited';
  if (rate >= 50) return 'Moderate';
  if (rate >= 25) return 'Available';
  return 'Cool';
};

// Support to local ms for this module.
const toLocalMs = (dateValue, timezoneOffsetMinutes) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime() - timezoneOffsetMinutes * 60 * 1000;
};

// Get start of local day ms for the current flow.
const getStartOfLocalDayMs = (localMs) => {
  const localDate = new Date(localMs);
  return Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate());
};

// Calculate overlap minutes from the current data.
const calculateOverlapMinutes = (startA, endA, startB, endB) => {
  const overlap = Math.min(endA, endB) - Math.max(startA, startB);
  return overlap > 0 ? Math.floor(overlap / 60000) : 0;
};

// Public booking statistics for landing page (no auth required)
const getPublicBookingStats = async (req, res) => {
  try {
    const lookbackDays = clamp(Number(req.query.lookbackDays) || 30, 1, 365);
    const top = clamp(Number(req.query.top) || 4, 1, POPULAR_SLOT_WINDOWS.length);
    const timezoneOffsetMinutes = Number(req.query.timezoneOffsetMinutes) || 0;
    const statuses = String(req.query.statuses || 'confirmed,completed')
      .split(',')
      .map((status) => status.trim())
      .filter((status) => ['pending', 'confirmed', 'cancelled', 'completed'].includes(status));
    const effectiveStatuses = statuses.length > 0 ? statuses : ['confirmed', 'completed'];

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (lookbackDays - 1));

    const [bookings, totalFields] = await Promise.all([
      Booking.findAll({
        attributes: ['id', 'fieldId', 'startTime', 'endTime'],
        where: {
          status: { [Op.in]: effectiveStatuses },
          startTime: { [Op.gte]: since }
        },
        order: [['startTime', 'DESC']]
      }),
      Field.count({
        where: {
          status: { [Op.ne]: 'maintenance' }
        }
      })
    ]);

    const populatedSlots = POPULAR_SLOT_WINDOWS.map((slot) => ({
      ...slot,
      time: formatSlotTime(slot.startHour, slot.endHour),
      bookedMinutes: 0,
      bookingCount: 0
    }));

    const slotDurationMinutes = 120;

    bookings.forEach((booking) => {
      const localStartMs = toLocalMs(booking.startTime, timezoneOffsetMinutes);
      const localEndMs = toLocalMs(booking.endTime, timezoneOffsetMinutes);
      if (localStartMs === null || localEndMs === null || localEndMs <= localStartMs) return;

      const startDayMs = getStartOfLocalDayMs(localStartMs);
      const endDayMs = getStartOfLocalDayMs(localEndMs);

      for (let dayMs = startDayMs; dayMs <= endDayMs; dayMs += 24 * 60 * 60 * 1000) {
        const dayStartMs = dayMs;
        const dayEndMs = dayMs + 24 * 60 * 60 * 1000;
        const bookingSegmentStart = Math.max(localStartMs, dayStartMs);
        const bookingSegmentEnd = Math.min(localEndMs, dayEndMs);
        if (bookingSegmentEnd <= bookingSegmentStart) continue;

        populatedSlots.forEach((slot) => {
          const slotStartMs = dayStartMs + slot.startHour * 60 * 60 * 1000;
          const slotEndMs = dayStartMs + slot.endHour * 60 * 60 * 1000;
          const overlapMinutes = calculateOverlapMinutes(bookingSegmentStart, bookingSegmentEnd, slotStartMs, slotEndMs);
          if (overlapMinutes > 0) {
            slot.bookedMinutes += overlapMinutes;
            slot.bookingCount += 1;
          }
        });
      }
    });

    const possibleMinutesPerSlot = Math.max(totalFields, 1) * lookbackDays * slotDurationMinutes;

    const timeSlots = populatedSlots
      .map((slot) => {
        const rate = Math.round((slot.bookedMinutes / possibleMinutesPerSlot) * 100);
        const normalizedRate = clamp(rate, 0, 100);

        return {
          time: slot.time,
          label: slot.label,
          rate: normalizedRate,
          status: rateToStatus(normalizedRate),
          tone: rateToTone(normalizedRate),
          bookingCount: slot.bookingCount,
          bookedMinutes: slot.bookedMinutes,
          startHour: slot.startHour,
          endHour: slot.endHour
        };
      })
      .sort((a, b) => {
        if (b.bookedMinutes !== a.bookedMinutes) return b.bookedMinutes - a.bookedMinutes;
        return a.startHour - b.startHour;
      })
      .slice(0, top);

    res.json({
      success: true,
      data: {
        timeSlots,
        bookings: bookings.slice(0, 50), // Return a sample of recent bookings for client-side stats if needed
        meta: {
          lookbackDays,
          totalFields,
          totalBookings: bookings.length,
          statuses: effectiveStatuses,
          timezoneOffsetMinutes
        }
      }
    });
  } catch (error) {
    console.error('Get public booking stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking statistics',
      error: error.message
    });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingSchedule,
  getPublicBookingSchedule,
  getBookingById,
  updateBookingStatus,
  confirmMatchTeams,
  toggleOpenForOpponents,
  getOpenMatches,
  requestJoinMatch,
  getBookingJoinRequests,
  respondToJoinRequest,
  cancelMatchedOpponent,
  getPublicBookingStats
};
