import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from './helpers';
import { createMailer } from '../server/lib/mailer';

describe('healthz', () => {
  it('responds 200 without touching the DB', async () => {
    const { app, db } = buildApp();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(db.calls).toHaveLength(0);
  });
});

describe('security headers', () => {
  it('sets a strict CSP without unsafe-inline scripts', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/healthz');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('POST /api/contact', () => {
  it('accepts a valid submission, logs it and sends both mails', async () => {
    const { app, db, mailer } = buildApp();
    const res = await request(app).post('/api/contact').send({
      name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hello there'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(db.calls.some((c) => /INSERT INTO contacts/.test(c.sql))).toBe(true);
    expect(mailer.sent.map((m) => m.kind)).toEqual(['contact', 'reply']);
  });

  it('rejects when the honeypot field is filled', async () => {
    const { app, mailer } = buildApp();
    const res = await request(app).post('/api/contact').send({
      name: 'Bot', email: 'bot@example.com', message: 'spam', website: 'http://spam'
    });
    expect(res.status).toBe(400);
    expect(mailer.sent).toHaveLength(0);
  });

  it('rejects missing fields, bad email, oversized and non-string fields', async () => {
    const { app } = buildApp();
    const cases = [
      { name: '', email: 'a@b.co', message: 'x' },
      { name: 'A', email: 'not-an-email', message: 'x' },
      { name: 'A'.repeat(201), email: 'a@b.co', message: 'x' },
      { name: 'A', email: 'a@b.co', message: 'x'.repeat(5001) },
      { name: ['array'], email: 'a@b.co', message: 'x' }
    ];
    for (const body of cases) {
      const res = await request(app).post('/api/contact').send(body);
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
  });

  it('rejects when the email domain has no MX/A records', async () => {
    const failingResolver = {
      resolveMx: async () => { throw new Error('ENOTFOUND'); },
      resolve4: async () => { throw new Error('ENOTFOUND'); },
      resolve6: async () => { throw new Error('ENOTFOUND'); }
    };
    const { app } = buildApp({ resolver: failingResolver });
    const res = await request(app).post('/api/contact').send({
      name: 'A', email: 'a@nope-domain-xyz.invalid', message: 'hi'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/domain/i);
  });

  it('rate limits the second accepted submission from the same IP', async () => {
    const { app } = buildApp();
    const body = { name: 'A', email: 'a@example.com', message: 'hi' };
    expect((await request(app).post('/api/contact').send(body)).status).toBe(200);
    expect((await request(app).post('/api/contact').send(body)).status).toBe(429);
  });

  it('keys the rate limiter on CF-Connecting-IP, not the shared proxy IP', async () => {
    const { app } = buildApp({ env: { TRUST_CF_CONNECTING_IP: 'true' } });
    const body = { name: 'A', email: 'a@example.com', message: 'hi' };
    const send = (ip) => request(app).post('/api/contact').set('CF-Connecting-IP', ip).send(body);
    // Two distinct visitors share one proxy socket (same req.ip) but must get
    // independent buckets keyed on their real IP.
    expect((await send('203.0.113.1')).status).toBe(200);
    expect((await send('203.0.113.1')).status).toBe(429); // same visitor → limited
    expect((await send('203.0.113.2')).status).toBe(200); // different visitor → own bucket
  });

  it('ignores spoofed CF-Connecting-IP by default (fail closed)', async () => {
    const { app } = buildApp(); // no trust config
    const body = { name: 'A', email: 'a@example.com', message: 'hi' };
    const send = (ip) => request(app).post('/api/contact').set('CF-Connecting-IP', ip).send(body);
    // Rotating the (untrusted) header must NOT mint a fresh bucket.
    expect((await send('203.0.113.1')).status).toBe(200);
    expect((await send('9.9.9.9')).status).toBe(429);
  });

  it('logs the real client IP (CF-Connecting-IP) on the contact row', async () => {
    const { app, db } = buildApp({ env: { TRUST_CF_CONNECTING_IP: 'true' } });
    await request(app).post('/api/contact')
      .set('CF-Connecting-IP', '203.0.113.7')
      .send({ name: 'A', email: 'a@example.com', message: 'hi' });
    const insert = db.calls.find((c) => /INSERT INTO contacts/.test(c.sql));
    expect(insert.params[3]).toBe('203.0.113.7'); // params: name,email,message,ip,ua
  });
});

describe('mailer header injection', () => {
  it('strips CR/LF from name and email before they reach headers', async () => {
    const sent = [];
    const mailer = createMailer(
      { MAIL_USER: 'me@example.com' },
      { sendMail: async (opts) => sent.push(opts), verify: async () => true }
    );
    await mailer.sendContactMail({
      name: 'Evil\r\nBcc: victim@example.com',
      email: 'evil@example.com\r\nX-Injected: 1',
      message: 'hi'
    });
    expect(sent[0].subject).not.toMatch(/[\r\n]/);
    expect(sent[0].replyTo).not.toMatch(/[\r\n]/);
  });
});

describe('/api/scores', () => {
  it('lists top scores with clamped limit', async () => {
    const { app, db } = buildApp();
    const res = await request(app).get('/api/scores?limit=9999');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ player: 'neo', score: 100 }]);
    const call = db.calls.find((c) => /SELECT player/.test(c.sql));
    expect(call.params[0]).toBe(50);
  });

  it('rejects XSS-shaped and over-long player names', async () => {
    const { app } = buildApp();
    for (const player of ['<img src=x onerror=alert(1)>', 'a'.repeat(17), '', 'has space', 'semi;colon']) {
      const res = await request(app).post('/api/scores').send({ player, score: 10 });
      expect(res.status, player).toBe(400);
    }
  });

  it('rejects non-integer or out-of-range scores', async () => {
    const { app } = buildApp();
    for (const score of [-1, 1e9, 3.14, 'abc', null]) {
      const res = await request(app).post('/api/scores').send({ player: 'neo', score });
      expect(res.status, String(score)).toBe(400);
    }
  });

  it('accepts a valid score', async () => {
    const { app, db } = buildApp();
    const res = await request(app).post('/api/scores').send({ player: 'neo_1', score: 1234 });
    expect(res.status).toBe(201);
    const call = db.calls.find((c) => /INSERT INTO scores/.test(c.sql));
    expect(call.params).toEqual(['neo_1', 1234]);
  });
});

describe('site data', () => {
  it('GET /api/stats returns visits and last commit', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ visits: 42, lastCommit: '01/06/2026' });
  });

  it('GET /api/zen returns the quote', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/zen');
    expect(res.body).toEqual({ quote: 'Keep it logically awesome.' });
  });

  it('GET /api/data degrades gracefully when one source fails', async () => {
    const { app } = buildApp({
      github: {
        zen: async () => { throw new Error('down'); },
        lastCommit: async () => null,
        repos: async () => []
      }
    });
    const res = await request(app).get('/api/data');
    expect(res.status).toBe(200);
    expect(res.body.stats).not.toBeNull();
    expect(res.body.zen).toBeNull();
  });

  it('GET /api/projects returns mapped repos', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Portfolio');
  });
});

// Admin auth moved to DB-backed sessions — covered in panel.test.js.

describe('unknown API routes', () => {
  it('returns JSON 404', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
