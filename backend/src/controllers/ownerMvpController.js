const { Booking, Field, Team, TeamMember, User, MatchResult } = require('../models');
const { Op } = require('sequelize');

const buildDisplayName = (user) =>
  `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || `Player #${user?.id || ''}`.trim();

const getEligiblePlayersByTeamId = async (teamIds = [], teamMap = new Map()) => {
  const normalizedIds = Array.from(new Set(teamIds.map((id) => Number(id)).filter(Boolean)));
  if (normalizedIds.length === 0) return new Map();

  const memberships = await TeamMember.findAll({
    where: {
      teamId: { [Op.in]: normalizedIds },
      status: 'active',
      isActive: true
    },
    attributes: ['teamId', 'userId'],
    include: [{ model: User, as: 'user', attributes: ['id', 'username', 'firstName', 'lastName'] }]
  });

  const byTeamId = new Map();
  normalizedIds.forEach((teamId) => byTeamId.set(teamId, new Map()));

  memberships.forEach((membership) => {
    const teamId = Number(membership.teamId);
    const user = membership.user;
    if (!teamId || !user?.id) return;
    byTeamId.get(teamId)?.set(Number(user.id), {
      id: Number(user.id),
      username: user.username || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      name: buildDisplayName(user),
      teamId,
      teamName: teamMap.get(teamId)?.name || 'Team'
    });
  });

  for (const teamId of normalizedIds) {
    const team = teamMap.get(teamId);
    const captainId = Number(team?.captainId);
    if (!captainId) continue;

    const existingCaptain = memberships.find(
      (membership) => Number(membership.teamId) === teamId && Number(membership.userId) === captainId && membership.user?.id
    );

    if (existingCaptain?.user?.id) {
      byTeamId.get(teamId)?.set(captainId, {
        id: captainId,
        username: existingCaptain.user.username || '',
        firstName: existingCaptain.user.firstName || '',
        lastName: existingCaptain.user.lastName || '',
        name: buildDisplayName(existingCaptain.user),
        teamId,
        teamName: team?.name || 'Team'
      });
      continue;
    }

    const captain = await User.findByPk(captainId, {
      attributes: ['id', 'username', 'firstName', 'lastName']
    });
    if (!captain?.id) continue;

    byTeamId.get(teamId)?.set(captainId, {
      id: captainId,
      username: captain.username || '',
      firstName: captain.firstName || '',
      lastName: captain.lastName || '',
      name: buildDisplayName(captain),
      teamId,
      teamName: team?.name || 'Team'
    });
  }

  return byTeamId;
};

const serializeMatch = (booking, eligiblePlayers = []) => ({
  id: booking.id,
  status: booking.status,
  startTime: booking.startTime,
  endTime: booking.endTime,
  field: booking.field,
  team: booking.team,
  opponentTeam: booking.opponentTeam,
  matchResult: booking.matchResult,
  eligiblePlayers
});

const getOwnerMvpMatches = async (req, res) => {
  try {
    const matches = await Booking.findAll({
      where: {
        status: 'completed',
        opponentTeamId: { [Op.ne]: null }
      },
      include: [
        { model: Field, as: 'field', attributes: ['id', 'ownerId', 'name'], where: { ownerId: req.user.id }, required: true },
        { model: Team, as: 'team', attributes: ['id', 'name', 'captainId'] },
        { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'captainId'], required: false },
        {
          model: MatchResult,
          as: 'matchResult',
          attributes: ['id', 'homeScore', 'awayScore', 'matchStatus', 'mvpPlayerId', 'recordedAt'],
          include: [{ model: User, as: 'mvpPlayer', attributes: ['id', 'username', 'firstName', 'lastName'], required: false }],
          required: false
        }
      ],
      order: [['startTime', 'DESC']]
    });

    const teamMap = new Map();
    matches.forEach((booking) => {
      if (booking.team?.id) teamMap.set(Number(booking.team.id), booking.team);
      if (booking.opponentTeam?.id) teamMap.set(Number(booking.opponentTeam.id), booking.opponentTeam);
    });

    const eligiblePlayersByTeamId = await getEligiblePlayersByTeamId(Array.from(teamMap.keys()), teamMap);
    const payload = matches.map((booking) => {
      const homePlayers = eligiblePlayersByTeamId.get(Number(booking.team?.id)) || new Map();
      const awayPlayers = eligiblePlayersByTeamId.get(Number(booking.opponentTeam?.id)) || new Map();
      const eligiblePlayers = Array.from(new Map([...homePlayers, ...awayPlayers]).values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      return serializeMatch(booking, eligiblePlayers);
    });

    return res.json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load owner MVP matches',
      error: error.message
    });
  }
};

