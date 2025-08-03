const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
require('@dotenvx/dotenvx').config();

const zenRoutes = require('./routes/zen');
const projectsRoutes = require('./routes/projects');
const contactRoutes = require('./routes/contact');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.NODE_ENV === 'production' ? 8080 : 3000;

// Middlewares globales
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Rutas
app.use('/api/zen', zenRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/stats', statsRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
