const { Booking, Field, User, Team } = require('../models');
const { createInAppNotification } = require('../utils/notify');
const { Op } = require('sequelize');

/**
 * Booking Service
 * Handles all booking business logic
 */
class BookingService {
  getEffectiveHourlyRate(field) {
    const basePrice = Number(field?.pricePerHour || 0);
    const discountPercent = Math.min(100, Math.max(0, Number(field?.discountPercent || 0)));
    return Number((basePrice * (1 - discountPercent / 100)).toFixed(2));
  }

  /**
   * Create a new booking
   */
  async createBooking(bookingData, userId) {
    const { fieldId, startTime, endTime, teamId, notes } = bookingData;
    
    // Check if field exists and is active
    const field = await Field.findByPk(fieldId);
    if (!field || !field.isActive) {
      throw new Error('Field not found or inactive');
    }
    
    // Check if time slot is available
    const existingBooking = await Booking.findOne({
      where: {
        fieldId,
        status: { [Op.notIn]: ['cancelled'] },
        [Op.or]: [
          {
            startTime: { [Op.lt]: endTime },
            endTime: { [Op.gt]: startTime }
          }
        ]
      }
    });
    
    if (existingBooking) {
      throw new Error('Time slot not available');
    }
    
    // Calculate total price
    const duration = (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60); // hours
    const totalPrice = duration * this.getEffectiveHourlyRate(field);
    
    // Create booking
    const booking = await Booking.create({
      fieldId,
      startTime,
      endTime,
      teamId,
      notes,
      totalPrice,
      createdBy: userId,
      status: 'pending'
    });
    
    // Get booking with associations
    const bookingWithDetails = await Booking.findByPk(booking.id, {
      include: [
        {
          model: Field,
          as: 'field',
          attributes: ['id', 'name', 'location', 'pricePerHour']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'firstName', 'lastName', 'email']
        },
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'skillLevel']
        }
      ]
    });
    
    // Send notification to field owner
    try {
      await createInAppNotification({
        userId: field.ownerId,
        type: 'booking',
        title: 'New Booking Request',
        message: `New booking request for ${field.name} from ${startTime} to ${endTime}`,
        metadata: {
          bookingId: booking.id,
          fieldId: field.id,
          teamId: team.id,
          requesterId: userId,
          type: 'new_booking'
        }
      });
    } catch (error) {
      console.warn('Failed to send notification to field owner:', error.message);
    }
    
    return bookingWithDetails;
  }
  
  /**
   * Get bookings with filters
   */
  async getBookings(filters, user) {
    const { fieldId, status, dateFrom, dateTo, page = 1, limit = 10 } = filters;
    
    const whereClause = {};
    
    // Apply filters based on user role
    if (user.role === 'field_owner') {
      // Field owners can see bookings for their fields
      const ownedFields = await Field.findAll({
        where: { ownerId: user.id },
        attributes: ['id']
      });
      const fieldIds = ownedFields.map(f => f.id);
      
      if (fieldId) {
        if (!fieldIds.includes(fieldId)) {
          throw new Error('Access denied');
        }
        whereClause.fieldId = fieldId;
      } else {
        whereClause.fieldId = { [Op.in]: fieldIds };
      }
    } else if (user.role !== 'admin') {
      // Regular users can only see their own bookings
      whereClause.createdBy = user.id;
      if (fieldId) {
        whereClause.fieldId = fieldId;
      }
    }
    
    // Apply status filter
    if (status) {
      whereClause.status = status;
    }
    
    // Apply date filters
    if (dateFrom || dateTo) {
      whereClause.startTime = {};
      if (dateFrom) {
        whereClause.startTime[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.startTime[Op.lte] = new Date(dateTo);
      }
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows } = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Field,
          as: 'field',
          attributes: ['id', 'name', 'location', 'pricePerHour']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'firstName', 'lastName', 'email']
        },
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'skillLevel']
        }
      ],
      order: [['startTime', 'ASC']],
      limit: parseInt(limit),
      offset
    });
    
    return {
      bookings: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  }
  
  /**
   * Get booking by ID
   */
  async getBookingById(bookingId, user) {
    const booking = await Booking.findByPk(bookingId, {
      include: [
        {
          model: Field,
          as: 'field',
          attributes: ['id', 'name', 'location', 'pricePerHour', 'ownerId']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'firstName', 'lastName', 'email']
        },
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'skillLevel']
        }
      ]
    });
    
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    // Check access permissions
    if (user.role !== 'admin') {
      if (user.role === 'field_owner') {
        if (booking.field.ownerId !== user.id) {
          throw new Error('Access denied');
        }
      } else {
        if (booking.createdBy !== user.id) {
          throw new Error('Access denied');
        }
      }
    }
    
    return booking;
  }
  
  /**
   * Update booking status
   */
  async updateBookingStatus(bookingId, status, user) {
    const booking = await Booking.findByPk(bookingId, {
      include: [
        {
          model: Field,
          as: 'field',
          attributes: ['id', 'name', 'ownerId']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'firstName', 'lastName', 'email']
        }
      ]
    });
    
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    // Check permissions
    if (user.role === 'field_owner') {
      if (booking.field.ownerId !== user.id) {
        throw new Error('Access denied');
      }
    } else if (user.role !== 'admin') {
      throw new Error('Access denied');
    }
    
    // Validate status transition
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['completed', 'cancelled'],
      'cancelled': [],
      'completed': []
    };
    
    if (!validTransitions[booking.status].includes(status)) {
      throw new Error(`Cannot change status from ${booking.status} to ${status}`);
    }
    
    await booking.update({ status });
    
    // Send notification to booking creator
    try {
      await createInAppNotification({
        userId: booking.createdBy,
        type: 'booking',
        title: `Booking ${status}`,
        message: `Your booking for ${booking.field.name} has been ${status}`,
        metadata: {
          bookingId: booking.id,
          fieldId: booking.field.id,
          type: 'status_update'
        }
      });
    } catch (error) {
      console.warn('Failed to send notification to booking creator:', error.message);
    }
    
    return booking;
  }
}

module.exports = new BookingService();
