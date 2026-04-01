const { Notification, User } = require('../models');
const emailService = require('./emailService');
const { emitToUser } = require('../realtime/wsServer');

// Support safe name for this module.
const safeName = (u) => {
  if (!u) return 'there';
  return u.firstName || u.username || 'there';
};

// Create in app notification for the current flow.
const createInAppNotification = async ({ userId, type, title, message, metadata = {} }) => {
  if (!userId) return null;

  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    metadata
  });

  try {
    emitToUser(userId, 'notification:new', notification.toJSON());
  } catch (_) {}

  return notification;
};

// Support notify user for this module.
const notifyUser = async ({ userId, type, title, message, metadata = {}, emailSubject, emailText, emailHtml }) => {
  if (!userId) return;

  const user = await User.findByPk(userId, {
    attributes: ['id', 'email', 'firstName', 'username']
  });

  if (!user) return;

  try {
    await createInAppNotification({
      userId: user.id,
      type,
      title,
      message,
      metadata
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[notify] Failed to create notification:', err?.message || err);
    }
  }

  try {
    await emailService.sendEmail({
      to: user.email,
      subject: emailSubject || title,
      text: emailText || `${safeName(user)},\n\n${message}`,
      html: emailHtml
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[notify] Failed to send email:', err?.message || err);
    }
  }
};

module.exports = {
  notifyUser,
  createInAppNotification
};
