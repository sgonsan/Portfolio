const express = require('express');
const { asyncWrap } = require('../middleware/errors');

function createContentRouter({ contentService }) {
  const router = express.Router();

  router.get('/', asyncWrap(async (req, res) => {
    const data = await contentService.get();
    res.set('Cache-Control', 'public, max-age=10');
    res.json(data);
  }));

  return router;
}

module.exports = { createContentRouter };
