import { Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, organization } from 'better-auth/plugins';

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

/** the code goes to the log until a mail provider exists; see sendVerificationOTP */
const otpLogger = new Logger('AuthOtp');

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
      // a code is guessable by brute force in a way a password is not
      '/email-otp/send-verification-otp': { window: 300, max: 3 },
      '/sign-in/email-otp': { window: 300, max: 5 },
    },
  },
  advanced: { useSecureCookies: process.env.NODE_ENV !== 'development' },
  databaseHooks: {
    /**
     * A workspace on sign-up. Every route is workspace-scoped, so a user
     * without one gets 403 from everything — there is no useful state between
     * "account exists" and "workspace exists". provisionWorkspace runs from
     * afterCreateOrganization, so entities and attributes come with it.
     */
    user: {
      create: {
        after: async (user) => {
          const slug = `${user.email.split('@')[0] ?? 'workspace'}-${user.id
            .slice(0, 6)
            .toLowerCase()}`.replace(/[^a-z0-9-]/gi, '-');

          const organization = await authPrisma.organization.create({
            data: {
              id: crypto.randomUUID(),
              name: user.name || (user.email.split('@')[0] ?? 'My workspace'),
              slug,
            },
            select: { id: true },
          });

          await authPrisma.member.create({
            data: {
              id: crypto.randomUUID(),
              organizationId: organization.id,
              userId: user.id,
              role: 'owner',
            },
          });

          await provisionWorkspace(authPrisma as never, organization.id);
        },
      },
    },
    /**
     * Only the organization plugin's setActive sets this, which sign-in does
     * not call — so it is resolved here for every method rather than one flow.
     */
    session: {
      create: {
        before: async (session) => {
          const membership = await authPrisma.member.findFirst({
            where: { userId: session.userId },
            select: { organizationId: true },
            orderBy: { createdAt: 'asc' },
          });

          return membership
            ? {
                data: {
                  ...session,
                  activeOrganizationId: membership.organizationId,
                },
              }
            : undefined;
        },
      },
    },
  },
  plugins: [
    /**
     * The code is logged rather than sent: there is no mail provider yet, and
     * a silent failure would look like a working flow that never delivers.
     * Swap the body for the provider when libs/providers/resend lands — nothing
     * else about the flow changes.
     */
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(
            'No mail provider configured; refusing to issue an OTP that cannot be delivered',
          );
        }

        otpLogger.log(`${type} code for ${email}: ${otp}`);
      },
    }),
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
