const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Field, Booking, FieldReview, User } = require('../models');
const { Op, fn, col } = require('sequelize');
const serverConfig = require('../config/serverConfig');
const { getUploadDir, resolveManagedUploadPath } = require('../utils/storagePaths');

// A field is considered "booked" for UI availability only during an active confirmed slot.
const ACTIVE_BOOKING_STATUSES = ['confirmed'];

// Get booked field ids for the current flow.
const getBookedFieldIds = async (fieldIds = []) => {
  if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
    return new Set();
  }

  const activeBookings = await Booking.findAll({
    attributes: ['fieldId'],
    where: {
      fieldId: { [Op.in]: fieldIds },
      status: { [Op.in]: ACTIVE_BOOKING_STATUSES },
      startTime: { [Op.lte]: new Date() },
      endTime: { [Op.gt]: new Date() }
    },
    group: ['fieldId'],
    raw: true
  });

  return new Set(activeBookings.map((booking) => Number(booking.fieldId)));
};

// Support attach effective field status for this module.
const attachEffectiveFieldStatus = (field, bookedFieldIds) => {
  const payload = field && typeof field.toJSON === 'function' ? field.toJSON() : field;
  if (!payload) return payload;

  const baseStatus = String(payload.status || 'available').toLowerCase();
  let effectiveBaseStatus = baseStatus;

  // Respect closure window timing: if status is unavailable/maintenance but the
  // current time is outside the configured window, treat as available.
  if (baseStatus !== 'available') {
    const nowMs = Date.now();
    const closureStart = payload.closureStartAt ? new Date(payload.closureStartAt) : null;
    const closureEnd = payload.closureEndAt ? new Date(payload.closureEndAt) : null;
    const closureStartMs = closureStart && !Number.isNaN(closureStart.getTime()) ? closureStart.getTime() : null;
    const closureEndMs = closureEnd && !Number.isNaN(closureEnd.getTime()) ? closureEnd.getTime() : null;
    const hasWindow = closureStartMs !== null || closureEndMs !== null;

    if (hasWindow) {
      const inWindow =
        (closureStartMs === null || nowMs >= closureStartMs) &&
        (closureEndMs === null || nowMs < closureEndMs);
      if (!inWindow) {
        effectiveBaseStatus = 'available';
      }
    }
  }

  const effectiveStatus =
    effectiveBaseStatus === 'available' && bookedFieldIds.has(Number(payload.id))
      ? 'booked'
      : effectiveBaseStatus;

  return {
    ...payload,
    status: effectiveStatus
  };
};

// Check whether managed field image path is true.
const isManagedFieldImagePath = (imagePath) =>
  typeof imagePath === 'string' &&
  (imagePath.startsWith('/uploads/field/') || imagePath.startsWith('/uploads/fields/'));

// Get candidate image paths for the current flow.
const getCandidateImagePaths = (imagePath) => {
  if (!isManagedFieldImagePath(imagePath)) return [];
  const fileName = path.basename(String(imagePath || ''));
  return [
    resolveManagedUploadPath(imagePath),
    getUploadDir('field', fileName),
    getUploadDir('fields', fileName)
  ].filter(Boolean);
};

// Support remove field image file for this module.
const removeFieldImageFile = (imagePath) => {
  const candidates = getCandidateImagePaths(imagePath);
  candidates.forEach((absolute) => {
    try {
      if (fs.existsSync(absolute)) {
        fs.unlinkSync(absolute);
      }
    } catch (error) {
      console.warn(`Failed to remove field image file at ${absolute}:`, error.message);
    }
  });
};

const removeTemporaryUploadFiles = (files = []) => {
  files.forEach((file) => {
    const absolutePath = file?.path;
    if (!absolutePath) return;

    try {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (error) {
      console.warn(`Failed to remove temporary upload file at ${absolutePath}:`, error.message);
    }
  });
};

const normalizeUploadedFieldFiles = (filesPayload) => {
  if (Array.isArray(filesPayload)) {
    return filesPayload;
  }

  if (!filesPayload || typeof filesPayload !== 'object') {
    return [];
  }

  return ['images', 'image'].flatMap((key) => (Array.isArray(filesPayload[key]) ? filesPayload[key] : []));
};

const normalizeClosureMessage = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, 500) : null;
};

const normalizeOptionalDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getFieldReviewSummary = async (fieldId) => {
  const aggregates = await FieldReview.findOne({
    where: { fieldId },
    attributes: [
      [fn('AVG', col('rating')), 'averageRating'],
      [fn('COUNT', col('id')), 'totalReviews']
    ],
    raw: true
  });

  const averageRating = Number(aggregates?.averageRating || 0);
  const totalReviews = Number(aggregates?.totalReviews || 0);

  return {
    averageRating: totalReviews > 0 ? Number(averageRating.toFixed(1)) : 0,
    totalReviews
  };
};

const syncFieldReviewSummary = async (fieldId) => {
  const summary = await getFieldReviewSummary(fieldId);
  await Field.update(
    {
      rating: summary.totalReviews > 0 ? summary.averageRating : 0,
      totalRatings: summary.totalReviews
    },
    { where: { id: fieldId } }
  );
  return summary;
};

// Get fields for the current flow.
const getFields = async (req, res) => {
  try {
    const where = { isArchived: false };
    if (req.query.city) {
      where.city = req.query.city;
    }

    const fields = await Field.findAll({
      where,
      include: [
        {
          association: 'owner',
          attributes: ['id', 'username', 'firstName', 'lastName'],
          required: false
        }
      ]
    });
    const bookedFieldIds = await getBookedFieldIds(fields.map((field) => field.id));
    const effectiveFields = fields.map((field) => attachEffectiveFieldStatus(field, bookedFieldIds));
    const requestedStatus = String(req.query.status || '').toLowerCase();
    const filteredFields =
      requestedStatus
        ? effectiveFields.filter((field) => String(field?.status || '').toLowerCase() === requestedStatus)
        : effectiveFields;

    res.json({ success: true, data: filteredFields });
  } catch (error) {
    console.error('Get fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fields',
      error: error.message
    });
  }
};

// Get field for the current flow.
const getField = async (req, res) => {
  try {
    const field = await Field.findOne({
      where: {
        id: req.params.id,
        isArchived: false
      }
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found'
      });
    }

    const bookedFieldIds = await getBookedFieldIds([field.id]);
    res.json({ success: true, data: attachEffectiveFieldStatus(field, bookedFieldIds) });
  } catch (error) {
    console.error('Get field error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch field',
      error: error.message
    });
  }
};

// Get my fields for the current flow.
const getMyFields = async (req, res) => {
  try {
    const where = {};

    if (req.user.role !== 'admin') {
      where.ownerId = req.user.id;
    } else if (req.query.ownerId) {
      where.ownerId = req.query.ownerId;
    }
    where.isArchived = false;

    const fields = await Field.findAll({ where });
    const bookedFieldIds = await getBookedFieldIds(fields.map((field) => field.id));
    res.json({ success: true, data: fields.map((field) => attachEffectiveFieldStatus(field, bookedFieldIds)) });
  } catch (error) {
    console.error('Get my fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fields',
      error: error.message
    });
  }
};

