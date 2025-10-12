const express = require('express');
const { listTopScores, createScore } = require('../controllers/scoresController');

const router = express.Router();

router.get('/', listTopScores);
router.post('/', createScore);

module.exports = router;
