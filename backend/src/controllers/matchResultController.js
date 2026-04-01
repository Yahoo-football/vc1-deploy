const { MatchResult, Booking, Team, TeamMember, User, Field } = require('../models');
const { Op } = require('sequelize');

// Support async handler for this module.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Get result includes for the current flow.
const getResultIncludes = () => [
  { model: Booking, as: 'booking', include: [{ model: Field, as: 'field', attributes: ['id', 'ownerId', 'name'], required: false }] },
  { model: Team, as: 'homeTeam' },
  { model: Team, as: 'awayTeam' },
  { model: User, as: 'mvpPlayer', attributes: ['id', 'username', 'email', 'firstName', 'lastName'] },
  { model: User, as: 'recorder', attributes: ['id', 'username', 'email', 'firstName', 'lastName'] }
];

// Check whether a manage result for booking is allowed.
const canManageResultForBooking = (booking, user) => {
  if (!booking || !user) return false;
  if (user.role === 'admin') return true;
  if (booking.field?.ownerId === user.id) return true;
  if (booking.team?.captainId === user.id) return true;
  return booking.opponentTeam?.captainId === user.id;

};

const getEligibleMvpPlayerIds = async ({ homeTeamId, awayTeamId, homeCaptainId, awayCaptainId }) => {
  const validTeamIds = [homeTeamId, awayTeamId].filter((id) => Number.isInteger(Number(id)) && Number(id) > 0);
  if (validTeamIds.length === 0) return new Set();

  const memberships = await TeamMember.findAll({
    where: {
      teamId: { [Op.in]: validTeamIds },
      status: 'active',
      isActive: true
    },
    attributes: ['userId'],
    raw: true
  });

  const eligibleIds = new Set(
    memberships
      .map((member) => Number(member.userId))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  const captainIds = [homeCaptainId, awayCaptainId]
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  for (const captainId of captainIds) eligibleIds.add(captainId);

  return eligibleIds;
};

const getAllMatchResults = asyncHandler(async (req, res) => {
  const { matchStatus, homeTeamId, awayTeamId } = req.query;
  const whereClause = {};
  
  if (matchStatus) whereClause.matchStatus = matchStatus;
  if (homeTeamId) whereClause.homeTeamId = homeTeamId;
  if (awayTeamId) whereClause.awayTeamId = awayTeamId;

  const matchResults = await MatchResult.findAll({
    where: whereClause,
    include: getResultIncludes(),
    order: [['recordedAt', 'DESC']]
  });
  res.json({ success: true, data: matchResults });
});

const getMatchResultById = asyncHandler(async (req, res) => {
  const matchResult = await MatchResult.findByPk(req.params.id, {
    include: getResultIncludes()
  });
  
  if (!matchResult) {
    return res.status(404).json({ success: false, message: 'Match result not found' });
  }
  
  res.json({ success: true, data: matchResult });
});

const createMatchResult = asyncHandler(async (req, res) => {
  try {
    const bookingId = Number(req.body.bookingId);
    const homeScore = Number(req.body.homeScore);
    const awayScore = Number(req.body.awayScore);
    const mvpPlayerId = req.body.mvpPlayerId === undefined || req.body.mvpPlayerId === null || req.body.mvpPlayerId === ''
      ? null
      : Number(req.body.mvpPlayerId);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ success: false, message: 'bookingId must be a positive integer' });
    }
    if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
      return res.status(400).json({ success: false, message: 'homeScore and awayScore must be non-negative integers' });
    }

    const booking = await Booking.findByPk(bookingId, {
      include: [
        { model: Team, as: 'team', attributes: ['id', 'captainId', 'name'] },
        { model: Team, as: 'opponentTeam', attributes: ['id', 'captainId', 'name'], required: false },
        { model: Field, as: 'field', attributes: ['id', 'ownerId', 'name'], required: false },
        { model: MatchResult, as: 'matchResult', attributes: ['id'], required: false }
      ]
    });
    booking.matchResult = undefined;
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (!canManageResultForBooking(booking, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to record result for this booking' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Match result can only be recorded for completed bookings' });
    }
    if (!booking.teamId || !booking.opponentTeamId) {
      return res.status(400).json({ success: false, message: 'This booking does not have two matched teams' });
    }

    if (Number.isInteger(mvpPlayerId) && mvpPlayerId > 0) {
      const eligibleMvpPlayerIds = await getEligibleMvpPlayerIds({
        homeTeamId: booking.teamId,
        awayTeamId: booking.opponentTeamId,
        homeCaptainId: booking.team?.captainId,
        awayCaptainId: booking.opponentTeam?.captainId
      });
      if (!eligibleMvpPlayerIds.has(mvpPlayerId)) {
        return res.status(400).json({
          success: false,
          message: 'Selected MVP is not eligible for this match'
        });
      }
    }

    const matchResult = await MatchResult.create({
      bookingId,
      homeTeamId: booking.teamId,
      awayTeamId: booking.opponentTeamId,
      homeScore,
      awayScore,
      matchStatus: 'completed',
      mvpPlayerId: Number.isInteger(mvpPlayerId) && mvpPlayerId > 0 ? mvpPlayerId : null,
      matchNotes: req.body.matchNotes || null,
      matchEvents: Array.isArray(req.body.matchEvents) ? req.body.matchEvents : [],
      recordedBy: req.user.id
    });
    const created = await MatchResult.findByPk(matchResult.id, { include: getResultIncludes() });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const updateMatchResult = asyncHandler(async (req, res) => {
  try {
    const matchResult = await MatchResult.findByPk(req.params.id, {
      include: [
        {
          model: Booking,
          as: 'booking',
          include: [
            { model: Team, as: 'team', attributes: ['id', 'captainId', 'name'] },
            { model: Team, as: 'opponentTeam', attributes: ['id', 'captainId', 'name'], required: false },
            { model: Field, as: 'field', attributes: ['id', 'ownerId', 'name'], required: false }
          ]
        }
      ]
    });
    if (!matchResult) {
      return res.status(404).json({ success: false, message: 'Match result not found' });
    }
    const canManage =
      req.user.role === 'admin' ||
      matchResult.recordedBy === req.user.id ||
      canManageResultForBooking(matchResult.booking, req.user);
    if (!canManage) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this match result' });
    }
    const allowedFields = ['homeScore', 'awayScore', 'matchNotes', 'mvpPlayerId', 'matchEvents'];
    const updatePayload = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updatePayload[key] = req.body[key];
    }
    if (updatePayload.homeScore !== undefined) {
      const score = Number(updatePayload.homeScore);
      if (!Number.isInteger(score) || score < 0) {
        return res.status(400).json({ success: false, message: 'homeScore must be a non-negative integer' });
      }
      updatePayload.homeScore = score;
    }
    if (updatePayload.awayScore !== undefined) {
      const score = Number(updatePayload.awayScore);
      if (!Number.isInteger(score) || score < 0) {
        return res.status(400).json({ success: false, message: 'awayScore must be a non-negative integer' });
      }
      updatePayload.awayScore = score;
    }
    if (updatePayload.mvpPlayerId !== undefined) {
      if (updatePayload.mvpPlayerId === null || updatePayload.mvpPlayerId === '') {
        updatePayload.mvpPlayerId = null;
      } else {
        const mvpId = Number(updatePayload.mvpPlayerId);
        if (!Number.isInteger(mvpId) || mvpId <= 0) {
          return res.status(400).json({ success: false, message: 'mvpPlayerId must be a positive integer or null' });
        }
        const eligibleMvpPlayerIds = await getEligibleMvpPlayerIds({
          homeTeamId: matchResult.homeTeamId,
          awayTeamId: matchResult.awayTeamId,
          homeCaptainId: matchResult.booking?.team?.captainId,
          awayCaptainId: matchResult.booking?.opponentTeam?.captainId
        });
        if (!eligibleMvpPlayerIds.has(mvpId)) {
          return res.status(400).json({
            success: false,
            message: 'Selected MVP is not eligible for this match'
          });
        }
        updatePayload.mvpPlayerId = mvpId;
      }
    }
    if (updatePayload.matchEvents !== undefined && !Array.isArray(updatePayload.matchEvents)) {
      return res.status(400).json({ success: false, message: 'matchEvents must be an array' });
    }
    
    const updatedMatchResult = await matchResult.update(updatePayload);
    const updated = await MatchResult.findByPk(updatedMatchResult.id, { include: getResultIncludes() });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const deleteMatchResult = asyncHandler(async (req, res) => {
  try {
    const matchResult = await MatchResult.findByPk(req.params.id,  {
      include: [
        {
          model: Booking,
          as: 'booking',
          include: [
            { model: Team, as: 'team', attributes: ['id', 'captainId', 'name'] },
            { model: Team, as: 'opponentTeam', attributes: ['id', 'captainId', 'name'], required: false },
            { model: Field, as: 'field', attributes: ['id', 'ownerId', 'name'], required: false }
          ]
        }
      ]
    });
    
    if (!matchResult) {
      return res.status(404).json({ success: false, message: 'Match result not found' });
    }
    const canDelete =
      req.user.role === 'admin' ||
      matchResult.recordedBy === req.user.id ||
      canManageResultForBooking(matchResult.booking, req.user);
    if (!canDelete) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this match result' });
    }
    await matchResult.destroy();
    res.json({ success: true, message: 'Match result deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
module.exports = {
  getAllMatchResults,
  getMatchResultById,
  createMatchResult,
  updateMatchResult,
  deleteMatchResult
};
