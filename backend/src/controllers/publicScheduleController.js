const { Op } = require('sequelize');
const { Field, Booking, Team } = require('../models');

// Support to date range for this module.
const toDateRange = (dateInput) => {
  const base = dateInput ? new Date(`${dateInput}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return null;

  const start = new Date(base);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

// Get public schedule for the current flow.
const getPublicSchedule = async (req, res) => {
  try {
    const range = toDateRange(req.query.date);
    if (!range) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD.'
      });
    }

    const requestedLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.max(1, Math.min(requestedLimit, 50))
        : null;

    const fields = await Field.findAll({
      attributes: ['id', 'name', 'fieldType', 'city', 'capacity', 'status'],
      order: [['id', 'ASC']],
      ...(limit ? { limit } : {})
    });

    const fieldIds = fields.map((f) => f.id);
    if (fieldIds.length === 0) {
      return res.json({
        success: true,
        data: {
          date: range.start.toISOString().slice(0, 10),
          fields: [],
          bookings: []
        }
      });
    }

    const bookings = await Booking.findAll({
      where: {
        fieldId: { [Op.in]: fieldIds },
        status: { [Op.in]: ['pending', 'confirmed', 'completed'] },
        startTime: { [Op.lt]: range.end },
        endTime: { [Op.gt]: range.start }
      },
      include: [
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'maxPlayers'],
          required: false
        }
      ],
      order: [['startTime', 'ASC']]
    });

    const bookingData = bookings.map((booking) => ({
      id: booking.id,
      fieldId: booking.fieldId,
      status: booking.status,
      startTime: booking.startTime,
      endTime: booking.endTime,
      teamId: booking.team?.id || null,
      teamName: booking.team?.name || 'Booked Slot',
      players: booking.team?.maxPlayers || null
    }));

    res.json({
      success: true,
      data: {
        date: range.start.toISOString().slice(0, 10),
        fields,
        bookings: bookingData
      }
    });
  } catch (error) {
    console.error('Get public schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schedule',
      error: error.message
    });
  }
};

module.exports = {
  getPublicSchedule
};
