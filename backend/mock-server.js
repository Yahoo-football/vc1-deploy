const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const mockUsers = [
  {
    id: 1,
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    email: 'test@example.com',
    role: 'player',
    status: 'active',
    avatarUrl: null
  },
  {
    id: 2,
    firstName: 'Admin',
    lastName: 'Support',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    avatarUrl: null
  },
  {
    id: 3,
    firstName: 'Dara',
    lastName: 'Captain',
    username: 'dara.captain',
    email: 'captain@example.com',
    role: 'captain',
    status: 'active',
    avatarUrl: null
  }
];
const chatConversations = [];
const chatMessages = [];
let chatConversationIdCounter = 1;
let chatMessageIdCounter = 1;
let mockUserIdCounter = 4;

// Mock auth routes
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_RESENDS = 3;
const otpStore = new Map();

const normalizeIdentifier = (value = '') => String(value).trim().toLowerCase();
const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const RESET_TTL_MS = 30 * 60 * 1000;
const resetTokenStore = new Map();
const generateResetToken = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const buildMockToken = (userId) => `mock-jwt-token-${Date.now()}-${userId}`;
const extractTokenUserId = (req) => {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  const match = token.match(/-(\d+)$/);
  const userId = match ? Number(match[1]) : null;
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};
const getCurrentUser = (req) => {
  const tokenUserId = extractTokenUserId(req);
  if (tokenUserId) {
    const user = mockUsers.find((item) => Number(item.id) === tokenUserId);
    if (user) return user;
  }

  return mockUsers[0];
};
const buildChatUser = (user) => ({
  id: user.id,
  username: user.username || '',
  email: user.email || '',
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  role: user.role || 'player',
  status: user.status || 'active',
  avatarUrl: user.avatarUrl || null
});
const buildConversationKey = (leftUserId, rightUserId) =>
  [Number(leftUserId), Number(rightUserId)].sort((a, b) => a - b).join(':');
const getConversationMessages = (conversationId) =>
  chatMessages
    .filter((message) => Number(message.conversationId) === Number(conversationId))
    .sort((leftMessage, rightMessage) => new Date(leftMessage.createdAt) - new Date(rightMessage.createdAt));
const getOrCreateConversation = (currentUserId, otherUserId) => {
  const directKey = buildConversationKey(currentUserId, otherUserId);
  let conversation = chatConversations.find((item) => item.directKey === directKey);

  if (!conversation) {
    const [userOneId, userTwoId] = directKey.split(':').map(Number);
    const timestamp = new Date().toISOString();
    conversation = {
      id: chatConversationIdCounter++,
      directKey,
      userOneId,
      userTwoId,
      createdBy: currentUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastMessageAt: null
    };
    chatConversations.push(conversation);
  }

  return conversation;
};
const buildConversationSummary = (conversation, currentUserId) => {
  const otherUserId =
    Number(conversation.userOneId) === Number(currentUserId)
      ? Number(conversation.userTwoId)
      : Number(conversation.userOneId);
  const otherUser = mockUsers.find((user) => Number(user.id) === otherUserId);
  const messages = getConversationMessages(conversation.id);
  const lastMessage = messages[messages.length - 1] || null;
  const unreadCount = messages.filter(
    (message) => Number(message.recipientId) === Number(currentUserId) && !message.readAt
  ).length;

  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastMessageAt: conversation.lastMessageAt || conversation.updatedAt,
    otherUser: otherUser ? buildChatUser(otherUser) : null,
    unreadCount,
    lastMessage
  };
};

app.post('/api/auth/register', (req, res) => {
  console.log('Mock registration received:', JSON.stringify(req.body, null, 2));
  
  try {
    const { firstName, lastName, username, email, password, role } = req.body;
    
    // Basic validation
    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'All required fields must be provided'
      });
    }
    
    // Simulate successful registration
    setTimeout(() => {
      const newUser = {
        id: mockUserIdCounter++,
        firstName,
        lastName,
        username,
        email,
        role: role || 'player',
        status: 'active',
        avatarUrl: null
      };
      mockUsers.push(newUser);

      res.json({
        success: true,
        data: {
          user: newUser,
          token: buildMockToken(newUser.id)
        }
      });
    }, 1000); // Simulate network delay
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/auth/login', (req, res) => {
  console.log('Mock login received:', req.body);
  
  try {
    const { username, email, password } = req.body;
    const loginIdentifier = username || email;
    
    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const user =
      mockUsers.find(
        (item) => item.username === loginIdentifier || item.email === loginIdentifier
      ) || mockUsers[0];
    
    res.json({
      success: true,
      data: {
        user,
        token: buildMockToken(user.id)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/auth/forgot-password', (req, res) => {
  const identifier = normalizeIdentifier(req.body?.identifier);
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Email or phone is required' });
  }

  const existing = otpStore.get(identifier);
  const resendCount = existing?.resendCount || 0;
  if (resendCount >= OTP_MAX_RESENDS) {
    return res.status(429).json({ success: false, error: 'OTP resend limit reached' });
  }

  const otp = generateOtpCode();
  otpStore.set(identifier, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    resendCount: resendCount + 1
  });

  console.log(`[otp] Send OTP to ${identifier}: ${otp}`);

  res.json({ success: true, message: 'OTP sent successfully.' });
});

