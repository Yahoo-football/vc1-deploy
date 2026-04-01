process.env.JWT_SECRET = 'test-jwt-secret-with-minimum-32-chars';

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../src/models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn()
  },
  RoleRequest: {}
}));

const { User } = require('../src/models');
const authRoutes = require('../src/routes/authRoutes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
};

describe('Auth API', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('registers a user with valid payload', async () => {
      const createdAt = new Date('2026-03-20T10:00:00.000Z');
      User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      User.create.mockResolvedValue({
        id: 1,
        username: 'test_user',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'player',
        phone: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        avatarUrl: null,
        status: 'active',
        emailVerified: false,
        createdAt
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test_user',
          email: 'test@example.com',
          password: 'Password1',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(response.status).toBe(201);
      expect(response.body.token).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({
        id: 1,
        username: 'test_user',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'player'
      });
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'test_user',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'player'
        })
      );
      expect(User.create.mock.calls[0][0].password).not.toBe('Password1');
    });

    it('rejects invalid registration payload before controller logic', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab',
          email: 'invalid-email',
          password: 'short',
          firstName: '',
          lastName: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(User.findOne).not.toHaveBeenCalled();
      expect(User.create).not.toHaveBeenCalled();
    });

    it('rejects duplicate email or username', async () => {
      User.findOne.mockResolvedValueOnce({ id: 99 });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test_user',
          email: 'test@example.com',
          password: 'Password1',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email or username already in use.');
      expect(User.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in an active user with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password1', 12);
      const update = jest.fn().mockResolvedValue(true);
      User.findOne.mockResolvedValue({
        id: 3,
        username: 'player3',
        email: 'player3@example.com',
        password: hashedPassword,
        firstName: 'Player',
        lastName: 'Three',
        role: 'player',
        phone: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        avatarUrl: null,
        status: 'active',
        emailVerified: true,
        lastLogin: null,
        createdAt: new Date('2026-03-18T10:00:00.000Z'),
        update
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'player3@example.com',
          password: 'Password1'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({
        id: 3,
        username: 'player3',
        email: 'player3@example.com',
        role: 'player',
        status: 'active'
      });
      expect(update).toHaveBeenCalledWith({ lastLogin: expect.any(Date) });
    });

    it('rejects a wrong password', async () => {
      const hashedPassword = await bcrypt.hash('Password1', 12);
      User.findOne.mockResolvedValue({
        id: 3,
        email: 'player3@example.com',
        password: hashedPassword,
        status: 'active'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'player3@example.com',
          password: 'WrongPass1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email or password.');
    });

    it('rejects an inactive account', async () => {
      const hashedPassword = await bcrypt.hash('Password1', 12);
      User.findOne.mockResolvedValue({
        id: 4,
        email: 'inactive@example.com',
        password: hashedPassword,
        status: 'suspended'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'Password1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Account is not active. Please contact support.');
    });

    it('rejects invalid login payload before controller logic', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(User.findOne).not.toHaveBeenCalled();
    });
  });
});
