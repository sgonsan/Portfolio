require('dotenv').config();

const { createApp } = require('./app');
const { createPool } = require('./lib/db');
const { createMailer } = require('./lib/mailer');
const { createGithubClient } = require('./lib/github');

const db = createPool();
const mailer = createMailer();
const github = createGithubClient({
  token: process.env.GITHUB_TOKEN,
  owner: 'sgonsan'
});

mailer.verify()
  .then(() => console.log('SMTP ready'))
  .catch((err) => console.error('SMTP error:', err.message));

const app = createApp({ db, mailer, github });
const PORT = Number(process.env.PORT) || (process.env.NODE_ENV === 'production' ? 8080 : 3000);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
