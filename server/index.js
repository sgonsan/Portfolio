require('dotenv').config();
const path = require('path');
const { pathToFileURL } = require('url');

const { createApp } = require('./app');
const { createPool } = require('./lib/db');
const { createMailer } = require('./lib/mailer');
const { createGithubClient } = require('./lib/github');
const { createContentService } = require('./lib/content');
const { createAuthService } = require('./lib/authService');
const { createAnalytics } = require('./lib/analytics');
const { generatePreview } = require('../scripts/gen-preview');

async function main() {
  const db = createPool();
  const mailer = createMailer();
  const github = createGithubClient({
    token: process.env.GITHUB_TOKEN,
    owner: 'sgonsan'
  });
  const contentService = createContentService(db);
  const authService = createAuthService(db);
  const analytics = createAnalytics(db);

  mailer.verify()
    .then(() => console.log('SMTP ready'))
    .catch((err) => console.error('SMTP error:', err.message));

  analytics.purgeOld().catch((err) => console.error('Analytics purge failed:', err.message));

  // Refresh the OG card on boot so it reflects the current content and photo.
  generatePreview().catch((err) => console.error('Preview generation failed:', err.message));

  // Astro SSR bundle is ESM — load it dynamically from CJS.
  let ssrHandler = null;
  try {
    const entry = pathToFileURL(path.join(__dirname, '../dist/server/entry.mjs')).href;
    ({ handler: ssrHandler } = await import(entry));
  } catch (err) {
    console.error('SSR bundle not found (run `npm run build`); serving APIs only:', err.message);
  }

  const app = createApp({ db, mailer, github, contentService, authService, analytics, ssrHandler });
  const PORT = Number(process.env.PORT) || (process.env.NODE_ENV === 'production' ? 8080 : 3000);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal boot error:', err);
  process.exit(1);
});
