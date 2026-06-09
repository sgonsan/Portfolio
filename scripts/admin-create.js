// Create a panel admin account: npm run admin:create -- <username>
// Password read from stdin with echo muted.
require('dotenv').config();
const readline = require('readline');
const { createPool } = require('../server/lib/db');
const { createAuthService } = require('../server/lib/authService');

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const onData = (char) => {
      if (!['\n', '\r', ''].includes(String(char))) {
        readline.moveCursor(process.stdout, -1, 0);
        process.stdout.write('*');
      }
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      process.stdin.removeListener('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: npm run admin:create -- <username>');
    process.exit(1);
  }
  const password = await askHidden(`Password for ${username}: `);
  const confirm = await askHidden('Confirm password: ');
  if (password !== confirm) {
    console.error('Passwords do not match');
    process.exit(1);
  }
  const pool = createPool();
  try {
    const result = await createAuthService(pool).createUser(username, password);
    if (result.error) {
      console.error(result.error);
      process.exit(1);
    }
    console.log(`Admin user '${result.user.username}' created (id ${result.user.id})`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
