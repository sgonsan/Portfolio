const express = require('express');
const router = express.Router();
const { getFileSystem } = require('../controllers/fsController');

router.get('/', getFileSystem);

module.exports = router;
