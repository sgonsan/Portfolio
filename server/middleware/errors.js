// Wrap async handlers so rejections reach the error middleware
// instead of crashing the process.
const asyncWrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Central error handler: log full detail server-side, return nothing
// internal to the client.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { asyncWrap, notFound, errorHandler };
