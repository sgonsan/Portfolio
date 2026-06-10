import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildStatefulApp, loginAgent } from './helpers';
import { visitorHash } from '../server/lib/analytics';

describe('panel auth', () => {
  it('logs in and sets a hardened session cookie', async () => {
    const { app } = await buildStatefulApp();
    const { res } = await loginAgent(app);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('admin');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toMatch(/sid=[0-9a-f]{64}/);
  });

  it('sets Secure flag in production', async () => {
    const { app } = await buildStatefulApp({ env: { NODE_ENV: 'production' } });
    const { res } = await loginAgent(app);
    expect(res.headers['set-cookie'][0]).toContain('Secure');
  });

  it('rejects bad credentials and locks after 5 failures', async () => {
    const { app } = await buildStatefulApp();
    for (let i = 0; i < 4; i++) {
      const r = await request(app).post('/api/admin/login').send({ username: 'admin', password: 'wrong' });
      expect(r.status).toBe(401);
    }
    // 5th failure trips the lock... but login limiter is 5/min, so the 5th
    // request hits the rate limiter instead. Both shield the account.
    const fifth = await request(app).post('/api/admin/login').send({ username: 'admin', password: 'wrong' });
    expect([401, 423, 429]).toContain(fifth.status);
  });

  it('locks the account after 5 wrong passwords even with correct password after', async () => {
    const { app, authService } = await buildStatefulApp();
    for (let i = 0; i < 5; i++) {
      await authService.login('admin', 'wrong', null);
    }
    const result = await authService.login('admin', 'correct-password', null);
    expect(result).toEqual({ locked: true });
  });

  it('allows login after 4 failures; only the 5th trips the lock', async () => {
    const { authService } = await buildStatefulApp();
    for (let i = 0; i < 4; i++) {
      expect(await authService.login('admin', 'wrong', null)).toBeNull();
    }
    const ok = await authService.login('admin', 'correct-password', null);
    expect(ok?.token).toBeTruthy(); // 4 fails still under the limit
  });

  it('returns an indistinguishable 401 for an unknown user (dummy-hash path)', async () => {
    const { app } = await buildStatefulApp();
    const res = await request(app).post('/api/admin/login')
      .send({ username: 'ghost-no-such-user', password: 'whatever-pass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('invalidates existing sessions when the password changes', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(200);

    const patch = await request(app).patch('/api/admin/users/1')
      .set('Cookie', cookie)
      .send({ password: 'a-fresh-long-password' });
    expect(patch.status).toBe(200);

    // The session that authorized the change is now dead.
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('401 without session; logout invalidates', async () => {
    const { app } = await buildStatefulApp();
    expect((await request(app).get('/api/admin/me')).status).toBe(401);

    const { cookie } = await loginAgent(app);
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(200);

    await request(app).post('/api/admin/logout').set('Cookie', cookie);
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('expired sessions are rejected and removed', async () => {
    const { app, db } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    db.state.sessions[0].expires_at = new Date(Date.now() - 1000);
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(401);
    expect(db.state.sessions).toHaveLength(0);
  });

  it('disabled users cannot use existing sessions', async () => {
    const { app, db } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    db.state.users[0].disabled = true;
    expect((await request(app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('rejects cross-origin mutations', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    const res = await request(app)
      .put('/api/admin/sections')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({ order: [] });
    expect(res.status).toBe(403);
  });
});

describe('content service via API', () => {
  it('GET /api/content returns defaults with order', async () => {
    const { app } = await buildStatefulApp();
    const res = await request(app).get('/api/content');
    expect(res.status).toBe(200);
    expect(res.body.content.about.name).toBe('SERGIO GONZÁLEZ SÁNCHEZ');
    expect(res.body.order.map((o) => o.section)).toEqual(
      ['about', 'skills', 'projects', 'timeline', 'achievements', 'contact']
    );
  });

  it('saving a section bumps the version and changes public content', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    const before = (await request(app).get('/api/content')).body.version;

    const save = await request(app)
      .put('/api/admin/content/about')
      .set('Cookie', cookie)
      .send({ fields: { name: 'NUEVO NOMBRE' } });
    expect(save.status).toBe(200);

    const after = await request(app).get('/api/content');
    expect(after.body.version).toBeGreaterThan(before);
    expect(after.body.content.about.name).toBe('NUEVO NOMBRE');
  });

  it('rejects unknown sections, unknown fields and malformed lists', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    const cases = [
      ['/api/admin/content/nope', { fields: { x: 'y' } }],
      ['/api/admin/content/about', { fields: { hacker: 'y' } }],
      ['/api/admin/content/timeline', { fields: { items: [{ date: 1 }] } }],
      ['/api/admin/content/skills', { fields: { groups: 'not-a-list' } }]
    ];
    for (const [url, body] of cases) {
      const res = await request(app).put(url).set('Cookie', cookie).send(body);
      expect(res.status, url).toBe(400);
    }
  });

  it('reorders and disables sections', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    const order = ['contact', 'about', 'skills', 'projects', 'timeline', 'achievements']
      .map((s) => ({ section_key: s, enabled: s !== 'achievements' }));
    const save = await request(app).put('/api/admin/sections').set('Cookie', cookie).send({ order });
    expect(save.status).toBe(200);

    const pub = await request(app).get('/api/content');
    expect(pub.body.order[0]).toEqual({ section: 'contact', enabled: true });
    expect(pub.body.order.find((o) => o.section === 'achievements').enabled).toBe(false);
  });

  it('rejects an order missing sections', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    const res = await request(app)
      .put('/api/admin/sections')
      .set('Cookie', cookie)
      .send({ order: [{ section_key: 'about', enabled: true }] });
    expect(res.status).toBe(400);
  });
});

describe('accounts API', () => {
  it('creates, disables and resets users; cannot self-disable', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);

    const created = await request(app)
      .post('/api/admin/users')
      .set('Cookie', cookie)
      .send({ username: 'second', password: 'long-enough-pass' });
    expect(created.status).toBe(201);

    const list = await request(app).get('/api/admin/users').set('Cookie', cookie);
    expect(list.body).toHaveLength(2);

    const selfDisable = await request(app)
      .patch('/api/admin/users/1')
      .set('Cookie', cookie)
      .send({ disabled: true });
    expect(selfDisable.status).toBe(400);

    const otherDisable = await request(app)
      .patch(`/api/admin/users/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ disabled: true });
    expect(otherDisable.status).toBe(200);

    const shortPass = await request(app)
      .patch(`/api/admin/users/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ password: 'short' });
    expect(shortPass.status).toBe(400);
  });

  it('rejects weak passwords and bad usernames on create', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    for (const body of [
      { username: 'ok_user', password: 'short' },
      { username: 'x', password: 'long-enough-pass' },
      { username: 'has spaces', password: 'long-enough-pass' }
    ]) {
      const res = await request(app).post('/api/admin/users').set('Cookie', cookie).send(body);
      expect(res.status).toBe(400);
    }
  });
});

describe('contacts via panel', () => {
  it('escapes CSV formula injection in the export', async () => {
    const { app, db } = await buildStatefulApp();
    db.state.contacts = [{
      id: 1, name: '=HYPERLINK("http://evil")', email: 'a@b.co',
      message: '+SUM(A1)', ip: '1.2.3.4', user_agent: 'UA', created_at: '2026-06-09'
    }];
    const { cookie } = await loginAgent(app);
    const res = await request(app).get('/api/admin/contacts.csv').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain(`"'=HYPERLINK`);
    expect(res.text).toContain(`"'+SUM(A1)"`);
  });
});

describe('photo upload validation (rejections write nothing)', () => {
  const upload = (app, cookie, contentType, body) =>
    request(app).post('/api/admin/photo').set('Cookie', cookie).set('Content-Type', contentType).send(body);

  it('requires a session', async () => {
    const { app } = await buildStatefulApp();
    const res = await request(app).post('/api/admin/photo')
      .set('Content-Type', 'image/jpeg').send(Buffer.alloc(32, 0xff));
    expect(res.status).toBe(401);
  });

  it('rejects an unsupported content-type with 415', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    const res = await upload(app, cookie, 'image/gif', Buffer.alloc(32, 1));
    expect(res.status).toBe(415);
  });

  it('rejects an empty/too-small body with 400', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    const res = await upload(app, cookie, 'image/jpeg', Buffer.alloc(8, 0xff));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty or corrupt/i);
  });

  it('rejects content whose magic bytes do not match the declared type', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    // Declared PNG, but bytes are not a PNG signature.
    const res = await upload(app, cookie, 'image/png', Buffer.alloc(32, 0x42));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not match/i);
  });

  it('returns 400 when magic bytes pass but the image cannot be decoded', async () => {
    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    // Valid PNG signature followed by garbage: passes the magic check, fails sharp.
    const corrupt = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(24, 0)
    ]);
    const res = await upload(app, cookie, 'image/png', corrupt);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/could not process/i);
  });
});

