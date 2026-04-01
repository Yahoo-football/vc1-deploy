const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const serverConfig = require('../config/serverConfig');
const { ValidationError } = require('./errorHandler');

// Support ensure dir for this module.
const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

// Support safe ext for this module.
const safeExt = (originalName) => {
  const ext = path.extname(originalName || '').toLowerCase();
  return ext && ext.length <= 10 ? ext : '';
};

// Support make storage for this module.
const makeStorage = (subdirFromReq) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const subdir = subdirFromReq(req);
      const dest = path.join(process.cwd(), serverConfig.upload.destination, subdir);
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const ext = safeExt(file.originalname);
      const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      cb(null, `${Date.now()}-${id}${ext}`);
    }
  });

// Magic number signatures for common image formats
const FILE_SIGNATURES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]]
};

// Validate file signature before continuing.
const validateFileSignature = (buffer, mimetype) => {
  if (mimetype === 'image/svg+xml') {
    const content = buffer.toString('utf8').trim().toLowerCase();
    return content.includes('<svg') && !content.includes('<script');
  }

  const signatures = FILE_SIGNATURES[mimetype];
  if (!signatures) return false;

  return signatures.some(signature => {
    return signature.every((byte, index) => buffer[index] === byte);
  });
};

// Support file filter for this module.
const fileFilter = (req, file, cb) => {
  const allowed = serverConfig.upload.allowedTypes || [];
  if (!allowed.includes(file.mimetype)) {
    return cb(new ValidationError(`Invalid file type: ${file.mimetype}`));
  }

  // For additional security, we'll validate the actual file content in a separate middleware
  // since multer's fileFilter doesn't have access to the file buffer yet
  cb(null, true);
};

// Middleware to validate file signature after upload
const validateUploadedFile = (req, res, next) => {
  if (!req.file) return next();

  const filePath = req.file.path;
  const mimetype = req.file.mimetype;

  // Only validate image files
  if (!mimetype.startsWith('image/')) return next();

  try {
    const buffer = fs.readFileSync(filePath);
    const isValid = mimetype === 'image/svg+xml'
      ? validateFileSignature(buffer, mimetype)
      : validateFileSignature(buffer.slice(0, 10), mimetype);

    if (!isValid) {
      // Delete the invalid file
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        error: 'File content does not match the declared MIME type. Possible malicious file.'
      });
    }

    next();
  } catch (error) {
    console.error('File validation error:', error);
    // Clean up file if validation fails
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.error('Failed to cleanup invalid file:', cleanupError);
    }
    return res.status(500).json({
      success: false,
      error: 'File validation failed'
    });
  }
};

const limits = { fileSize: serverConfig.upload.maxSize || 5 * 1024 * 1024 };

const fieldImagesUpload = multer({
  storage: makeStorage((req) => path.join('fields', String(req.params.id))),
  fileFilter,
  limits
});

const teamLogoUpload = multer({
  storage: makeStorage((req) => path.join('teams', String(req.params.id))),
  fileFilter,
  limits
});

const avatarUpload = multer({
  storage: makeStorage((req) => path.join('avatars', String(req.user?.id || 'unknown'))),
  fileFilter,
  limits
});

const roleRequestPaymentUpload = multer({
  storage: makeStorage((req) => path.join('role-requests', String(req.user?.id || 'unknown'))),
  fileFilter,
  limits
});

module.exports = {
  fieldImagesUpload,
  teamLogoUpload,
  avatarUpload,
  roleRequestPaymentUpload,
  validateUploadedFile
};
