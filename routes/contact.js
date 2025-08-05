const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { handleContact } = require('../controllers/contactController');

// Limiter to prevent spam
const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  message: { error: 'Please wait before sending another message' }
});

router.post('/', contactLimiter, handleContact);

module.exports = router;