const getFieldRatings = async (req, res) => {
  try {
    const field = await Field.findOne({
      where: {
        id: req.params.id,
        isArchived: false
      },
      attributes: ['id', 'name', 'rating', 'totalRatings']
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found'
      });
    }

    const reviews = await FieldReview.findAll({
      where: { fieldId: field.id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatarUrl']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const summary = await getFieldReviewSummary(field.id);
    const payload = reviews.map((review) => {
      const raw = review.toJSON();
      return {
        id: raw.id,
        fieldId: raw.fieldId,
        userId: raw.userId,
        rating: raw.rating,
        comment: raw.comment || '',
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        user: raw.user
          ? {
              id: raw.user.id,
              username: raw.user.username,
              firstName: raw.user.firstName,
              lastName: raw.user.lastName,
              avatarUrl: raw.user.avatarUrl || null
            }
          : null
      };
    });

    res.json({
      success: true,
      data: {
        field: {
          id: field.id,
          name: field.name,
          rating: summary.averageRating,
          totalRatings: summary.totalReviews
        },
        summary,
        reviews: payload
      }
    });
  } catch (error) {
    console.error('Get field ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch field ratings',
      error: error.message
    });
  }
};

const rateField = async (req, res) => {
  try {
    const field = await Field.findOne({
      where: {
        id: req.params.id,
        isArchived: false
      }
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found'
      });
    }

    const parsedRating = Number(req.body?.rating);
    const trimmedComment = String(req.body?.comment || '').trim();

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    if (!trimmedComment) {
      return res.status(400).json({
        success: false,
        message: 'Comment is required'
      });
    }

    if (trimmedComment.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Comment must be 1000 characters or fewer'
      });
    }

    const [review, created] = await FieldReview.findOrCreate({
      where: {
        fieldId: field.id,
        userId: req.user.id
      },
      defaults: {
        fieldId: field.id,
        userId: req.user.id,
        rating: parsedRating,
        comment: trimmedComment || null
      }
    });

    if (!created) {
      await review.update({
        rating: parsedRating,
        comment: trimmedComment || null
      });
    }

    const summary = await syncFieldReviewSummary(field.id);
    const hydratedReview = await FieldReview.findByPk(review.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatarUrl']
        }
      ]
    });

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Field review submitted successfully' : 'Field review updated successfully',
      data: {
        review: hydratedReview,
        summary,
        field: {
          id: field.id,
          rating: summary.averageRating,
          totalRatings: summary.totalReviews
        }
      }
    });
  } catch (error) {
    console.error('Rate field error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit field review',
      error: error.message
    });
  }
};
const createField = async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      city,
      province,
      latitude,
      longitude,
      pricePerHour,
      discountPercent,
      operatingHours,
      fieldType,
      surfaceType,
      capacity,
      status,
      closureMessage,
      closureStartAt,
      closureEndAt,
      amenities,
      images
    } = req.body;

    const normalizedStatus = status || 'available';
    const normalizedClosureMessage =
      normalizedStatus === 'available' ? null : normalizeClosureMessage(closureMessage);
    const normalizedClosureStartAt = normalizedStatus === 'available' ? null : normalizeOptionalDate(closureStartAt);
    const normalizedClosureEndAt = normalizedStatus === 'available' ? null : normalizeOptionalDate(closureEndAt);
    if (normalizedClosureStartAt && normalizedClosureEndAt && normalizedClosureEndAt <= normalizedClosureStartAt) {
      return res.status(400).json({
        success: false,
        message: 'Open-back date must be after close date.'
      });
    }

    const field = await Field.create({
      name,
      description,
      address,
      city,
      province,
      latitude,
      longitude,
      ownerId: req.user.id,
      pricePerHour,
      discountPercent,
      operatingHours,
      fieldType,
      surfaceType,
      capacity,
      status: normalizedStatus,
      closureMessage: normalizedClosureMessage,
      closureStartAt: normalizedClosureStartAt,
      closureEndAt: normalizedClosureEndAt,
      amenities,
      images
    });

    res.status(201).json({ success: true, data: field });
  } catch (error) {
    console.error('Create field error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create field',
      error: error.message
    });
  }
};

