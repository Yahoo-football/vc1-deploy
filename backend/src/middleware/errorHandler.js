class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

// Handle sequelize errors interactions.
const handleSequelizeErrors = (error) => {
  if (error.name === 'SequelizeValidationError') {
    const errors = error.errors.map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    return new ValidationError('Validation failed', errors);
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    const field = error.errors[0]?.path || 'field';
    return new ConflictError(`${field} already exists`);
  }

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return new ValidationError('Invalid reference to related resource');
  }

  if (error.name === 'SequelizeDatabaseError') {
    return new AppError('Database operation failed', 500);
  }

  return error;
};

// Handle jwterrors interactions.
const handleJWTErrors = (error) => {
  if (error.name === 'JsonWebTokenError') {
    return new UnauthorizedError('Invalid token');
  }

  if (error.name === 'TokenExpiredError') {
    return new UnauthorizedError('Token expired');
  }

  return error;
};

// Support error handler for this module.
const errorHandler = (error, req, res, next) => {
  let err = error;

  // Handle known error types
  if (error.name?.startsWith('Sequelize')) {
    err = handleSequelizeErrors(error);
  } else if (error.name?.includes('JsonWebToken') || error.name?.includes('Token')) {
    err = handleJWTErrors(error);
  }

  // Log error details
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Handle operational errors
  if (err.isOperational) {
    const response = {
      success: false,
      message: err.message
    };

    if (err.errors && err.errors.length > 0) {
      response.errors = err.errors;
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle programming errors
  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
      error: err.message,
      stack: err.stack
    });
  }

  // Production error response
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
};

// Support not found for this module.
const notFound = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

// Support async handler for this module.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  errorHandler,
  notFound,
  asyncHandler
};
