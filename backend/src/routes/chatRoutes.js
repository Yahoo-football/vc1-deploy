const express = require('express');
const auth = require('../middleware/auth');
const chatController = require('../controllers/chatController');

const router = express.Router();

router.use(auth);

router.get('/conversations', chatController.listConversations);
router.get('/users', chatController.searchChatUsers);
router.post('/conversations', chatController.openConversation);
router.get('/conversations/:id/messages', chatController.getConversationMessages);
router.post('/conversations/:id/read', chatController.markConversationRead);
router.post('/conversations/:id/messages', chatController.sendMessage);

module.exports = router;
