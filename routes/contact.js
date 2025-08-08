const express = require('express');
const rateLimit = require('express-rate-limit');
const { handleContact } = require('../controllers/contactController');

const router = express.Router();

// Rate limiter to reduce spam/abuse (1 request per minute per IP)
const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait before sending another message' }
});

// POST /api/contact
router.post('/', contactLimiter, handleContact);

module.exports = router;
