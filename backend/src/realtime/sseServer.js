const jwt = require('jsonwebtoken');

const userConnections = new Map();

const addUserConnection = (userId, response) => {
  const key = String(userId);
  const existing = userConnections.get(key) || new Set();
  existing.add(response);
  userConnections.set(key, existing);
};

const removeUserConnection = (userId, response) => {
  const key = String(userId);
  const existing = userConnections.get(key);
  if (!existing) return;
  existing.delete(response);
  if (existing.size === 0) {
    userConnections.delete(key);
  }
};

const sendEvent = (response, event, payload) => {
  if (!response || response.writableEnded) return;
  response.write(`data: ${JSON.stringify({
    event,
    payload,
    timestamp: new Date().toISOString()
  })}\n\n`);
};

const emitToUser = (userId, event, payload) => {
  const responses = userConnections.get(String(userId));
  if (!responses || responses.size === 0) return 0;

  let delivered = 0;
  responses.forEach((response) => {
    if (!response.writableEnded) {
      sendEvent(response, event, payload);
      delivered += 1;
    }
  });
  return delivered;
};

const emitToAll = (event, payload) => {
  let delivered = 0;
  userConnections.forEach((responses) => {
    responses.forEach((response) => {
      if (!response.writableEnded) {
        sendEvent(response, event, payload);
        delivered += 1;
      }
    });
  });
  return delivered;
};

const resolveToken = (request) => {
  const queryToken = request.query?.token;
  if (queryToken) return String(queryToken);

  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').trim();
  }

  return null;
};

const handleRealtimeStream = (req, res) => {
  const token = resolveToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    addUserConnection(userId, res);
    sendEvent(res, 'sse:connected', { userId });

    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      sendEvent(res, 'sse:ping', { ok: true });
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeUserConnection(userId, res);
      res.end();
    });
  } catch (_) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
};

module.exports = {
  handleRealtimeStream,
  emitToUser,
  emitToAll
};