const setOwnerMatchMvp = async (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const mvpPlayerId = Number(req.body.mvpPlayerId);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking id' });
    }
    if (!Number.isInteger(mvpPlayerId) || mvpPlayerId <= 0) {
      return res.status(400).json({ success: false, message: 'mvpPlayerId must be a positive integer' });
    }

    const booking = await Booking.findByPk(bookingId, {
      include: [
        { model: Field, as: 'field', attributes: ['id', 'ownerId', 'name'], where: { ownerId: req.user.id }, required: true },
        { model: Team, as: 'team', attributes: ['id', 'name', 'captainId'] },
        { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'captainId'], required: false },
        {
          model: MatchResult,
          as: 'matchResult',
          attributes: ['id', 'homeScore', 'awayScore', 'matchStatus', 'mvpPlayerId', 'recordedAt'],
          include: [{ model: User, as: 'mvpPlayer', attributes: ['id', 'username', 'firstName', 'lastName'], required: false }],
          required: false
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Completed match not found' });
    }
    if (Number(booking.field?.ownerId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Only the field owner can set MVP' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Only completed matches can have MVP' });
    }
    if (!booking.team?.id || !booking.opponentTeam?.id) {
      return res.status(400).json({ success: false, message: 'This match must have two teams before MVP can be selected' });
    }
    if (!booking.matchResult?.id || booking.matchResult.matchStatus !== 'completed') {
      return res.status(400).json({ success: false, message: 'Save the completed match result before selecting MVP' });
    }

    const teamMap = new Map([
      [Number(booking.team.id), booking.team],
      [Number(booking.opponentTeam.id), booking.opponentTeam]
    ]);
    const eligiblePlayersByTeamId = await getEligiblePlayersByTeamId(
      [Number(booking.team.id), Number(booking.opponentTeam.id)],
      teamMap
    );
    const eligiblePlayerIds = new Set([
      ...Array.from(eligiblePlayersByTeamId.get(Number(booking.team.id))?.keys() || []),
      ...Array.from(eligiblePlayersByTeamId.get(Number(booking.opponentTeam.id))?.keys() || [])
    ]);

    if (!eligiblePlayerIds.has(mvpPlayerId)) {
      return res.status(400).json({ success: false, message: 'Selected MVP must belong to one of the match teams' });
    }

    await booking.matchResult.update({ mvpPlayerId });

    const updatedBooking = await Booking.findByPk(bookingId, {
      include: [
        { model: Field, as: 'field', attributes: ['id', 'ownerId', 'name'], where: { ownerId: req.user.id }, required: true },
        { model: Team, as: 'team', attributes: ['id', 'name', 'captainId'] },
        { model: Team, as: 'opponentTeam', attributes: ['id', 'name', 'captainId'], required: false },
        {
          model: MatchResult,
          as: 'matchResult',
          attributes: ['id', 'homeScore', 'awayScore', 'matchStatus', 'mvpPlayerId', 'recordedAt'],
          include: [{ model: User, as: 'mvpPlayer', attributes: ['id', 'username', 'firstName', 'lastName'], required: false }],
          required: false
        }
      ]
    });
    const eligiblePlayers = Array.from(
      new Map([
        ...(eligiblePlayersByTeamId.get(Number(updatedBooking.team?.id)) || new Map()),
        ...(eligiblePlayersByTeamId.get(Number(updatedBooking.opponentTeam?.id)) || new Map())
      ]).values()
    ).sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      success: true,
      data: serializeMatch(updatedBooking, eligiblePlayers),
      message: 'MVP saved successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to save MVP',
      error: error.message
    });
  }
};

module.exports = {
  getOwnerMvpMatches,
  setOwnerMatchMvp
};