// Update field in local state.
const updateField = async (req, res) => {
  try {
    const field = await Field.findByPk(req.params.id);

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found'
      });
    }

    if (field.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this field'
      });
    }

    const updatableFields = [
      'name',
      'description',
      'address',
      'city',
      'province',
      'latitude',
      'longitude',
      'pricePerHour',
      'discountPercent',
      'operatingHours',
      'fieldType',
      'surfaceType',
      'capacity',
      'status',
      'closureMessage',
      'closureStartAt',
      'closureEndAt',
      'amenities',
      'images'
    ];

    const updateData = {};
    for (const key of updatableFields) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    if (updateData.closureMessage !== undefined) {
      updateData.closureMessage = normalizeClosureMessage(updateData.closureMessage);
    }
    if (updateData.closureStartAt !== undefined) {
      updateData.closureStartAt = normalizeOptionalDate(updateData.closureStartAt);
    }
    if (updateData.closureEndAt !== undefined) {
      updateData.closureEndAt = normalizeOptionalDate(updateData.closureEndAt);
    }

    if (updateData.status === 'available') {
      updateData.closureMessage = null;
      updateData.closureStartAt = null;
      updateData.closureEndAt = null;
    } else if (updateData.status && updateData.closureMessage === undefined) {
      updateData.closureMessage = normalizeClosureMessage(field.closureMessage);
      if (updateData.closureStartAt === undefined) {
        updateData.closureStartAt = normalizeOptionalDate(field.closureStartAt);
      }
      if (updateData.closureEndAt === undefined) {
        updateData.closureEndAt = normalizeOptionalDate(field.closureEndAt);
      }
    }
    if (updateData.closureStartAt && updateData.closureEndAt && updateData.closureEndAt <= updateData.closureStartAt) {
      return res.status(400).json({
        success: false,
        message: 'Open-back date must be after close date.'
      });
    }

    const currentImages = Array.isArray(field.images) ? field.images : [];
    const nextImages =
      updateData.images !== undefined && Array.isArray(updateData.images) ? updateData.images : currentImages;

    const removedImages = currentImages.filter(
      (imgPath) => isManagedFieldImagePath(imgPath) && !nextImages.includes(imgPath)
    );

    const updatedField = await field.update(updateData);
    removedImages.forEach((imgPath) => removeFieldImageFile(imgPath));
    res.json({ success: true, data: updatedField });
  } catch (error) {
    console.error('Update field error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update field',
      error: error.message
    });
  }
};

// Support delete field for this module.
const deleteField = async (req, res) => {
  try {
    const field = await Field.findByPk(req.params.id);

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found'
      });
    }

    if (field.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this field'
      });
    }

    const bookingCount = await Booking.count({ where: { fieldId: field.id } });
    const deletedId = field.id;

    if (bookingCount > 0) {
      await field.update({
        isArchived: true,
        status: 'unavailable'
      });

      return res.json({
        success: true,
        message: 'Field archived successfully',
        data: { id: deletedId, archived: true }
      });
    }

    const existingImages = Array.isArray(field.images) ? field.images : [];
    await field.destroy();

    // Clean up image files after successful DB delete.
    existingImages.forEach((imgPath) => removeFieldImageFile(imgPath));

    res.json({
      success: true,
      message: 'Field deleted successfully',
      data: { id: deletedId, archived: false }
    });
  } catch (error) {
    console.error('Delete field error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete field',
      error: error.message
    });
  }
};

