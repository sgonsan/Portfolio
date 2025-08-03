const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
require('@dotenvx/dotenvx').config()

const app = express();
const PORT = process.env.NODE_ENV === 'production' ? 8080 : 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Ruta del JSON
const projectsPath = path.join(__dirname, 'projects.json');

let cacheData = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

// Sirve contenido estático desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para parsear JSON
app.use(bodyParser.json());

// Endpoint API para proyectos
app.get('/api/projects', async (req, res) => {
  const now = Date.now();

  // Si hay cache y no ha caducado
  if (cacheData && now - cacheTimestamp < CACHE_DURATION) {
    console.log(`${now.toLocaleString()} Serving from cache`);
    return res.json(cacheData);
  }

  try {
    const raw = fs.readFileSync(projectsPath, 'utf8');
    const urls = JSON.parse(raw); // "user/project"

    const results = [];
    for (const url of urls) {
      const repoPath = new URL(url).pathname.slice(1);
      const apiUrl = `https://api.github.com/repos/${repoPath}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'portfolio-app'
        }
      });

      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
      const data = await response.json();

      results.push({
        name: data.name,
        description: data.description,
        html_url: data.html_url
      });
    }

    // Guardar en cache
    cacheData = results;
    cacheTimestamp = now;

    console.log(`${now.toLocaleString()} Serving from GitHub API`);
    res.json(results);
  } catch (err) {
    console.error(`${now.toLocaleString()} Error fetching projects:`, err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Configura el transporter de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

const contactLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 1, // solo 1 mensaje por minuto
  message: { error: 'Por favor espera antes de enviar otro mensaje' }
});

// Endpoint para manejar formulario
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, message } = req.body;
  const now = new Date().toLocaleString();

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_USER, // Te lo envías a ti mismo
      subject: `Nuevo mensaje de ${name}`,
      replyTo: email,
      text: `Nombre: ${name}\nEmail: ${email}\n\n${message}`
    });

    console.log(`${now.toLocaleString()} Mensaje enviado de ${name} <${email}>: ${message}`);
    res.json({ success: true, message: 'Message sent!' });
  } catch (err) {
    console.error(`${now.toLocaleString()} Error sending message:`, err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  const now = new Date().toLocaleString();
  console.log(`${now} Server running on http://localhost:${PORT}`);
});
