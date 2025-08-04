const express = require('express');
const router = express.Router();
const { listDirectory } = require('../controllers/fsController');

router.get('/', listDirectory);

module.exports = router;
