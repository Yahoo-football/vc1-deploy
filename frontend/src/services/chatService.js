import apiService from './api';

const chatService = {
  getConversations: async () => {
    return apiService.get('/chats/conversations');
  },

  searchUsers: async (query = '', options = {}) => {
    return apiService.get('/chats/users', {
      q: query,
      ...options
    });
  },

  openConversation: async (userId) => {
    return apiService.post('/chats/conversations', { userId });
  },

  getMessages: async (conversationId, options = {}) => {
    return apiService.get(`/chats/conversations/${conversationId}/messages`, options);
  },

  markRead: async (conversationId) => {
    return apiService.post(`/chats/conversations/${conversationId}/read`);
  },

  sendMessage: async (conversationId, body) => {
    return apiService.post(`/chats/conversations/${conversationId}/messages`, { body });
  }
};

export default chatService;
