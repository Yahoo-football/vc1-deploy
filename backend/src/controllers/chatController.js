const { Op, fn, col } = require('sequelize');
const { ChatConversation, ChatMessage, User, sequelize } = require('../models');
const { emitToUser } = require('../realtime/sseServer');

const USER_ATTRIBUTES = ['id', 'username', 'email', 'firstName', 'lastName', 'role', 'status', 'avatarUrl'];

const asyncHandler = (fnHandler) => (req, res, next) => {
  Promise.resolve(fnHandler(req, res, next)).catch(next);
};

const normalizeUserId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildDirectKey = (leftUserId, rightUserId) => {
  const normalized = [Number(leftUserId), Number(rightUserId)].sort((a, b) => a - b);
  return `${normalized[0]}:${normalized[1]}`;
};

const mapUser = (user) => {
  if (!user) return null;
  const payload = user.toJSON ? user.toJSON() : user;
  return {
    id: payload.id,
    username: payload.username || '',
    email: payload.email || '',
    firstName: payload.firstName || '',
    lastName: payload.lastName || '',
    role: payload.role || 'player',
    status: payload.status || 'active',
    avatarUrl: payload.avatarUrl || null
  };
};

const mapMessage = (message, currentUserId) => {
  if (!message) return null;
  const payload = message.toJSON ? message.toJSON() : message;
  return {
    id: payload.id,
    conversationId: payload.conversationId,
    senderId: payload.senderId,
    recipientId: payload.recipientId,
    body: payload.body,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    readAt: payload.readAt || null,
    isOwn: Number(payload.senderId) === Number(currentUserId)
  };
};

const resolveOtherUser = (conversation, currentUserId) => {
  if (!conversation) return null;
  const payload = conversation.toJSON ? conversation.toJSON() : conversation;
  const isUserOne = Number(payload.userOneId) === Number(currentUserId);
  return isUserOne ? payload.userTwo : payload.userOne;
};

const assertParticipant = (conversation, userId) => {
  if (!conversation) return false;
  return (
    Number(conversation.userOneId) === Number(userId) ||
    Number(conversation.userTwoId) === Number(userId)
  );
};

const loadConversationById = async (conversationId) => {
  return ChatConversation.findByPk(conversationId, {
    include: [
      { model: User, as: 'userOne', attributes: USER_ATTRIBUTES },
      { model: User, as: 'userTwo', attributes: USER_ATTRIBUTES }
    ]
  });
};

const serializeConversation = async (conversation, currentUserId, extra = {}) => {
  const payload = conversation.toJSON ? conversation.toJSON() : conversation;
  const otherUser = resolveOtherUser(payload, currentUserId);
  const lastMessage = extra.lastMessage || null;
  const unreadCount = Number(extra.unreadCount || 0);

  return {
    id: payload.id,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    lastMessageAt: payload.lastMessageAt || payload.updatedAt,
    otherUser: mapUser(otherUser),
    unreadCount,
    lastMessage: mapMessage(lastMessage, currentUserId)
  };
};

const listConversations = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;

  const conversations = await ChatConversation.findAll({
    where: {
      [Op.or]: [{ userOneId: currentUserId }, { userTwoId: currentUserId }]
    },
    include: [
      { model: User, as: 'userOne', attributes: USER_ATTRIBUTES },
      { model: User, as: 'userTwo', attributes: USER_ATTRIBUTES }
    ],
    order: [
      ['lastMessageAt', 'DESC'],
      ['updatedAt', 'DESC'],
      ['id', 'DESC']
    ]
  });

  const conversationIds = conversations.map((item) => item.id);

  const unreadRows = conversationIds.length
    ? await ChatMessage.findAll({
        attributes: ['conversationId', [fn('COUNT', col('id')), 'unreadCount']],
        where: {
          conversationId: { [Op.in]: conversationIds },
          recipientId: currentUserId,
          readAt: null
        },
        group: ['conversationId'],
        raw: true
      })
    : [];

  const lastMessageRows = conversationIds.length
    ? await ChatMessage.findAll({
        where: {
          conversationId: { [Op.in]: conversationIds }
        },
        order: [
          ['conversationId', 'ASC'],
          ['createdAt', 'DESC'],
          ['id', 'DESC']
        ]
      })
    : [];

  const unreadCountMap = new Map(
    unreadRows.map((row) => [Number(row.conversationId), Number(row.unreadCount || 0)])
  );
  const lastMessageMap = new Map();
  lastMessageRows.forEach((row) => {
    if (!lastMessageMap.has(Number(row.conversationId))) {
      lastMessageMap.set(Number(row.conversationId), row);
    }
  });

  const serialized = await Promise.all(
    conversations.map((conversation) =>
      serializeConversation(conversation, currentUserId, {
        unreadCount: unreadCountMap.get(Number(conversation.id)) || 0,
        lastMessage: lastMessageMap.get(Number(conversation.id)) || null
      })
    )
  );

  res.json({ success: true, data: serialized });
});

const searchChatUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const currentUserRole = req.user.role;
  const query = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);

  const where = {
    id: { [Op.ne]: currentUserId }
  };

  if (currentUserRole !== 'admin') {
    where.status = 'active';
  }

  if (query) {
    where[Op.or] = [
      { username: { [Op.like]: `%${query}%` } },
      { email: { [Op.like]: `%${query}%` } },
      { firstName: { [Op.like]: `%${query}%` } },
      { lastName: { [Op.like]: `%${query}%` } }
    ];
  }

  const users = await User.findAll({
    where,
    attributes: USER_ATTRIBUTES,
    limit,
    order: [
      ['status', 'ASC'],
      ['createdAt', 'DESC'],
      ['id', 'DESC']
    ]
  });

  const candidateIds = users.map((user) => user.id);
  const existingConversations = candidateIds.length
    ? await ChatConversation.findAll({
        where: {
          [Op.or]: [
            {
              userOneId: currentUserId,
              userTwoId: { [Op.in]: candidateIds }
            },
            {
              userTwoId: currentUserId,
              userOneId: { [Op.in]: candidateIds }
            }
          ]
        },
        attributes: ['id', 'userOneId', 'userTwoId']
      })
    : [];

  const conversationByOtherUserId = new Map();
  existingConversations.forEach((conversation) => {
    const otherUserId =
      Number(conversation.userOneId) === Number(currentUserId)
        ? Number(conversation.userTwoId)
        : Number(conversation.userOneId);
    conversationByOtherUserId.set(otherUserId, conversation.id);
  });

  res.json({
    success: true,
    data: users.map((user) => ({
      ...mapUser(user),
      conversationId: conversationByOtherUserId.get(Number(user.id)) || null
    }))
  });
});

const openConversation = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const targetUserId = normalizeUserId(req.body?.userId);

  if (!targetUserId) {
    return res.status(400).json({ success: false, message: 'A valid userId is required.' });
  }

  if (targetUserId === Number(currentUserId)) {
    return res.status(400).json({ success: false, message: 'You cannot start a chat with yourself.' });
  }

  const targetUser = await User.findByPk(targetUserId, {
    attributes: USER_ATTRIBUTES
  });

  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (req.user.role !== 'admin' && targetUser.status !== 'active') {
    return res.status(403).json({ success: false, message: 'This user is not available for chat.' });
  }

  const directKey = buildDirectKey(currentUserId, targetUserId);
  const [userOneId, userTwoId] = directKey.split(':').map(Number);

  const [conversation, created] = await ChatConversation.findOrCreate({
    where: { directKey },
    defaults: {
      directKey,
      userOneId,
      userTwoId,
      createdBy: currentUserId
    }
  });

  const loadedConversation = await loadConversationById(conversation.id);
  const lastMessage = await ChatMessage.findOne({
    where: { conversationId: conversation.id },
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC']
    ]
  });
  const unreadCount = await ChatMessage.count({
    where: {
      conversationId: conversation.id,
      recipientId: currentUserId,
      readAt: null
    }
  });

  res.status(created ? 201 : 200).json({
    success: true,
    data: await serializeConversation(loadedConversation, currentUserId, {
      unreadCount,
      lastMessage
    })
  });
});

