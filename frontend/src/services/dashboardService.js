import apiService from './api';

const dashboardService = {
  // Get all dashboard data in a single optimized call
  getAllDashboardData: async () => {
    try {
      // Make all necessary API calls in parallel but with fewer requests
      const [statsResponse, bookingsResponse, teamsResponse, fieldsResponse] = await Promise.all([
        apiService.get('/dashboard/stats'),
        apiService.get('/bookings?limit=5'),
        apiService.get('/teams?limit=5'),
        apiService.get('/fields?limit=5')
      ]);

      // Transform the data into activity feed
      const activities = [
        ...(Array.isArray(bookingsResponse.data) ? bookingsResponse.data : []).map(booking => ({
          id: booking.id,
          action: 'New booking created',
          field: booking.field?.name || 'Unknown Field',
          time: new Date(booking.createdAt).toLocaleString(),
          type: 'booking'
        })),
        ...(Array.isArray(teamsResponse.data) ? teamsResponse.data : []).map(team => ({
          id: team.id,
          action: 'Team created',
          team: team.name,
          time: new Date(team.createdAt).toLocaleString(),
          type: 'team'
        })),
        ...(Array.isArray(fieldsResponse.data) ? fieldsResponse.data : []).map(field => ({
          id: field.id,
          action: 'Field added',
          field: field.name,
          time: new Date(field.createdAt).toLocaleString(),
          type: 'field'
        }))
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

      // Filter upcoming matches from bookings
      const upcomingMatches = Array.isArray(bookingsResponse.data) 
        ? bookingsResponse.data.filter(booking => booking.status === 'pending')
        : [];

      return {
        success: true,
        data: {
          stats: statsResponse.data && typeof statsResponse.data === 'object' ? statsResponse.data : {},
          recentActivity: activities,
          upcomingMatches: upcomingMatches
        }
      };
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch dashboard data'
      };
    }
  },

  // Get dashboard statistics (kept for individual use)
  getStats: async () => {
    const response = await apiService.get('/dashboard/stats');
    return response;
  },

  // Get recent activity (standalone version)
  getRecentActivity: async () => {
    try {
      const [bookings, teams, fields] = await Promise.all([
        apiService.get('/bookings?limit=5'),
        apiService.get('/teams?limit=5'),
        apiService.get('/fields?limit=5')
      ]);

      // Transform the data into activity feed
      const activities = [
        ...(Array.isArray(bookings.data) ? bookings.data : []).map(booking => ({
          id: booking.id,
          action: 'New booking created',
          field: booking.field?.name || 'Unknown Field',
          time: new Date(booking.createdAt).toLocaleString(),
          type: 'booking'
        })),
        ...(Array.isArray(teams.data) ? teams.data : []).map(team => ({
          id: team.id,
          action: 'Team created',
          team: team.name,
          time: new Date(team.createdAt).toLocaleString(),
          type: 'team'
        })),
        ...(Array.isArray(fields.data) ? fields.data : []).map(field => ({
          id: field.id,
          action: 'Field added',
          field: field.name,
          time: new Date(field.createdAt).toLocaleString(),
          type: 'field'
        }))
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

      return { success: true, data: activities };
    } catch (error) {
      console.error('Recent activity fetch error:', error);
      return { success: false, error: error.message || 'Failed to fetch recent activity' };
    }
  },

  // Get upcoming matches (standalone version)
  getUpcomingMatches: async () => {
    try {
      const response = await apiService.get('/bookings?status=pending&limit=5');
      return {
        success: true,
        data: Array.isArray(response.data) ? response.data : []
      };
    } catch (error) {
      console.error('Upcoming matches fetch error:', error);
      return { success: false, error: error.message || 'Failed to fetch upcoming matches' };
    }
  }
};

export default dashboardService;
