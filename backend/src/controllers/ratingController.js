const { Rating, Team, Booking, User, MatchResult } = require('../models');
const { Op } = require('sequelize');

// Support async handler for this module.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const getAllRatings = asyncHandler(async (req, res) => {
  const { teamIdRated, teamIdRater, bookingId, ratingType } = req.query;
  const whereClause = {};
  
  if (teamIdRated) whereClause.teamIdRated = teamIdRated;
  if (teamIdRater) whereClause.teamIdRater = teamIdRater;
  if (bookingId) whereClause.bookingId = bookingId;
  if (ratingType) whereClause.ratingType = ratingType;
  
  const ratings = await Rating.findAll({
    where: whereClause,
    include: [
      { model: Team, as: 'raterTeam' },
      { model: Team, as: 'ratedTeam' },
      { model: Booking, as: 'booking' }
    ],
    order: [['createdAt', 'DESC']]
  });
  res.json({ success: true, data: ratings });
});

const getRatingById = asyncHandler(async (req, res) => {
  const rating = await Rating.findByPk(req.params.id, {
    include: [
      { model: Team, as: 'raterTeam' },
      { model: Team, as: 'ratedTeam' },
      { model: Booking, as: 'booking' }
    ]
  });
  
  if (!rating) {
    return res.status(404).json({ success: false, message: 'Rating not found' });
  }
  
  res.json({ success: true, data: rating });
});

