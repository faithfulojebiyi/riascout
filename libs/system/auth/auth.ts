import { PrismaPg } from '@prisma/adapter-pg';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization } from 'better-auth/plugins';

import { provisionWorkspace } from '@feature/entities/data/provision-workspace.js';
import { PrismaClient } from '@orm/app';

/**
 * better-auth gets its own client rather than AppPrismaService: that one carries
 * the read-replica extension and an opaque $extends wrapper it does not need,
 * and auth writes must never be routed to a replica.
 */
const connectionString = process.env.APP_DATABASE_URL;

if (!connectionString) {
  throw new Error('APP_DATABASE_URL is required');
}

export const authPrisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined,
  }),
  errorFormat: 'minimal',
});

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: 'riascout',
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: prismaAdapter(authPrisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  /**
   * Counters are in-memory, so this is per-instance and stops being a real
   * limit the moment the api runs more than one replica. Move to redis before
   * scaling out — see docs/plans/06.
   */
  rateLimit: {
    enabled: process.env.NODE_ENV !== 'development',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
      '/forget-password': { window: 300, max: 3 },
    },
  },
  advanced: { useSecureCookies: process.env.NODE_ENV !== 'development' },
  plugins: [
    organization({
      teams: { enabled: true },
      organizationHooks: {
        /**
         * A workspace with no entities cannot be used, so provisioning runs
         * inline rather than as a job — a recruiter must not land in an empty
         * CRM while a queue catches up. It is idempotent, so a retry is safe.
         */
        afterCreateOrganization: async ({ organization: org }) => {
          await provisionWorkspace(authPrisma as never, org.id);
        },
      },
    }),
  ],
});

export type Auth = typeof auth;
export type AuthSession = Awaited<ReturnType<Auth['api']['getSession']>>;
