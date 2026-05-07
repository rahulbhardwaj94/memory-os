import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

const prisma = new PrismaClient();

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  // bearer plugin: lets session tokens work as Authorization: Bearer headers
  // (used by API clients that can't use cookies)
  plugins: [bearer()],

  trustedOrigins: env.CORS_ORIGIN.split(',').map(o => o.trim()),
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
