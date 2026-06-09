import { createApp } from '../server/app';

export function fakeDb(overrides = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/UPDATE stats/.test(sql) && /RETURNING/.test(sql)) {
        return { rows: [{ visits: 42, last_commit: '01/06/2026' }] };
      }
      if (/SELECT player, score/.test(sql)) {
        return { rows: [{ player: 'neo', score: 100 }] };
      }
      if (/FROM contacts/.test(sql)) {
        return { rows: overrides.contactRows || [] };
      }
      return { rows: [] };
    }
  };
}

export function fakeMailer() {
  const sent = [];
  return {
    sent,
    verify: async () => true,
    sendContactMail: async (msg) => sent.push({ kind: 'contact', ...msg }),
    sendAutoReply: async (msg) => sent.push({ kind: 'reply', to: msg.email })
  };
}

export function fakeGithub(overrides = {}) {
  return {
    zen: async () => 'Keep it logically awesome.',
    repos: async () => [{
      name: 'Portfolio', description: '', url: 'https://github.com/x',
      stars: 1, updated: '2026-01-01T00:00:00Z', lang: 'JavaScript'
    }],
    lastCommit: async () => '2026-06-01T10:00:00Z',
    ...overrides
  };
}

// DNS resolver that says every domain accepts mail.
export const okResolver = {
  resolveMx: async () => [{ exchange: 'mx.example.com', priority: 10 }],
  resolve4: async () => ['93.184.216.34'],
  resolve6: async () => []
};

export function buildApp({
  db = fakeDb(),
  mailer = fakeMailer(),
  github = fakeGithub(),
  resolver = okResolver,
  env = {}
} = {}) {
  const app = createApp({ db, mailer, github, resolver, env });
  return { app, db, mailer, github };
}
