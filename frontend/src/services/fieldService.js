import apiService from './api';
import { compressImagesForUpload } from '../utils/imageCompression';

const fieldService = {
  // Get all fields
  getAllFields: async (filters = {}) => {
    const params = {
      page: filters.page || 1,
      limit: filters.limit || 10,
      fieldType: filters.fieldType,
      surfaceType: filters.surfaceType,
      city: filters.city,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      status: filters.status
    };

    const response = await apiService.get('/fields', params);
    return response;
  },

  // Get field by ID
  getFieldById: async (fieldId) => {
    const response = await apiService.get(`/fields/${fieldId}`);
    return response;
  },

  // Create new field (field owner or admin only)
  createField: async (fieldData) => {
    const response = await apiService.post('/fields', fieldData);
    return response;
  },

  // Update field (owner or admin only)
  updateField: async (fieldId, fieldData) => {
    const response = await apiService.put(`/fields/${fieldId}`, fieldData);
    return response;
  },

  // Delete field (owner or admin only)
  deleteField: async (fieldId) => {
    const response = await apiService.delete(`/fields/${fieldId}`);
    return response;
  },

  // Get fields owned by current user
  getMyFields: async () => {
    const response = await apiService.get('/fields/my-fields');
    return response;
  },

  // Search fields
  searchFields: async (searchTerm, filters = {}) => {
    const params = {
      q: searchTerm,
      ...filters
    };

    const response = await apiService.get('/fields/search', params);
    return response;
  },

  // Get field availability
  getFieldAvailability: async (fieldId, date) => {
    const response = await apiService.get(`/fields/${fieldId}/availability`, { date });
    return response;
  },

  // Upload field images
  uploadFieldImages: async (fieldId, imageFiles, options = {}) => {
    const compressedFiles = await compressImagesForUpload(imageFiles, {
      maxWidth: 1920,
      maxHeight: 1080,
      targetMaxBytes: 900 * 1024,
      minCompressBytes: 250 * 1024,
      maxCount: 5
    });

    const formData = new FormData();

    compressedFiles.forEach((file) => {
      formData.append('images', file);
    });
    if (options.replaceExisting) {
      formData.append('replaceExisting', 'true');
    }

    const response = await apiService.upload(`/fields/${fieldId}/images`, formData);
    return response;
  },

  // Delete field image
  deleteFieldImage: async (fieldId, imageId) => {
    const response = await apiService.delete(`/fields/${fieldId}/images/${imageId}`);
    return response;
  },

  // Set a field image as main cover (moves it to index 0)
  setFieldCoverImage: async (fieldId, imageId) => {
    const response = await apiService.patch(`/fields/${fieldId}/images/${imageId}/cover`);
    return response;
  },

  // Get field ratings
  getFieldRatings: async (fieldId) => {
    const response = await apiService.get(`/fields/${fieldId}/ratings`);
    return response;
  },

  // Rate a field
  rateField: async (fieldId, ratingData) => {
    const response = await apiService.post(`/fields/${fieldId}/rate`, ratingData);
    return response;
  },

  // Get field statistics (for owners)
  getFieldStats: async (fieldId) => {
    const response = await apiService.get(`/fields/${fieldId}/stats`);
    return response;
  },

  // Helper method to format field data for API
  formatFieldData: (rawData) => {
    return {
      name: rawData.name,
      description: rawData.description,
      address: rawData.address,
      city: rawData.city,
      province: rawData.province,
      latitude: parseFloat(rawData.latitude) || null,
      longitude: parseFloat(rawData.longitude) || null,
      pricePerHour: parseFloat(rawData.pricePerHour),
      discountPercent: parseFloat(rawData.discountPercent) || 0,
      operatingHours: rawData.operatingHours,
      fieldType: rawData.fieldType,
      surfaceType: rawData.surfaceType,
      capacity: parseInt(rawData.capacity),
      status: rawData.status || 'available',
      amenities: rawData.amenities,
      images: rawData.images || []
    };
  },

  // Helper method to validate field data
  validateFieldData: (fieldData) => {
    const errors = [];

    if (!fieldData.name || fieldData.name.trim().length < 3) {
      errors.push('Field name must be at least 3 characters long');
    }

    if (!fieldData.address || fieldData.address.trim().length < 5) {
      errors.push('Address must be at least 5 characters long');
    }

    if (!fieldData.city || fieldData.city.trim().length < 2) {
      errors.push('City must be at least 2 characters long');
    }

    if (!fieldData.pricePerHour || fieldData.pricePerHour <= 0) {
      errors.push('Price per hour must be greater than 0');
    }

    if (fieldData.discountPercent < 0 || fieldData.discountPercent > 100) {
      errors.push('Discount percent must be between 0 and 100');
    }

    if (fieldData.status && !['available', 'unavailable', 'maintenance', 'booked'].includes(fieldData.status)) {
      errors.push('Status must be available, booked, unavailable, or maintenance');
    }

    if (!fieldData.fieldType) {
      errors.push('Field type is required');
    }

    if (!fieldData.surfaceType) {
      errors.push('Surface type is required');
    }

    if (!fieldData.capacity || fieldData.capacity < 1) {
      errors.push('Capacity must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

export default fieldService;
