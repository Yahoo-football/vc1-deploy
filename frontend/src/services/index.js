// Export all services for easy importing
import apiService from './api';
import authService from './authService';
import fieldService from './fieldService';
import bookingService from './bookingService';
import teamService from './teamService';

const services = {
  api: apiService,
  auth: authService,
  field: fieldService,
  booking: bookingService,
  team: teamService
};

export default services;

// Named exports for individual services
export {
  apiService,
  authService,
  fieldService,
  bookingService,
  teamService
};
