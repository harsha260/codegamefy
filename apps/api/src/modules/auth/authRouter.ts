import { Router, Request, Response } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { registerSchema, loginSchema } from '@codearena/shared';
import type { AuthPayload } from '../../middleware/auth';

const router = Router();

/**
 * Generate JWT access and refresh tokens for a user.
 */
function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign({ userId: payload.userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });

  return { accessToken, refreshToken };
}

/**
 * POST /auth/register
 * Create a new user account with email/password.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { username, email, password } = parsed.data;

    // Check for existing user
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      const field = existing.email === email ? 'email' : 'username';
      res.status(409).json({ error: `A user with this ${field} already exists` });
      return;
    }

    // Hash password
    const passwordHash = await argon2.hash(password);

    // Create user + initial ELO rating in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username,
          email,
          passwordHash,
        },
      });

      await tx.eloRating.create({
        data: { userId: newUser.id },
      });

      return newUser;
    });

    const payload: AuthPayload = {
      userId: user.id,
      username: user.username,
      class: user.class,
    };

    const tokens = generateTokens(payload);

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        class: user.class,
      },
      ...tokens,
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/login
 * Authenticate with email/password and receive tokens.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    const payload: AuthPayload = {
      userId: user.id,
      username: user.username,
      class: user.class,
    };

    const tokens = generateTokens(payload);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        class: user.class,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/refresh
 * Exchange a refresh token for new access + refresh tokens.
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const payload: AuthPayload = {
      userId: user.id,
      username: user.username,
      class: user.class,
    };

    const tokens = generateTokens(payload);
    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

export default router;
