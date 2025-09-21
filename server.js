const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
require('@dotenvx/dotenvx').config();

const zenRoutes = require('./routes/zen');
const projectsRoutes = require('./routes/projects');
const timelineRoutes = require('./routes/timeline');
const contactRoutes = require('./routes/contact');
const statsRoutes = require('./routes/stats');
const fsRoutes = require('./routes/fs');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.NODE_ENV === 'production' ? 8080 : 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Routes
app.use('/api/zen', zenRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/fs', fsRoutes);
app.use('/api/admin', adminRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