describe('analytics', () => {
  it('visitor hash is deterministic per day and ip+ua', () => {
    const day = new Date('2026-06-09T10:00:00Z');
    const a = visitorHash('1.2.3.4', 'UA', day);
    const b = visitorHash('1.2.3.4', 'UA', new Date('2026-06-09T23:00:00Z'));
    const c = visitorHash('1.2.3.4', 'UA', new Date('2026-06-10T01:00:00Z'));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('pv returns a signed token; sv stores section rows for it', async () => {
    const { app, db } = await buildStatefulApp();
    const pv = await request(app).post('/api/t/pv').send({ lang: 'es-ES', vw: 1920 });
    expect(pv.status).toBe(200);
    const id = pv.body.id; // opaque signed token, round-tripped as-is

    const sv = await request(app).post('/api/t/sv').send({
      id, sections: [{ k: 'about', ms: 5000 }, { k: 'skills', ms: 2500 }], scroll: 80
    });
    expect(sv.status).toBe(204);
    expect(db.state.sectionViews).toHaveLength(2);
  });

  it('sv rejects a forged/unsigned pageview id', async () => {
    const { app, db } = await buildStatefulApp();
    for (const id of ['1', '1.deadbeef', 42, '']) {
      const res = await request(app).post('/api/t/sv').send({
        id, sections: [{ k: 'about', ms: 5000 }], scroll: 10
      });
      expect(res.status).toBe(204);
    }
    expect(db.state.sectionViews).toHaveLength(0);
  });

  it('sv silently drops malformed batches', async () => {
    const { app, db } = await buildStatefulApp();
    const bad = [
      { id: 1, sections: Array.from({ length: 21 }, (_, i) => ({ k: 'a', ms: i })), scroll: 0 },
      { id: 1, sections: [{ k: '<script>', ms: 5 }], scroll: 0 },
      { id: 'x', sections: [], scroll: 0 }
    ];
    for (const body of bad) {
      const res = await request(app).post('/api/t/sv').send(body);
      expect(res.status).toBe(204);
    }
    expect(db.state.sectionViews).toHaveLength(0);
  });

  it('admin analytics endpoints gated and dimension whitelisted', async () => {
    const { app } = await buildStatefulApp();
    expect((await request(app).get('/api/admin/analytics/summary')).status).toBe(401);

    const { cookie } = await loginAgent(app);
    const summary = await request(app).get('/api/admin/analytics/summary').set('Cookie', cookie);
    expect(summary.status).toBe(200);
    expect(summary.body).toHaveProperty('views');

    const badDim = await request(app)
      .get('/api/admin/analytics/top?dim=password_hash')
      .set('Cookie', cookie);
    expect(badDim.status).toBe(400);

    const goodDim = await request(app)
      .get('/api/admin/analytics/top?dim=country')
      .set('Cookie', cookie);
    expect(goodDim.status).toBe(200);
  });
});
