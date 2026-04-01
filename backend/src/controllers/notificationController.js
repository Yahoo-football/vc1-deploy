const { Notification, User } = require('../models');

// Support async handler for this module.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Resolve sender id from metadata into a display-safe value.
const resolveSenderIdFromMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== 'object') return null;
  return metadata.requesterId || metadata.inviterId || metadata.inviteeId || metadata.actorId || null;
};

// Build display name for rendering.
const buildDisplayName = (user) => {
  if (!user) return null;
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return fullName || user.username || null;
};

// Support attach sender profiles for this module.
const attachSenderProfiles = async (notifications) => {
  const senderIds = Array.from(
    new Set(
      notifications
        .map((item) => resolveSenderIdFromMetadata(item.metadata))
        .filter(Boolean)
    )
  );

  if (senderIds.length === 0) {
    return notifications.map((item) => ({
      ...item.toJSON(),
      sender: null
    }));
  }

  const senders = await User.findAll({
    where: { id: senderIds },
    attributes: ['id', 'username', 'firstName', 'lastName', 'avatarUrl']
  });

  const senderMap = new Map(
    senders.map((user) => [user.id, {
      id: user.id,
      name: buildDisplayName(user),
      username: user.username || null,
      avatarUrl: user.avatarUrl || null
    }])
  );

  return notifications.map((item) => {
    const payload = item.toJSON();
    const senderId = resolveSenderIdFromMetadata(payload.metadata);
    return {
      ...payload,
      sender: senderId ? senderMap.get(senderId) || null : null
    };
  });
};

const getAllNotifications = asyncHandler(async (req, res) => {
  const { userId, isRead, type } = req.query;
  const whereClause = {};
  const isAdmin = req.user.role === 'admin';
  
  // Non-admin users can only access their own notifications.
  if (isAdmin && userId) {
    whereClause.userId = userId;
  } else {
    whereClause.userId = req.user.id;
  }
  if (isRead !== undefined) whereClause.isRead = isRead === 'true';
  if (type) whereClause.type = type;
  
  const notifications = await Notification.findAll({
    where: whereClause,
    include: [
      { model: User, as: 'user', attributes: ['id', 'username', 'email', 'firstName', 'lastName'] }
    ],
    order: [['createdAt', 'DESC']]
  });
  const withSender = await attachSenderProfiles(notifications);
  res.json({ success: true, data: withSender });
});

const getNotificationById = asyncHandler(async (req, res) => {
  const notification = await Notification.findByPk(req.params.id, {
    include: [
      { model: User, as: 'user', attributes: ['id', 'username', 'email', 'firstName', 'lastName'] }
    ]
  });
  
  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  if (notification.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized to view this notification' });
  }
  
  const [withSender] = await attachSenderProfiles([notification]);
  res.json({ success: true, data: withSender || notification });
});

const createNotification = asyncHandler(async (req, res) => {
  try {
    const notification = await Notification.create(req.body);
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const updateNotification = asyncHandler(async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    // Authorization check
    if (notification.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this notification' });
    }
    
    const updatedNotification = await notification.update(req.body);
    res.json({ success: true, data: updatedNotification });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const deleteNotification = asyncHandler(async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    // Authorization check
    if (notification.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this notification' });
    }
    
    await notification.destroy();
    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification
};
