import apiService from './api';

const userService = {
  // search users by partial username or email
  searchUsers: async (query, options = {}) => {
    const response = await apiService.get('/users/search', { q: query, ...options });
    return response;
  },

  getAllUsers: async () => {
    return apiService.get('/users');
  },

  getUserById: async (userId) => {
    return apiService.get(`/users/${userId}`);
  },

  updateUser: async (userId, payload) => {
    return apiService.put(`/users/${userId}`, payload);
  },

  deleteUser: async (userId) => {
    return apiService.delete(`/users/${userId}`);
  }
};

export default userService;
