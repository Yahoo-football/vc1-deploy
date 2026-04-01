import apiService from './api';

const ratingService = {
  getMatchHistoryForRating: async () => {
    const response = await apiService.get('/ratings/match-history');
    return response;
  },

  createOpponentRating: async (payload) => {
    const response = await apiService.post('/ratings/opponent', payload);
    return response;
  }
};

export default ratingService;