// Support upload field images for this module.
const uploadFieldImages = async (req, res) => {
  try {
    const field = await Field.findByPk(req.params.id);
    if (!field) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }

    if (field.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this field' });
    }

    const maxImageSize = serverConfig.upload.maxSize;
    const uploadDir = getUploadDir('field');
    fs.mkdirSync(uploadDir, { recursive: true });

    const storage = multer.diskStorage({
      destination: (innerReq, file, cb) => cb(null, uploadDir),
      filename: (innerReq, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
        cb(null, `field-${field.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
      }
    });

    const upload = multer({
      storage,
      limits: { fileSize: maxImageSize, files: 5 },
      fileFilter: (innerReq, file, cb) => {
        if (!serverConfig.isAllowedImageUpload(file)) {
          return cb(new Error('Invalid file type'));
        }
        cb(null, true);
      }
    }).fields([
      { name: 'images', maxCount: 5 },
      { name: 'image', maxCount: 5 }
    ]);

    upload(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, message: `Image too large. Max size is ${Math.floor(maxImageSize / (1024 * 1024))}MB` });
        }
        return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
      }

      const uploadedFiles = normalizeUploadedFieldFiles(req.files);

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ success: false, message: 'No files uploaded' });
      }

      if (uploadedFiles.length > 5) {
        removeTemporaryUploadFiles(uploadedFiles);
        return res.status(400).json({ success: false, message: 'You can upload up to 5 images at a time' });
      }

      const currentImages = Array.isArray(field.images) ? field.images : [];
      const replaceExisting = String(req.body?.replaceExisting || '').toLowerCase() === 'true';
      let mergedImages;

        if (replaceExisting) {
          // Remove currently referenced managed images first.
          currentImages
            .filter((imgPath) => isManagedFieldImagePath(imgPath))
            .forEach((imgPath) => removeFieldImageFile(imgPath));

          // Also clean stale files for this field id to prevent duplicates from piling up.
          try {
            const stalePattern = new RegExp(`^field-${field.id}-`, 'i');
            const activeUploadFileNames = new Set(
              uploadedFiles
                .map((file) => String(file?.filename || '').trim())
                .filter(Boolean)
            );
            const allFiles = fs.readdirSync(uploadDir);
            allFiles
              .filter((name) => stalePattern.test(name) && !activeUploadFileNames.has(name))
              .forEach((name) => {
                const abs = path.resolve(uploadDir, name);
                if (fs.existsSync(abs)) fs.unlinkSync(abs);
              });
          } catch {
            // Ignore cleanup errors and continue with uploaded files.
          }

          mergedImages = uploadedFiles.map((file, index) => {
            const ext = path.extname(file.originalname || file.filename || '').toLowerCase() || '.jpg';
            const stableName = `field-${field.id}-${index + 1}${ext}`;
            const stableAbs = path.resolve(uploadDir, stableName);
            const sourceAbs = file.path;
            try {
              if (fs.existsSync(stableAbs)) {
                fs.unlinkSync(stableAbs);
              }
              if (sourceAbs !== stableAbs) {
                fs.renameSync(sourceAbs, stableAbs);
              }
              return `/uploads/field/${stableName}`;
            } catch {
              return `/uploads/field/${file.filename}`;
            }
          });
        } else {
        const newImages = uploadedFiles.map((file) => `/uploads/field/${file.filename}`);
        mergedImages = [...currentImages, ...newImages];
      }

      await field.update({ images: mergedImages });
      return res.json({
        success: true,
        data: { images: mergedImages, replaced: replaceExisting },
        message: replaceExisting ? 'Images replaced successfully' : 'Images uploaded successfully'
      });
    });
  } catch (error) {
    console.error('Upload field images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload field images',
      error: error.message
    });
  }
};

// Support delete field image for this module.
const deleteFieldImage = async (req, res) => {
  try {
    const field = await Field.findByPk(req.params.id);
    if (!field) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }

    if (field.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this field' });
    }

    const imageIndex = Number(req.params.imageId);
    const currentImages = Array.isArray(field.images) ? field.images : [];

    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= currentImages.length) {
      return res.status(400).json({ success: false, message: 'Invalid image index' });
    }

    const targetPath = currentImages[imageIndex];
    const nextImages = currentImages.filter((_, idx) => idx !== imageIndex);
    await field.update({ images: nextImages });

    removeFieldImageFile(targetPath);

    res.json({ success: true, data: { images: nextImages }, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete field image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete field image',
      error: error.message
    });
  }
};

// Set field cover image for the current flow.
const setFieldCoverImage = async (req, res) => {
  try {
    const field = await Field.findByPk(req.params.id);
    if (!field) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }

    if (field.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this field' });
    }

    const imageIndex = Number(req.params.imageId);
    const currentImages = Array.isArray(field.images) ? field.images : [];

    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= currentImages.length) {
      return res.status(400).json({ success: false, message: 'Invalid image index' });
    }

    if (imageIndex === 0) {
      return res.json({ success: true, data: { images: currentImages }, message: 'Cover image already set' });
    }

    const selected = currentImages[imageIndex];
    const nextImages = [selected, ...currentImages.filter((_, idx) => idx !== imageIndex)];
    await field.update({ images: nextImages });

    res.json({ success: true, data: { images: nextImages }, message: 'Cover image updated successfully' });
  } catch (error) {
    console.error('Set field cover image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set cover image',
      error: error.message
    });
  }
};

module.exports = {
  getFields,
  getField,
  getMyFields,
  createField,
  updateField,
  deleteField,
  uploadFieldImages,
  deleteFieldImage,
  setFieldCoverImage,
  getFieldRatings,
  rateField
};

