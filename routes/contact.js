const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { handleContact } = require('../controllers/contactController');

// Limitar 1 mensaje por minuto
const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  message: { error: 'Por favor espera antes de enviar otro mensaje' }
});

router.post('/', contactLimiter, handleContact);

module.exports = router;
