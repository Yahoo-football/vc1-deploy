import apiService from './api';

const ownerMvpService = {
  getCompletedMatches: async () => {
    const response = await apiService.get('/owner-mvp/matches');
    return response;
  },

  setMvp: async (bookingId, mvpPlayerId) => {
    const response = await apiService.patch(`/owner-mvp/matches/${bookingId}/mvp`, { mvpPlayerId });
    return response;
  }
};

export default ownerMvpService;
