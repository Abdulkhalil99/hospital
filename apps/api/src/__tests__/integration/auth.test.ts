import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request   from 'supertest';
import { createApp } from '@/app';
import { cleanDatabase, seedTestUser } from '../setup';

const app = createApp();

describe('Auth API — /api/v1/auth', () => {

  let testUserId: string;

  beforeEach(async () => {
    await cleanDatabase();
    const user = await seedTestUser('super_admin');
    testUserId = user.id;
  });

  describe('POST /login', () => {

    it('returns 200 and tokens for valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'testuser', password: 'Test@123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.username).toBe('testuser');
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for unknown user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'nobody', password: 'Test@123456' });

      expect(res.status).toBe(401);
    });

    it('returns 422 for missing username', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'Test@123456' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for empty password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'testuser', password: '' });

      expect(res.status).toBe(422);
    });

  });

  describe('GET /me', () => {

    it('returns user profile for valid token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'testuser', password: 'Test@123456' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe('testuser');
      expect(res.body.data.roles).toContain('super_admin');
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
    });

  });

  describe('POST /logout', () => {

    it('returns 200 on successful logout', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'testuser', password: 'Test@123456' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

  });

});
