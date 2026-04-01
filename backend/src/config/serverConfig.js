require('dotenv').config();
const path = require('path');

// Validate environment before continuing.
const validateEnvironment = () => {
  const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'JWT_SECRET',
    'DB_HOST',
    'DB_NAME',
    'DB_USER'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate JWT secret strength
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }
};

const defaultAllowedTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml'
];

const defaultAllowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];

const configuredAllowedTypes = process.env.ALLOWED_FILE_TYPES
  ? process.env.ALLOWED_FILE_TYPES.split(',').map((item) => item.trim()).filter(Boolean)
  : defaultAllowedTypes;

const configuredAllowedExtensions = process.env.ALLOWED_FILE_EXTENSIONS
  ? process.env.ALLOWED_FILE_EXTENSIONS.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  : defaultAllowedExtensions;

// Check whether allowed image upload is true.
const isAllowedImageUpload = (file = {}) => {
  const mimeType = String(file.mimetype || '').toLowerCase();
  const extension = path.extname(String(file.originalname || '')).toLowerCase();

  if (configuredAllowedTypes.includes(mimeType)) {
    return true;
  }

  return mimeType.startsWith('image/') && configuredAllowedExtensions.includes(extension);
};

const serverConfig = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // Database configuration
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    name: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'mysql',
    
    // Environment-specific database options
    get options() {
      const isDbLoggingEnabled = process.env.DB_LOGGING === 'true';
      const baseOptions = {
        logging: isDbLoggingEnabled ? console.log : false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      };

      if (serverConfig.nodeEnv === 'production') {
        return {
          ...baseOptions,
          dialectOptions: {
            ssl: process.env.DB_SSL === 'true' ? {
              require: true,
              rejectUnauthorized: false
            } : false
          }
        };
      }

      return baseOptions;
    }
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',') 
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },

  // Security configuration
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    },
    rateLimiting: {
      enabled: process.env.RATE_LIMITING !== 'false'
    }
  },

  // Logging configuration
  logging: {
    enabled: process.env.HTTP_LOGGING !== 'false',
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'dev'),
    format: process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
  },

  // File upload configuration
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    allowedTypes: configuredAllowedTypes,
    allowedExtensions: configuredAllowedExtensions,
    destination: process.env.UPLOAD_DESTINATION || 'uploads/'
  },
  isAllowedImageUpload
};

// Validate environment on startup
try {
  validateEnvironment();
} catch (error) {
  console.error('Environment validation failed:', error.message);
  process.exit(1);
}

module.exports = serverConfig;
