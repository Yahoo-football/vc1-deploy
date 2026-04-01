import apiService from './api';

const authService = {
  // Register new user
  register: async (userData) => {
    const response = await apiService.post('/auth/register', userData);
    
    // Store token and user data
    if (response.success && response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response;
  },

  // Login user
  login: async (credentials) => {
    const response = await apiService.post('/auth/login', credentials);
    
    // Store token and user data
    if (response.success && response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response;
  },

  getGoogleAuthConfig: async () => {
    return apiService.get('/auth/google/config');
  },

  googleAuth: async (credential) => {
    const response = await apiService.post('/auth/google', { credential });

    if (response.success && response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response;
  },

  // Forgot password: request OTP
  requestPasswordOtp: async (identifier) => {
    return apiService.post('/auth/forgot-password', { identifier });
  },

  // Forgot password: verify OTP
  verifyPasswordOtp: async (identifier, otp) => {
    return apiService.post('/auth/forgot-password/verify', { identifier, otp });
  },

  // Forgot password: reset password
  resetPasswordWithOtp: async (identifier, otp, newPassword) => {
    return apiService.post('/auth/forgot-password/reset', { identifier, otp, newPassword });
  },

  // Email reset: request reset link
  requestPasswordResetLink: async (identifier) => {
    return apiService.post('/auth/forgot-password-link', { identifier });
  },

  // Email reset: reset with token
  resetPasswordWithToken: async (token, newPassword) => {
    return apiService.post('/auth/reset-password', { token, newPassword });
  },

  // Get user profile
  getProfile: async () => {
    const response = await apiService.get('/auth/profile');
    
    // Update stored user data
    if (response.success) {
      const resolvedUser = response.data?.user || response.data;
      localStorage.setItem('user', JSON.stringify(resolvedUser));
    }
    
    return response;
  },

  // Get profile statistics
  getProfileStats: async () => {
    const response = await apiService.get('/auth/profile/stats');
    return response;
  },

  // Update user profile
  updateProfile: async (userData) => {
    const response = await apiService.put('/auth/profile', userData);
    
    // Update stored user data
    if (response.success) {
      const resolvedUser = response.data?.user || response.data;
      localStorage.setItem('user', JSON.stringify(resolvedUser));
    }

    return response;
  },

  // Get current user's role request history and available upgrades
  getRoleRequests: async () => {
    return apiService.get('/auth/role-requests');
  },

  // Submit a role upgrade request
  requestRoleUpgrade: async ({
    requestedRole,
    note = '',
    paymentReference = '',
    paymentAccountName = '',
    paymentPhone = '',
    paymentProof = null
  }) => {
    const formData = new FormData();
    formData.append('requestedRole', requestedRole);
    formData.append('note', note);
    formData.append('paymentAcknowledged', 'true');
    formData.append('paymentReference', paymentReference);
    formData.append('paymentAccountName', paymentAccountName);
    formData.append('paymentPhone', paymentPhone);

    if (paymentProof) {
      formData.append('paymentProof', paymentProof);
    }

    return apiService.upload('/auth/role-requests', formData, {
      timeout: 30000
    });
  },

  cancelRoleRequest: async (requestId) => {
    return apiService.delete(`/auth/role-requests/${requestId}`);
  },

  // Admin: list all role requests
  getAdminRoleRequests: async (status = '') => {
    return apiService.get('/auth/admin/role-requests', status ? { status } : {});
  },

  // Admin: approve/reject role request
  reviewRoleRequest: async (requestId, action, note = '') => {
    return apiService.patch(`/auth/admin/role-requests/${requestId}/review`, {
      action,
      note
    });
  },

  // Upload profile avatar
  uploadAvatar: async (formData) => {
    const response = await apiService.upload('/auth/profile/avatar', formData, {
      timeout: 30000
    });

    if (response.success) {
      const resolvedUser = response.data?.user || response.data;
      if (resolvedUser) {
        localStorage.setItem('user', JSON.stringify(resolvedUser));
      }
    }

    return response;
  },

  // Change password
  changePassword: async (payload) => {
    const response = await apiService.post('/auth/change-password', payload);
    return response;
  },
  // Delete profile avatar
  deleteAvatar: async () => {
    const response = await apiService.delete('/auth/profile/avatar');

    if (response.success) {
      const resolvedUser = response.data?.user || response.data;
      if (resolvedUser) {
        localStorage.setItem('user', JSON.stringify(resolvedUser));
      }
    }

    return response;
  },

  // Logout user
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    return !!(token && user);
  },

  // Get current user
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Get auth token
  getToken: () => {
    return localStorage.getItem('token');
  },

  // Check if user has specific role
  hasRole: (role) => {
    const user = authService.getCurrentUser();
    return user && user.role === role;
  },

  // Check if user has any of the specified roles
  hasAnyRole: (roles) => {
    const user = authService.getCurrentUser();
    return user && roles.includes(user.role);
  },

  // Check if user is admin
  isAdmin: () => {
    return authService.hasRole('admin');
  },

  // Check if user is field owner
  isFieldOwner: () => {
    return authService.hasRole('field_owner');
  },

  // Check if user is captain
  isCaptain: () => {
    return authService.hasRole('captain');
  },

  // Check if user is player
  isPlayer: () => {
    return authService.hasRole('player');
  },

  // Submit a request to upgrade to field owner
  requestFieldOwnerRole: async (requestData) => {
    const response = await apiService.post('/auth/request-field-owner', requestData);
    return response;
  },

  // Get user permissions based on role
  getPermissions: () => {
    const user = authService.getCurrentUser();
    if (!user) return [];

    const rolePermissions = {
      admin: [
        'create_field', 'edit_field', 'delete_field',
        'create_booking', 'edit_booking', 'delete_booking',
        'create_team', 'edit_team', 'delete_team',
        'manage_users', 'view_analytics'
      ],
      field_owner: [
        'create_field', 'edit_field', 'delete_field',
        'view_own_bookings', 'manage_own_fields'
      ],
      captain: [
        'create_team', 'edit_own_team', 'manage_team_members',
        'create_booking', 'edit_own_booking'
      ],
      player: [
        'view_fields', 'create_booking', 'edit_own_booking',
        'join_team', 'view_own_bookings'
      ],
      guest: [
        'view_fields', 'view_public_teams'
      ]
    };

    return rolePermissions[user.role] || rolePermissions.guest;
  },

  // Check if user has specific permission
  hasPermission: (permission) => {
    const permissions = authService.getPermissions();
    return permissions.includes(permission);
  }
};

export default authService;
