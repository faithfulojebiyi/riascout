import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auth, authPrisma } from './auth.js';

/**
 * Exercises better-auth's real API against the real tables. The provable end
 * state from docs/plans/06: sign up → session → workspace → identity available
 * to a handler.
 */
describe('auth', () => {
  let db: Client;

  const email = 'auth-spec@example.test';
  const password = 'correct-horse-battery-staple';

  beforeAll(async () => {
    db = new Client({ connectionString: process.env.APP_DATABASE_URL });
    await db.connect();
    await db.query('delete from app."user" where email = $1', [email]);
  });

  afterAll(async () => {
    await db.query('delete from app."user" where email = $1', [email]);
    await db.end();
    await authPrisma.$disconnect();
  });

  const signUp = () =>
    auth.api.signUpEmail({
      body: { email, password, name: 'Auth Spec' },
      asResponse: true,
    });

  it('creates a user and issues a session', async () => {
    const response = await signUp();

    expect(response.status).toBe(200);

    const { rows } = await db.query<{ id: string }>(
      'select id from app."user" where email = $1',
      [email],
    );

    expect(rows).toHaveLength(1);
  });

  it('stores the password hashed, never in plain text', async () => {
    const { rows } = await db.query<{ password: string | null }>(
      `select a.password from app.account a
         join app."user" u on u.id = a.user_id
        where u.email = $1`,
      [email],
    );

    expect(rows[0]?.password).toBeTruthy();
    expect(rows[0]?.password).not.toContain(password);
  });

  it('rejects a wrong password', async () => {
    const response = await auth.api.signInEmail({
      body: { email, password: 'wrong-password' },
      asResponse: true,
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('returns a session for a valid cookie and none without one', async () => {
    const signIn = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    const cookie = signIn.headers.get('set-cookie');

    expect(cookie).toBeTruthy();

    const withCookie = await auth.api.getSession({
      headers: new Headers({ cookie: cookie as string }),
    });

    expect(withCookie?.user.email).toBe(email);
    await expect(
      auth.api.getSession({ headers: new Headers() }),
    ).resolves.toBeNull();
  });

  describe('workspace = organization', () => {
    it('sets activeOrganizationId on the session when a workspace is created', async () => {
      const signIn = await auth.api.signInEmail({
        body: { email, password },
        asResponse: true,
      });
      const cookie = signIn.headers.get('set-cookie') as string;
      const headers = new Headers({ cookie });

      const org = await auth.api.createOrganization({
        body: { name: 'Acme Recruiting', slug: `acme-${Date.now()}` },
        headers,
      });

      expect(org?.id).toBeTruthy();

      await auth.api.setActiveOrganization({
        body: { organizationId: org?.id as string },
        headers,
      });

      const session = await auth.api.getSession({ headers });

      expect(session?.session.activeOrganizationId).toBe(org?.id);
    });

    it('makes the creator a member of the organization', async () => {
      const { rows } = await db.query<{ role: string }>(
        `select m.role from app.member m
           join app."user" u on u.id = m.user_id
          where u.email = $1`,
        [email],
      );

      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]?.role).toBe('owner');
    });

    it('stores the workspace id that app tables will reference', async () => {
      const { rows } = await db.query<{ id: string; slug: string }>(
        `select o.id, o.slug from app.organization o
           join app.member m on m.organization_id = o.id
           join app."user" u on u.id = m.user_id
          where u.email = $1`,
        [email],
      );

      expect(rows[0]?.id).toMatch(/\S/);
    });
  });
});
