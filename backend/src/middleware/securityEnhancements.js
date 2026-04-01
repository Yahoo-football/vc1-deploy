const crypto = require('crypto');

// Support strip dangerous keys for this module.
const stripDangerousKeys = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripDangerousKeys);
  }

  if (value && typeof value === 'object') {
    const sanitized = {};
    Object.keys(value).forEach((key) => {
      if (key.includes('$') || key.includes('.')) return;
      sanitized[key] = stripDangerousKeys(value[key]);
    });
    return sanitized;
  }

  if (typeof value === 'string') {
    return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  return value;
};

// Support attach request id for this module.
const attachRequestId = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const generatedId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');
  const requestId = Array.isArray(incomingId) ? incomingId[0] : incomingId || generatedId;
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

// Support sanitize request payload for this module.
const sanitizeRequestPayload = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = stripDangerousKeys(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    const sanitizedQuery = stripDangerousKeys(req.query);
    Object.keys(req.query).forEach((key) => {
      if (!(key in sanitizedQuery)) delete req.query[key];
    });
    Object.keys(sanitizedQuery).forEach((key) => {
      req.query[key] = sanitizedQuery[key];
    });
  }
  next();
};

module.exports = {
  attachRequestId,
  sanitizeRequestPayload
};
