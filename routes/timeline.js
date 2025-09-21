// routes/timelineRoutes.js
const express = require('express');
const router = express.Router();
const { getTimeline } = require('../controllers/timelineController');

router.get('/', getTimeline);

module.exports = router;
