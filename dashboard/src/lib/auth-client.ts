import {
  emailOTPClient,
  inferAdditionalFields,
  organizationClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * better-auth runs in the nest api, not here, so this is a pure client of
 * /api/auth/* on that origin. The docs' server-function approach assumes auth
 * is in-process; the client SDK is the supported path when it is not.
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env?.VITE_API_URL ?? 'http://localhost:3320',
  plugins: [
    emailOTPClient(),
    organizationClient(),
    /**
     * Declared rather than inferred from the server's Auth type — that lives in
     * the nest build, which this package does not compile against.
     */
    inferAdditionalFields({
      user: {
        onboardedAt: { type: 'date', required: false },
        marketingOptIn: { type: 'boolean', required: false },
      },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
