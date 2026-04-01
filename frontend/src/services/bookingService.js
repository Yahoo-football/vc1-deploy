import apiService from './api';

const bookingService = {
  // Get all bookings (with filters)
  getAllBookings: async (filters = {}) => {
    const params = {
      page: filters.page || 1,
      limit: filters.limit || 10,
      status: filters.status,
      fieldId: filters.fieldId,
      teamId: filters.teamId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      userId: filters.userId
    };

    const response = await apiService.get('/bookings', params);
    return response;
  },

  // Get day schedule for slot-grid booking
  getSchedule: async (date) => {
    const response = await apiService.get('/bookings/schedule', { date });
    return response;
  },

  // Get booking by ID
  getBookingById: async (bookingId) => {
    const response = await apiService.get(`/bookings/${bookingId}`);
    return response;
  },

  // Create new booking
  createBooking: async (bookingData) => {
    const response = await apiService.post('/bookings', bookingData);
    return response;
  },

  // Update booking
  updateBooking: async (bookingId, bookingData) => {
    const response = await apiService.put(`/bookings/${bookingId}`, bookingData);
    return response;
  },

  // Cancel booking
  cancelBooking: async (bookingId) => {
    const response = await apiService.put(`/bookings/${bookingId}`, { status: 'cancelled' });
    return response;
  },

  // Captain: request booking cancellation
  requestCancellation: async (bookingId, reason = '') => {
    try {
      const response = await apiService.post(`/bookings/${bookingId}/cancellation-requests`, { reason });
      return response;
    } catch (error) {
      if (error?.status === 404) {
        const fallbackResponse = await apiService.put(`/bookings/${bookingId}`, {
          status: 'cancelled',
          cancellationReason: reason
        });
        return fallbackResponse;
      }
      throw error;
    }
  },

  // Field owner/admin: approve or reject cancellation
  decideCancellation: async (bookingId, action, decisionNote = '') => {
    const response = await apiService.patch(`/bookings/${bookingId}/cancellation-requests/decision`, {
      action,
      decisionNote
    });
    return response;
  },

  // Delete booking
  deleteBooking: async (bookingId) => {
    const response = await apiService.delete(`/bookings/${bookingId}`);
    return response;
  },

  // Get current user's bookings
  getMyBookings: async (filters = {}) => {
    const response = await apiService.get('/bookings/my-bookings', filters);
    return response;
  },

  // Get bookings for a specific field
  getFieldBookings: async (fieldId, filters = {}) => {
    const params = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      status: filters.status
    };

    const response = await apiService.get(`/fields/${fieldId}/bookings`, params);
    return response;
  },

  // Get bookings for a specific team
  getTeamBookings: async (teamId, filters = {}) => {
    const params = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      status: filters.status
    };

    const response = await apiService.get(`/teams/${teamId}/bookings`, params);
    return response;
  },

  // Check booking availability
  checkAvailability: async (fieldId, startTime, endTime) => {
    const response = await apiService.get('/bookings/check-availability', {
      fieldId,
      startTime,
      endTime
    });
    return response;
  },

  // Get booking conflicts
  getBookingConflicts: async (fieldId, startTime, endTime, excludeBookingId = null) => {
    const params = {
      fieldId,
      startTime,
      endTime,
      excludeBookingId
    };

    const response = await apiService.get('/bookings/conflicts', params);
    return response;
  },

  // Confirm booking (optionally update start/end time while confirming)
  confirmBooking: async (bookingId, options = {}) => {
    const payload = { status: 'confirmed' };
    if (options.startTime) payload.startTime = options.startTime;
    if (options.endTime) payload.endTime = options.endTime;
    const response = await apiService.put(`/bookings/${bookingId}`, payload);
    return response;
  },

  // Field owner/admin: confirm a match only when both teams exist
  confirmMatchTeams: async (bookingId) => {
    const response = await apiService.patch(`/bookings/${bookingId}/confirm-match`);
    return response;
  },

  // Complete booking
  completeBooking: async (bookingId) => {
    const response = await apiService.put(`/bookings/${bookingId}`, { status: 'completed' });
    return response;
  },

  // Field owner/captain/admin: create a match result for a completed booking
  createMatchResult: async (resultData) => {
    const response = await apiService.post('/match-results', resultData);
    return response;
  },

  // Field owner/captain/admin: update an existing match result
  updateMatchResult: async (resultId, resultData) => {
    const response = await apiService.put(`/match-results/${resultId}`, resultData);
    return response;
  },

  // Captain: toggle open for opponents on own booking
  setOpenForOpponents: async (bookingId, openForOpponents) => {
    const response = await apiService.patch(`/bookings/${bookingId}/open-for-opponents`, { openForOpponents });
    return response;
  },

  // Captain: list open matches from other teams
  getOpenMatches: async () => {
    const response = await apiService.get('/bookings/open-matches');
    return response;
  },

  // Captain: request to join an open match with one of captained teams
  requestJoinMatch: async (bookingId, teamId, message = '') => {
    const response = await apiService.post(`/bookings/${bookingId}/join-requests`, { teamId, message });
    return response;
  },

  // Captain: get join requests for a booking owned by their team
  getBookingJoinRequests: async (bookingId) => {
    const response = await apiService.get(`/bookings/${bookingId}/join-requests`);
    return response;
  },

  // Captain: accept or reject a join request
  respondToJoinRequest: async (bookingId, requestId, action) => {
    const response = await apiService.patch(`/bookings/${bookingId}/join-requests/${requestId}`, { action });
    return response;
  },

  // Captain (either matched team): cancel a matched pairing
  cancelMatchedOpponent: async (bookingId) => {
    const response = await apiService.patch(`/bookings/${bookingId}/cancel-matched-opponent`);
    return response;
  },

  // Get booking statistics
  getBookingStats: async (filters = {}) => {
    const params = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      fieldId: filters.fieldId,
      teamId: filters.teamId
    };

    const response = await apiService.get('/bookings/stats', params);
    return response;
  },

  // Public schedule for landing page (no auth required)
  getPublicSchedule: async (date, limit = null) => {
    const params = { date };
    if (Number.isFinite(limit) && limit > 0) {
      params.limit = limit;
    }
    const response = await apiService.get('/bookings/public/schedule', params);
    return response;
  },

  // Public booking stats for landing page (no auth required)
  getPublicBookingStats: async (filters = {}) => {
    const params = {
      lookbackDays: filters.lookbackDays,
      top: filters.top,
      statuses: filters.statuses,
      timezoneOffsetMinutes: filters.timezoneOffsetMinutes
    };
    const response = await apiService.get('/bookings/public/stats', params);
    return response;
  },

  // Helper method to format booking data for API
  formatBookingData: (rawData) => {
    return {
      fieldId: parseInt(rawData.fieldId),
      teamId: rawData.teamId ? parseInt(rawData.teamId) : null,
      opponentTeamId: rawData.opponentTeamId ? parseInt(rawData.opponentTeamId) : null,
      startTime: new Date(rawData.startTime).toISOString(),
      endTime: new Date(rawData.endTime).toISOString(),
      totalPrice: parseFloat(rawData.totalPrice),
      specialRequests: rawData.specialRequests || '',
      isMatchmaking: rawData.isMatchmaking || false,
      notes: rawData.notes || ''
    };
  },

  // Helper method to validate booking data
  validateBookingData: (bookingData) => {
    const errors = [];

    if (!bookingData.fieldId) {
      errors.push('Field is required');
    }

    if (!bookingData.startTime) {
      errors.push('Start time is required');
    }

    if (!bookingData.endTime) {
      errors.push('End time is required');
    }

    if (bookingData.startTime && bookingData.endTime) {
      const start = new Date(bookingData.startTime);
      const end = new Date(bookingData.endTime);
      const now = new Date();

      if (start <= now) {
        errors.push('Start time must be in the future');
      }

      if (end <= start) {
        errors.push('End time must be after start time');
      }

      // Check if booking duration is reasonable (e.g., between 30 minutes and 8 hours)
      const durationMs = end - start;
      const durationHours = durationMs / (1000 * 60 * 60);

      if (durationHours < 0.5) {
        errors.push('Booking must be at least 30 minutes');
      }

      if (durationHours > 8) {
        errors.push('Booking cannot exceed 8 hours');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Helper method to calculate booking price
  calculatePrice: (fieldPricePerHour, startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    const durationHours = durationMs / (1000 * 60 * 60);
    
    return parseFloat((fieldPricePerHour * durationHours).toFixed(2));
  },

  // Helper method to format booking time for display
  formatBookingTime: (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    const options = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };

    return {
      start: start.toLocaleDateString('en-US', options),
      end: end.toLocaleDateString('en-US', options),
      duration: end - start
    };
  }
};

export default bookingService;