const getConversationMessages = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const conversationId = normalizeUserId(req.params.id);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

  if (!conversationId) {
    return res.status(400).json({ success: false, message: 'A valid conversation id is required.' });
  }

  const conversation = await loadConversationById(conversationId);
  if (!conversation || !assertParticipant(conversation, currentUserId)) {
    return res.status(404).json({ success: false, message: 'Conversation not found.' });
  }

  const newestFirst = await ChatMessage.findAll({
    where: { conversationId },
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC']
    ],
    limit
  });

  const messages = [...newestFirst].reverse().map((message) => mapMessage(message, currentUserId));

  res.json({
    success: true,
    data: {
      conversation: await serializeConversation(conversation, currentUserId, {
        unreadCount: await ChatMessage.count({
          where: {
            conversationId,
            recipientId: currentUserId,
            readAt: null
          }
        }),
        lastMessage: newestFirst[0] || null
      }),
      messages
    }
  });
});

const markConversationRead = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const conversationId = normalizeUserId(req.params.id);

  if (!conversationId) {
    return res.status(400).json({ success: false, message: 'A valid conversation id is required.' });
  }

  const conversation = await loadConversationById(conversationId);
  if (!conversation || !assertParticipant(conversation, currentUserId)) {
    return res.status(404).json({ success: false, message: 'Conversation not found.' });
  }

  const readAt = new Date();
  const [updatedCount] = await ChatMessage.update(
    { readAt },
    {
      where: {
        conversationId,
        recipientId: currentUserId,
        readAt: null
      }
    }
  );

  const otherUserId =
    Number(conversation.userOneId) === Number(currentUserId)
      ? Number(conversation.userTwoId)
      : Number(conversation.userOneId);

  if (updatedCount > 0) {
    emitToUser(currentUserId, 'chat:read', {
      conversationId,
      readerId: currentUserId,
      readAt: readAt.toISOString()
    });
    emitToUser(otherUserId, 'chat:read', {
      conversationId,
      readerId: currentUserId,
      readAt: readAt.toISOString()
    });
  }

  res.json({
    success: true,
    data: {
      updatedCount,
      readAt: readAt.toISOString()
    }
  });
});

const sendMessage = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const conversationId = normalizeUserId(req.params.id);
  const body = String(req.body?.body || '').trim();

  if (!conversationId) {
    return res.status(400).json({ success: false, message: 'A valid conversation id is required.' });
  }

  if (!body) {
    return res.status(400).json({ success: false, message: 'Message text is required.' });
  }

  if (body.length > 5000) {
    return res.status(400).json({ success: false, message: 'Message is too long.' });
  }

  const conversation = await loadConversationById(conversationId);
  if (!conversation || !assertParticipant(conversation, currentUserId)) {
    return res.status(404).json({ success: false, message: 'Conversation not found.' });
  }

  const recipientId =
    Number(conversation.userOneId) === Number(currentUserId)
      ? Number(conversation.userTwoId)
      : Number(conversation.userOneId);

  const createdMessage = await sequelize.transaction(async (transaction) => {
    const message = await ChatMessage.create(
      {
        conversationId,
        senderId: currentUserId,
        recipientId,
        body
      },
      { transaction }
    );

    await conversation.update(
      {
        lastMessageAt: message.createdAt
      },
      { transaction }
    );

    return message;
  });

  const conversationPayload = await serializeConversation(conversation, currentUserId, {
    unreadCount: 0,
    lastMessage: createdMessage
  });
  const messagePayload = mapMessage(createdMessage, currentUserId);

  emitToUser(currentUserId, 'chat:message', {
    conversationId,
    messageId: createdMessage.id,
    senderId: currentUserId
  });
  emitToUser(recipientId, 'chat:message', {
    conversationId,
    messageId: createdMessage.id,
    senderId: currentUserId
  });

  res.status(201).json({
    success: true,
    data: {
      conversation: conversationPayload,
      message: messagePayload
    }
  });
});

module.exports = {
  listConversations,
  searchChatUsers,
  openConversation,
  getConversationMessages,
  markConversationRead,
  sendMessage
};
