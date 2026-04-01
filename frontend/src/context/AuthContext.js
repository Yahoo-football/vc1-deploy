import React, { createContext, useContext, useReducer, useEffect } from 'react';
import authService from '../services/authService';
import Spinner from '../components/ui/Spinner';

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  isLoggingOut: false,
  error: null,
  permissions: []
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT_START: 'LOGOUT_START',
  LOGOUT: 'LOGOUT',
  REGISTER_START: 'REGISTER_START',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  REGISTER_FAILURE: 'REGISTER_FAILURE',
  LOAD_USER_START: 'LOAD_USER_START',
  LOAD_USER_SUCCESS: 'LOAD_USER_SUCCESS',
  LOAD_USER_FAILURE: 'LOAD_USER_FAILURE',
  UPDATE_PROFILE_START: 'UPDATE_PROFILE_START',
  UPDATE_PROFILE_SUCCESS: 'UPDATE_PROFILE_SUCCESS',
  UPDATE_PROFILE_FAILURE: 'UPDATE_PROFILE_FAILURE',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer function
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
    case AUTH_ACTIONS.REGISTER_START:
    case AUTH_ACTIONS.LOAD_USER_START:
    case AUTH_ACTIONS.UPDATE_PROFILE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
    case AUTH_ACTIONS.REGISTER_SUCCESS:
    case AUTH_ACTIONS.LOAD_USER_SUCCESS:
    case AUTH_ACTIONS.UPDATE_PROFILE_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        loading: false,
        error: null,
        permissions: action.payload.permissions || []
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
    case AUTH_ACTIONS.REGISTER_FAILURE:
    case AUTH_ACTIONS.LOAD_USER_FAILURE:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload,
        permissions: []
      };

    case AUTH_ACTIONS.LOGOUT_START:
      return {
        ...state,
        isLoggingOut: true,
        error: null
      };

    case AUTH_ACTIONS.UPDATE_PROFILE_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false,
        isLoggingOut: false,
        error: null,
        permissions: []
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load user on initial render
  useEffect(() => {
    // Load user for the current view.
    const loadUser = async () => {
      if (authService.isAuthenticated()) {
        dispatch({ type: AUTH_ACTIONS.LOAD_USER_START });
        
        try {
          const profileResponse = await authService.getProfile();
          const user =
            (profileResponse.success && (profileResponse.data?.user || profileResponse.data)) ||
            authService.getCurrentUser();
          const permissions = authService.getPermissions();
          
          dispatch({
            type: AUTH_ACTIONS.LOAD_USER_SUCCESS,
            payload: { user, permissions }
          });
        } catch (error) {
          dispatch({
            type: AUTH_ACTIONS.LOAD_USER_FAILURE,
            payload: error.message || 'Failed to load user'
          });
        }
      } else {
        dispatch({ type: AUTH_ACTIONS.LOAD_USER_SUCCESS, payload: { user: null, permissions: [] } });
      }
    };

    loadUser();
  }, []);

  // Login function
  const login = async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });
    
    try {
      const response = await authService.login(credentials);
      
      if (response.success) {
        const user = authService.getCurrentUser();
        const permissions = authService.getPermissions();
        
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, permissions }
        });
        
        return { success: true, data: response.data };
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      const errorMessage = error.error || error.message || 'Login failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Register function
  const register = async (userData) => {
    dispatch({ type: AUTH_ACTIONS.REGISTER_START });
    
    try {
      const response = await authService.register(userData);
      
      if (response.success) {
        const user = authService.getCurrentUser();
        const permissions = authService.getPermissions();
        
        dispatch({
          type: AUTH_ACTIONS.REGISTER_SUCCESS,
          payload: { user, permissions }
        });
        
        return { success: true, data: response.data };
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      const errorMessage = error.error || error.message || 'Registration failed';
      dispatch({
        type: AUTH_ACTIONS.REGISTER_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  const googleAuth = async (credential) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await authService.googleAuth(credential);

      if (response.success) {
        const user = authService.getCurrentUser();
        const permissions = authService.getPermissions();

        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, permissions }
        });

        return { success: true, data: response.data };
      }

      throw new Error(response.message || 'Google authentication failed');
    } catch (error) {
      const errorMessage = error.error || error.message || 'Google authentication failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    dispatch({ type: AUTH_ACTIONS.LOGOUT_START });
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    authService.logout();
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  };

  // Update profile function
  const updateProfile = async (userData) => {
    dispatch({ type: AUTH_ACTIONS.UPDATE_PROFILE_START });
    
    try {
      const response = await authService.updateProfile(userData);
      
      if (response.success) {
        const user = authService.getCurrentUser();
        const permissions = authService.getPermissions();
        
        dispatch({
          type: AUTH_ACTIONS.UPDATE_PROFILE_SUCCESS,
          payload: { user, permissions }
        });
        
        return { success: true, data: response.data };
      } else {
        throw new Error(response.message || 'Profile update failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Profile update failed';
      dispatch({
        type: AUTH_ACTIONS.UPDATE_PROFILE_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Upload avatar function
  const uploadAvatar = async (formData) => {
    dispatch({ type: AUTH_ACTIONS.UPDATE_PROFILE_START });

    try {
      const response = await authService.uploadAvatar(formData);

      if (response.success) {
        const user = authService.getCurrentUser();
        const permissions = authService.getPermissions();

        dispatch({
          type: AUTH_ACTIONS.UPDATE_PROFILE_SUCCESS,
          payload: { user, permissions }
        });

        return { success: true, data: response.data };
      }

      throw new Error(response.message || 'Avatar upload failed');
    } catch (error) {
      const errorMessage = error.error || error.message || 'Avatar upload failed';
      dispatch({
        type: AUTH_ACTIONS.UPDATE_PROFILE_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Delete avatar function
  const deleteAvatar = async () => {
    dispatch({ type: AUTH_ACTIONS.UPDATE_PROFILE_START });

    try {
      const response = await authService.deleteAvatar();

      if (response.success) {
        const user = authService.getCurrentUser();
        const permissions = authService.getPermissions();

        dispatch({
          type: AUTH_ACTIONS.UPDATE_PROFILE_SUCCESS,
          payload: { user, permissions }
        });

        return { success: true, data: response.data };
      }

      throw new Error(response.message || 'Avatar delete failed');
    } catch (error) {
      const errorMessage = error.error || error.message || 'Avatar delete failed';
      dispatch({
        type: AUTH_ACTIONS.UPDATE_PROFILE_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Change password function
  const changePassword = async (passwordData) => {
    dispatch({ type: AUTH_ACTIONS.UPDATE_PROFILE_START });

    try {
      const response = await authService.changePassword(passwordData);

      if (response.success) {
        const user = authService.getCurrentUser();
        const permissions = authService.getPermissions();

        dispatch({
          type: AUTH_ACTIONS.UPDATE_PROFILE_SUCCESS,
          payload: { user, permissions }
        });

        return { success: true, data: response.data };
      }

      throw new Error(response.message || 'Password change failed');
    } catch (error) {
      const errorMessage = error.error || error.message || 'Password change failed';
      dispatch({
        type: AUTH_ACTIONS.UPDATE_PROFILE_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  const refreshUser = async () => {
    if (!authService.isAuthenticated()) {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const profileResponse = await authService.getProfile();
      const user =
        (profileResponse.success && (profileResponse.data?.user || profileResponse.data)) ||
        authService.getCurrentUser();
      const permissions = authService.getPermissions();

      dispatch({
        type: AUTH_ACTIONS.LOAD_USER_SUCCESS,
        payload: { user, permissions }
      });

      return { success: true, data: user };
    } catch (error) {
      const errorMessage = error.error || error.message || 'Failed to refresh user';
      dispatch({
        type: AUTH_ACTIONS.LOAD_USER_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Check permissions
  const hasPermission = (permission) => {
    return state.permissions.includes(permission);
  };

  // Check role
  const hasRole = (role) => {
    return state.user && state.user.role === role;
  };

  // Check if user is admin
  const isAdmin = () => {
    return hasRole('admin');
  };

  // Check if user is field owner
  const isFieldOwner = () => {
    return hasRole('field_owner');
  };

  // Check if user is captain
  const isCaptain = () => {
    return hasRole('captain');
  };

  // Check if user is player
  const isPlayer = () => {
    return hasRole('player');
  };

  const value = {
    ...state,
    login,
      register,
      googleAuth,
      logout,
    updateProfile,
    uploadAvatar,
    deleteAvatar,
    changePassword,
    refreshUser,
    clearError,
    hasPermission,
    hasRole,
    isAdmin,
    isFieldOwner,
    isCaptain,
    isPlayer
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {state.isLoggingOut ? (
        <div className="fixed inset-0 z-[1700] flex items-center justify-center bg-slate-950/35 backdrop-blur-sm">
          <div className="rounded-[28px] border border-white/15 bg-white/95 px-8 py-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <Spinner className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-900">Logging out...</p>
            <p className="mt-1 text-sm text-slate-500">Please wait a moment.</p>
          </div>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
