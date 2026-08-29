import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type ComponentProps } from 'react';

import { authClient } from '../lib/auth-client';

type Search = { redirect?: string };

export const Route = createFileRoute('/sign-in')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** derived from the element so it tracks react's types instead of the deprecated FormEvent */
  const onSubmit: ComponentProps<'form'>['onSubmit'] = async (event) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: signInError } = await authClient.signIn.email({ email, password });

    setPending(false);

    if (signInError) {
      setError(signInError.message ?? 'Could not sign in');

      return;
    }

    await navigate({ to: redirect ?? '/' });
  };

  return (
    <form onSubmit={onSubmit} style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 320 }}>
      <h1>Sign in</h1>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Work email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Continue'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