const createRating = asyncHandler(async (req, res) => {
  try {
    const rating = await Rating.create(req.body);
    res.status(201).json({ success: true, data: rating });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const getMatchHistoryForRating = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const captainedTeams = isAdmin
    ? []
    : await Team.findAll({
        where: { captainId: req.user.id },
        attributes: ['id']
      });

  const teamIds = captainedTeams.map((t) => Number(t.id));
  if (!isAdmin && teamIds.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const where = {
    status: 'completed',
    opponentTeamId: { [Op.ne]: null }
  };

  if (!isAdmin) {
    where[Op.or] = [{ teamId: { [Op.in]: teamIds } }, { opponentTeamId: { [Op.in]: teamIds } }];
  }

  const bookings = await Booking.findAll({
    where,
    include: [
      { model: Team, as: 'team', attributes: ['id', 'name', 'captainId'], required: false },
      { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'captainId'], required: false },
      { model: MatchResult, as: 'matchResult', attributes: ['id', 'homeTeamId', 'awayTeamId', 'homeScore', 'awayScore', 'matchStatus'], required: false }
    ],
    order: [['startTime', 'DESC']]
  });

  const ratingRows = await Rating.findAll({
    where: { bookingId: { [Op.in]: bookings.map((b) => b.id) } },
    attributes: ['id', 'bookingId', 'teamIdRater', 'teamIdRated', 'rating', 'review', 'sportsmanshipScore', 'createdAt']
  });

  // Support rating key for this module.
  const ratingKey = (bookingId, teamIdRater) => `${bookingId}:${teamIdRater}`;
  const ratingMap = new Map();
  for (const row of ratingRows) {
    ratingMap.set(ratingKey(Number(row.bookingId), Number(row.teamIdRater)), row);
  }

  const data = bookings
    .map((booking) => {
      const teamA = booking.team;
      const teamB = booking.opponentTeam;
      if (!teamA || !teamB) return null;

      let myTeam = null;
      let opponentTeam = null;

      if (isAdmin) {
        myTeam = teamA;
        opponentTeam = teamB;
      } else if (teamIds.includes(Number(teamA.id))) {
        myTeam = teamA;
        opponentTeam = teamB;
      } else if (teamIds.includes(Number(teamB.id))) {
        myTeam = teamB;
        opponentTeam = teamA;
      } else {
        return null;
      }

      const existingRating = ratingMap.get(ratingKey(Number(booking.id), Number(myTeam.id)));
      const canRate = !existingRating && booking.status === 'completed' && Number(myTeam.captainId) === Number(req.user.id);

      return {
        id: booking.id,
        bookingId: booking.id,
        matchDate: booking.startTime,
        team: { id: myTeam.id, name: myTeam.name },
        opponentTeam: { id: opponentTeam.id, name: opponentTeam.name },
        result: booking.matchResult
          ? {
              homeTeamId: booking.matchResult.homeTeamId,
              awayTeamId: booking.matchResult.awayTeamId,
              homeScore: booking.matchResult.homeScore,
              awayScore: booking.matchResult.awayScore,
              matchStatus: booking.matchResult.matchStatus
            }
          : null,
        canRate,
        rating: existingRating
          ? {
              id: existingRating.id,
              value: existingRating.rating,
              review: existingRating.review,
              sportsmanshipScore: existingRating.sportsmanshipScore,
              createdAt: existingRating.createdAt
            }
          : null
      };
    })
    .filter(Boolean);

  res.json({ success: true, data });
});

const createOpponentRating = asyncHandler(async (req, res) => {
  const { bookingId, rating, review, sportsmanshipScore, skillLevelScore, punctualityScore, teamOrganizationScore } = req.body;
  const parsedBookingId = Number(bookingId);
  const parsedRating = Number(rating);
  const parsedSportsmanship = sportsmanshipScore === undefined || sportsmanshipScore === null ? null : Number(sportsmanshipScore);
  const parsedSkillLevel = skillLevelScore === undefined || skillLevelScore === null ? null : Number(skillLevelScore);
  const parsedPunctuality = punctualityScore === undefined || punctualityScore === null ? null : Number(punctualityScore);
  const parsedTeamOrganization =
    teamOrganizationScore === undefined || teamOrganizationScore === null ? null : Number(teamOrganizationScore);

  if (!Number.isInteger(parsedBookingId) || parsedBookingId <= 0) {
    return res.status(400).json({ success: false, message: 'bookingId must be a positive integer' });
  }
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({ success: false, message: 'rating must be between 1 and 5' });
  }
  if (parsedSportsmanship !== null && (!Number.isInteger(parsedSportsmanship) || parsedSportsmanship < 1 || parsedSportsmanship > 5)) {
    return res.status(400).json({ success: false, message: 'sportsmanshipScore must be between 1 and 5' });
  }
  if (parsedSkillLevel !== null && (!Number.isInteger(parsedSkillLevel) || parsedSkillLevel < 1 || parsedSkillLevel > 5)) {
    return res.status(400).json({ success: false, message: 'skillLevelScore must be between 1 and 5' });
  }
  if (parsedPunctuality !== null && (!Number.isInteger(parsedPunctuality) || parsedPunctuality < 1 || parsedPunctuality > 5)) {
    return res.status(400).json({ success: false, message: 'punctualityScore must be between 1 and 5' });
  }
  if (
    parsedTeamOrganization !== null &&
    (!Number.isInteger(parsedTeamOrganization) || parsedTeamOrganization < 1 || parsedTeamOrganization > 5)
  ) {
    return res.status(400).json({ success: false, message: 'teamOrganizationScore must be between 1 and 5' });
  }

  const booking = await Booking.findByPk(parsedBookingId, {
    include: [
      { model: Team, as: 'team', attributes: ['id', 'name', 'captainId'] },
      { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'captainId'] },
      { model: MatchResult, as: 'matchResult', attributes: ['id', 'matchStatus'], required: false }
    ]
  });

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  if (booking.status !== 'completed') {
    return res.status(400).json({ success: false, message: 'Only completed matches can be rated' });
  }
  if (booking.matchResult && booking.matchResult.matchStatus !== 'completed') {
    return res.status(400).json({ success: false, message: 'Match result must be completed before rating' });
  }

  if (!booking.team || !booking.opponentTeam) {
    return res.status(400).json({ success: false, message: 'Booking must have both teams before rating' });
  }

  let raterTeamId = null;
  let ratedTeamId = null;
  if (Number(booking.team.captainId) === Number(req.user.id)) {
    raterTeamId = Number(booking.team.id);
    ratedTeamId = Number(booking.opponentTeam.id);
  } else if (Number(booking.opponentTeam.captainId) === Number(req.user.id)) {
    raterTeamId = Number(booking.opponentTeam.id);
    ratedTeamId = Number(booking.team.id);
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Only participating team captains can rate opponents' });
  } else {
    raterTeamId = Number(booking.team.id);
    ratedTeamId = Number(booking.opponentTeam.id);
  }

  const existing = await Rating.findOne({
    where: {
      bookingId: parsedBookingId,
      teamIdRater: raterTeamId,
      teamIdRated: ratedTeamId
    }
  });
  if (existing) {
    return res.status(400).json({ success: false, message: 'You have already rated this opponent.' });
  }

  const created = await Rating.create({
    bookingId: parsedBookingId,
    teamIdRater: raterTeamId,
    teamIdRated: ratedTeamId,
    rating: parsedRating,
    review: review || null,
    sportsmanshipScore: parsedSportsmanship,
    skillLevelScore: parsedSkillLevel,
    punctualityScore: parsedPunctuality,
    teamOrganizationScore: parsedTeamOrganization,
    ratingType: 'overall',
    isRecommended: parsedRating >= 4
  });

  res.status(201).json({ success: true, data: created });
});

const updateRating = asyncHandler(async (req, res) => {
  try {
    const rating = await Rating.findByPk(req.params.id);
    
    if (!rating) {
      return res.status(404).json({ success: false, message: 'Rating not found' });
    }
    
    // Authorization check - only admin can update for now
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this rating' });
    }
    
    const updatedRating = await rating.update(req.body);
    res.json({ success: true, data: updatedRating });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const deleteRating = asyncHandler(async (req, res) => {
  try {
    const rating = await Rating.findByPk(req.params.id);
    
    if (!rating) {
      return res.status(404).json({ success: false, message: 'Rating not found' });
    }
    
    // Authorization check - only admin can delete for now
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this rating' });
    }
    
    await rating.destroy();
    res.json({ success: true, message: 'Rating deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = {
  getAllRatings,
  getRatingById,
  createRating,
  getMatchHistoryForRating,
  createOpponentRating,
  updateRating,
  deleteRating
};
