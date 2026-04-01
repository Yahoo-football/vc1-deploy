const express = require('express');
const { handleRealtimeStream } = require('../realtime/sseServer');

const router = express.Router();

router.get('/stream', handleRealtimeStream);

module.exports = router;