app.post('/api/auth/forgot-password/verify', (req, res) => {
  const identifier = normalizeIdentifier(req.body?.identifier);
  const otp = String(req.body?.otp || '').trim();
  if (!identifier || !otp) {
    return res.status(400).json({ success: false, error: 'Identifier and OTP are required' });
  }

  const entry = otpStore.get(identifier);
  if (!entry) {
    return res.status(400).json({ success: false, error: 'OTP not found. Please request a new one.' });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(identifier);
    return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
  }

  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(identifier);
    return res.status(429).json({ success: false, error: 'Too many attempts. Please request a new OTP.' });
  }

  if (entry.otp !== otp) {
    entry.attempts += 1;
    otpStore.set(identifier, entry);
    return res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
  }

  res.json({ success: true, message: 'OTP verified.' });
});

app.post('/api/auth/forgot-password/reset', (req, res) => {
  const identifier = normalizeIdentifier(req.body?.identifier);
  const otp = String(req.body?.otp || '').trim();
  const newPassword = String(req.body?.newPassword || '').trim();

  if (!identifier || !otp || !newPassword) {
    return res.status(400).json({ success: false, error: 'Identifier, OTP, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }

  const entry = otpStore.get(identifier);
  if (!entry) {
    return res.status(400).json({ success: false, error: 'OTP not found. Please request a new one.' });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(identifier);
    return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
  }

  if (entry.otp !== otp) {
    return res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
  }

  otpStore.delete(identifier);
  res.json({ success: true, message: 'Password reset successfully.' });
});

app.post('/api/auth/forgot-password-link', (req, res) => {
  const identifier = normalizeIdentifier(req.body?.identifier);
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const token = generateResetToken();
  resetTokenStore.set(token, { expiresAt: Date.now() + RESET_TTL_MS });
  const resetLink = `http://localhost:3000/reset-password?token=${token}`;

  console.log(`[reset] Send reset link to ${identifier}: ${resetLink}`);

  res.json({ success: true, message: 'Password reset link sent.', resetLink });
});

app.post('/api/auth/reset-password', (req, res) => {
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.newPassword || '').trim();
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, error: 'Token and new password are required' });
  }

  const entry = resetTokenStore.get(token);
  if (!entry) {
    return res.status(400).json({ success: false, error: 'Invalid or expired reset token.' });
  }

  if (Date.now() > entry.expiresAt) {
    resetTokenStore.delete(token);
    return res.status(400).json({ success: false, error: 'Reset token expired.' });
  }

  resetTokenStore.delete(token);
  res.json({ success: true, message: 'Password reset successfully.' });
});

// Alias routes without /api for compatibility
app.post('/auth/forgot-password', (req, res) => {
  req.url = '/api/auth/forgot-password';
  app._router.handle(req, res);
});
app.post('/auth/forgot-password/verify', (req, res) => {
  req.url = '/api/auth/forgot-password/verify';
  app._router.handle(req, res);
});
app.post('/auth/forgot-password/reset', (req, res) => {
  req.url = '/api/auth/forgot-password/reset';
  app._router.handle(req, res);
});
app.post('/auth/forgot-password-link', (req, res) => {
  req.url = '/api/auth/forgot-password-link';
  app._router.handle(req, res);
});
app.post('/auth/reset-password', (req, res) => {
  req.url = '/api/auth/reset-password';
  app._router.handle(req, res);
});

app.get('/api/auth/profile', (req, res) => {
  const user = getCurrentUser(req);
  res.json({
    success: true,
    data: user
  });
});

