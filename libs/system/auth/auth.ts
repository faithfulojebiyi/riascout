import { createHash } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, organization } from 'better-auth/plugins';

import { sendMail } from '@providers/mail/mail.service.js';
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

const otpLogger = new Logger('AuthOtp');

/** the plugin's expiresIn and the template's copy must not drift apart */
const OTP_TTL_SECONDS = 300;

const otpFingerprint = (email: string, otp: string): string =>
  createHash('sha256').update(`${email}:${otp}`).digest('hex').slice(0, 32);

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
   * input: false — the onboarding endpoints own these, so a client cannot mark
   * itself onboarded by posting to better-auth's own update-user route.
   */
  user: {
    additionalFields: {
      onboardedAt: { type: 'date', required: false, input: false },
      marketingOptIn: {
        type: 'boolean',
        required: false,
        input: false,
        defaultValue: false,
      },
    },
  },
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
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_TTL_SECONDS,
      /**
       * Sent inline, not queued: a login code that arrives after the user gives
       * up is worthless, and a queue would hide the failure from the one screen
       * that can report it. Throwing surfaces it at sign-in.
       */
      async sendVerificationOTP({ email, otp }) {
        try {
          await sendMail({
            to: email,
            template: 'sign-in-otp',
            props: { otp, expiresIn: OTP_TTL_SECONDS },
            /**
             * Varies per issued code. Keying on the address alone would make a
             * legitimate resend collide with the previous key under a different
             * payload, which resend answers with a 409. The code is hashed
             * rather than embedded so the key never carries the secret.
             */
            idempotencyKey: `sign-in-otp/${otpFingerprint(email, otp)}`,
          });
        } catch (error) {
          otpLogger.error(
            `failed to send a sign-in code: ${error instanceof Error ? error.message : String(error)}`,
          );

          throw error;
        }
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

/**
 * activeOrganizationId is written once, when the session is created, so a
 * session issued before its membership existed stays null forever and every
 * workspace-scoped route answers 403. Resolving it here and writing it back
 * costs one query once per session rather than one per request.
 *
 * Returns undefined when the user genuinely has no workspace, which keeps the
 * 403 for that case rather than inventing access.
 */
export const resolveActiveWorkspace = async (
  userId: string,
  sessionToken: string,
): Promise<string | undefined> => {
  const membership = await authPrisma.member.findFirst({
    where: { userId },
    select: { organizationId: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!membership) {
    return undefined;
  }

  await authPrisma.session.updateMany({
    where: { token: sessionToken },
    data: { activeOrganizationId: membership.organizationId },
  });

  return membership.organizationId;
};

export type Auth = typeof auth;
export type AuthSession = Awaited<ReturnType<Auth['api']['getSession']>>;
