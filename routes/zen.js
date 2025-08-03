const express = require('express');
const router = express.Router();
const { getZenQuote } = require('../controllers/zenController');

router.get('/', getZenQuote);

module.exports = router;
