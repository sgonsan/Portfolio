import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { buildStatefulApp, loginAgent } from './helpers';

// This test writes through to the real asset files (the route's output path is
// fixed), so it snapshots them first and restores them afterwards.
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/assets');
const DEST = path.join(ASSETS, 'personal-foto.jpg');
const LOW = path.join(ASSETS, 'personal-foto-low-res.jpg');

const snapshot = async (p) => { try { return await fs.readFile(p); } catch { return null; } };
const restore = async (p, buf) => { if (buf) await fs.writeFile(p, buf); };

describe('photo upload re-encoding (writes real assets, restored after)', () => {
  let origDest = null;
  let origLow = null;

  beforeAll(async () => {
    origDest = await snapshot(DEST);
    origLow = await snapshot(LOW);
  });

  afterAll(async () => {
    await restore(DEST, origDest);
    await restore(LOW, origLow);
  });

  it('strips EXIF, re-encodes to JPEG and produces a genuinely smaller low-res', async () => {
    // Fixture: an oversized JPEG carrying EXIF that must not survive.
    const input = await sharp({
      create: { width: 1200, height: 1200, channels: 3, background: { r: 10, g: 20, b: 30 } }
    }).jpeg().withExif({ IFD0: { Copyright: 'SECRET-EXIF-MARKER' } }).toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined(); // fixture really has EXIF

    const { app } = await buildStatefulApp();
    const { cookie } = await loginAgent(app);
    const res = await request(app)
      .post('/api/admin/photo')
      .set('Cookie', cookie)
      .set('Content-Type', 'image/jpeg')
      .send(input);
    expect(res.status).toBe(200);

    const full = await fs.readFile(DEST);
    const low = await fs.readFile(LOW);
    const fullMeta = await sharp(full).metadata();
    const lowMeta = await sharp(low).metadata();

    expect(fullMeta.format).toBe('jpeg');
    expect(fullMeta.exif).toBeUndefined();        // EXIF stripped
    expect(lowMeta.exif).toBeUndefined();
    expect(fullMeta.width).toBeLessThanOrEqual(800);
    expect(lowMeta.width).toBeLessThanOrEqual(400);
    expect(low.length).toBeLessThan(full.length); // low-res is actually smaller
  });
});
