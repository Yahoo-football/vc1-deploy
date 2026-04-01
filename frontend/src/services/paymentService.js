import apiService from './api';

const paymentService = {
  createCheckout: async (bookingId) => {
    const response = await apiService.post('/payments/checkout', { bookingId });
    return response;
  }
};

export default paymentService;