app.get('/api/chats/users', (req, res) => {
  const currentUser = getCurrentUser(req);
  const query = String(req.query.q || '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);

  const results = mockUsers
    .filter((user) => Number(user.id) !== Number(currentUser.id))
    .filter((user) => {
      if (!query) return true;
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
      return (
        String(user.username || '').toLowerCase().includes(query) ||
        String(user.email || '').toLowerCase().includes(query) ||
        fullName.includes(query)
      );
    })
    .slice(0, limit)
    .map(buildChatUser);

  res.json({ success: true, data: results });
});

app.get('/api/chats/conversations', (req, res) => {
  const currentUser = getCurrentUser(req);
  const summaries = chatConversations
    .filter(
      (conversation) =>
        Number(conversation.userOneId) === Number(currentUser.id) ||
        Number(conversation.userTwoId) === Number(currentUser.id)
    )
    .map((conversation) => buildConversationSummary(conversation, currentUser.id))
    .sort((leftItem, rightItem) => new Date(rightItem.lastMessageAt || 0) - new Date(leftItem.lastMessageAt || 0));

  res.json({ success: true, data: summaries });
});

app.post('/api/chats/conversations', (req, res) => {
  const currentUser = getCurrentUser(req);
  const otherUserId = Number(req.body?.userId);

  if (!Number.isInteger(otherUserId) || otherUserId <= 0 || otherUserId === Number(currentUser.id)) {
    return res.status(400).json({ success: false, error: 'Valid userId is required' });
  }

  const otherUser = mockUsers.find((user) => Number(user.id) === otherUserId);
  if (!otherUser) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const conversation = getOrCreateConversation(currentUser.id, otherUserId);
  res.json({ success: true, data: buildConversationSummary(conversation, currentUser.id) });
});

app.get('/api/chats/conversations/:id/messages', (req, res) => {
  const currentUser = getCurrentUser(req);
  const conversationId = Number(req.params.id);
  const conversation = chatConversations.find((item) => Number(item.id) === conversationId);

  if (!conversation) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }

  const isParticipant =
    Number(conversation.userOneId) === Number(currentUser.id) ||
    Number(conversation.userTwoId) === Number(currentUser.id);
  if (!isParticipant) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  const messages = getConversationMessages(conversationId).map((message) => ({
    ...message,
    isOwn: Number(message.senderId) === Number(currentUser.id)
  }));

  res.json({
    success: true,
    data: {
      conversation: buildConversationSummary(conversation, currentUser.id),
      messages
    }
  });
});

app.post('/api/chats/conversations/:id/read', (req, res) => {
  const currentUser = getCurrentUser(req);
  const conversationId = Number(req.params.id);
  const readAt = new Date().toISOString();
  let updatedCount = 0;

  chatMessages.forEach((message) => {
    if (
      Number(message.conversationId) === conversationId &&
      Number(message.recipientId) === Number(currentUser.id) &&
      !message.readAt
    ) {
      message.readAt = readAt;
      updatedCount += 1;
    }
  });

  res.json({
    success: true,
    data: {
      updatedCount,
      readAt
    }
  });
});

app.post('/api/chats/conversations/:id/messages', (req, res) => {
  const currentUser = getCurrentUser(req);
  const conversationId = Number(req.params.id);
  const body = String(req.body?.body || '').trim();
  const conversation = chatConversations.find((item) => Number(item.id) === conversationId);

  if (!conversation) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }

  if (!body) {
    return res.status(400).json({ success: false, error: 'Message text is required' });
  }

  const recipientId =
    Number(conversation.userOneId) === Number(currentUser.id)
      ? Number(conversation.userTwoId)
      : Number(conversation.userOneId);
  const timestamp = new Date().toISOString();
  const message = {
    id: chatMessageIdCounter++,
    conversationId,
    senderId: currentUser.id,
    recipientId,
    body,
    createdAt: timestamp,
    updatedAt: timestamp,
    readAt: null
  };

  chatMessages.push(message);
  conversation.lastMessageAt = timestamp;
  conversation.updatedAt = timestamp;

  res.status(201).json({
    success: true,
    data: {
      conversation: buildConversationSummary(conversation, currentUser.id),
      message: {
        ...message,
        isOwn: true
      }
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Mock server running on http://localhost:${PORT}`);
  console.log('📝 Registration endpoint: POST /api/auth/register');
  console.log('🔑 Login endpoint: POST /api/auth/login');
  console.log('👤 Profile endpoint: GET /api/auth/profile');
});
