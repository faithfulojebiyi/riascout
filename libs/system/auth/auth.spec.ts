import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ADVISOR_WORKFLOW_ATTRIBUTES } from '@feature/entities/data/system-attributes.js';

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

  let orgId: string;
  let authedHeaders: Headers;

  beforeAll(async () => {
    db = new Client({ connectionString: process.env.APP_DATABASE_URL });
    await db.connect();
    await db.query('delete from app."user" where email = $1', [email]);

    await auth.api.signUpEmail({
      body: { email, password, name: 'Auth Spec' },
      asResponse: true,
    });

    const signIn = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });

    authedHeaders = new Headers({
      cookie: signIn.headers.get('set-cookie') as string,
    });

    const org = await auth.api.createOrganization({
      body: { name: 'Acme Recruiting', slug: `acme-${Date.now()}` },
      headers: authedHeaders,
    });

    orgId = org?.id as string;

    await auth.api.setActiveOrganization({
      body: { organizationId: orgId },
      headers: authedHeaders,
    });
  });

  afterAll(async () => {
    await db.query('delete from app."user" where email = $1', [email]);
    await db.end();
    await authPrisma.$disconnect();
  });

  it('creates a user and issues a session', async () => {
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
      const session = await auth.api.getSession({ headers: authedHeaders });

      expect(orgId).toBeTruthy();
      expect(session?.session.activeOrganizationId).toBe(orgId);
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

  describe('workspace provisioning', () => {
    it('seeds the advisor and firm entities on organization create', async () => {
      const { rows } = await db.query<{ slug: string; source_kind: string }>(
        `select e.slug, e.source_kind from app.entity e
           join app.member m on m.organization_id = e.workspace_id
           join app."user" u on u.id = m.user_id
          where u.email = $1 order by e.slug`,
        [email],
      );

      expect(rows.map((r) => r.slug)).toEqual(['advisor', 'firm']);
      expect(rows.map((r) => r.source_kind)).toEqual(['advisor', 'firm']);
    });

    it('seeds every reference attribute as non-editable', async () => {
      const { rows } = await db.query<{ n: string }>(
        `select count(*)::text as n from app.entity_attribute a
           join app.entity e on e.id = a.entity_id
           join app.member m on m.organization_id = e.workspace_id
           join app."user" u on u.id = m.user_id
          where u.email = $1 and a.reference_column is not null and a.is_editable`,
        [email],
      );

      expect(Number(rows[0]?.n)).toBe(0);
    });

    it('seeds the recruiter workflow columns as editable', async () => {
      const { rows } = await db.query<{ label: string }>(
        `select a.label from app.entity_attribute a
           join app.entity e on e.id = a.entity_id
           join app.member m on m.organization_id = e.workspace_id
           join app."user" u on u.id = m.user_id
          where u.email = $1 and a.reference_column is null and a.is_editable
          order by a.label`,
        [email],
      );

      expect(rows.map((r) => r.label)).toContain('Notes');
      expect(rows.map((r) => r.label)).toContain('LinkedIn');
      expect(rows.map((r) => r.label)).toContain('Personal Email');
    });

    it('writes the stable uuid7 key, not a generated one', async () => {
      const { rows } = await db.query<{ key: string }>(
        `select a.key from app.entity_attribute a
           join app.entity e on e.id = a.entity_id
           join app.member m on m.organization_id = e.workspace_id
           join app."user" u on u.id = m.user_id
          where u.email = $1 and a.label = 'Notes'`,
        [email],
      );

      // the constant is the workspace's permanent handle on this attribute
      expect(rows[0]?.key).toBe(ADVISOR_WORKFLOW_ATTRIBUTES.notes);
    });
  });
});
