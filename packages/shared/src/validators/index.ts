import { z } from 'zod';

// ─────────────────────────────────────────────
// Auth Validators
// ─────────────────────────────────────────────

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────────
// Submission Validators
// ─────────────────────────────────────────────

export const submitCodeSchema = z.object({
  matchId: z.string().cuid().optional(),
  problemId: z.string().cuid(),
  code: z.string().min(1, 'Code cannot be empty').max(65536, 'Code exceeds 64KB limit'),
  language: z.enum(['cpp', 'python', 'javascript', 'java', 'go']),
  idempotencyKey: z.string().uuid(),
});

export type SubmitCodeInput = z.infer<typeof submitCodeSchema>;

// ─────────────────────────────────────────────
// Match Validators
// ─────────────────────────────────────────────

export const joinQueueSchema = z.object({
  mode: z.enum(['BLITZ_1V1', 'CODE_GOLF', 'BATTLE_ROYALE', 'SABOTAGE']),
});

export type JoinQueueInput = z.infer<typeof joinQueueSchema>;

// ─────────────────────────────────────────────
// Problem Validators (Admin)
// ─────────────────────────────────────────────

export const createProblemSchema = z.object({
  title: z.string().min(3).max(256),
  slug: z
    .string()
    .min(3)
    .max(128)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().min(10),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXTREME']),
  category: z.enum(['ALGORITHMS', 'DEBUGGING', 'OPTIMIZATION', 'SPEED']),
  tags: z.array(z.string().max(32)).max(10),
  timeLimit: z.number().int().min(500).max(30000).default(2000),
  memoryLimit: z.number().int().min(32).max(1024).default(256),
  isCodeGolf: z.boolean().default(false),
  sabotageCode: z.string().optional(),
  sabotageLanguage: z.enum(['cpp', 'python', 'javascript', 'java', 'go']).optional(),
  testCases: z.array(
    z.object({
      input: z.string(),
      expectedOutput: z.string(),
      isHidden: z.boolean().default(true),
      isSample: z.boolean().default(false),
    }),
  ).min(1, 'At least one test case is required'),
});

export type CreateProblemInput = z.infer<typeof createProblemSchema>;

// ─────────────────────────────────────────────
// Clan Validators
// ─────────────────────────────────────────────

export const createClanSchema = z.object({
  name: z.string().min(3).max(64),
  tag: z
    .string()
    .min(2)
    .max(6)
    .regex(/^[A-Z0-9]+$/, 'Tag must be uppercase alphanumeric'),
  description: z.string().max(500).optional(),
});

export type CreateClanInput = z.infer<typeof createClanSchema>;

// ─────────────────────────────────────────────
// Sabotage Validators
// ─────────────────────────────────────────────

export const submitSabotageSchema = z.object({
  matchId: z.string().cuid(),
  code: z.string().min(1).max(65536),
});

export type SubmitSabotageInput = z.infer<typeof submitSabotageSchema>;

// ─────────────────────────────────────────────
// Chat Validators
// ─────────────────────────────────────────────

export const chatMessageSchema = z.object({
  matchId: z.string().cuid(),
  text: z.string().min(1).max(500).trim(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// ─────────────────────────────────────────────
// User Profile Validators
// ─────────────────────────────────────────────

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  avatarUrl: z.string().url().optional(),
  class: z.enum(['NONE', 'ARCHITECT', 'BUG_HUNTER', 'SPEEDRUNNER', 'OPTIMIZER', 'SABOTEUR']).optional(),
  country: z.string().length(2).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
