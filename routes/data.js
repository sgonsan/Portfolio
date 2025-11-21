const express = require('express');
const router = express.Router();
const { getCombinedData } = require('../controllers/dataController');

router.get('/', getCombinedData);

module.exports = router;
