import { css } from '@riascout-ui/styled-system/css';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type ComponentProps } from 'react';

import { authClient } from '../lib/auth-client';
import { Button } from '../ui/primitives/button';

type Search = { redirect?: string };

export const Route = createFileRoute('/sign-in')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: SignIn,
});

const inputStyles = css({
  bg: 'brand.primary.1',
  borderColor: 'brand.primary.6',
  borderRadius: 'lg',
  borderWidth: '1px',
  color: 'brand.primary.12',
  fontSize: 'sm',
  h: '2.25rem',
  px: '3',
  _focusVisible: { borderColor: 'brand.primary.8', outline: 'none' },
  _placeholder: { color: 'brand.primary.11' },
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
    <div
      className={css({
        alignItems: 'center',
        bg: 'brand.primary.2',
        display: 'flex',
        justifyContent: 'center',
        minH: '100dvh',
      })}
    >
      <form
        onSubmit={onSubmit}
        className={css({
          bg: 'brand.primary.1',
          borderColor: 'brand.primary.5',
          borderRadius: 'xl',
          borderWidth: '1px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
          p: '8',
          w: '22rem',
        })}
      >
        <h1 className={css({ color: 'brand.primary.12', fontSize: 'xl', fontWeight: '600' })}>
          Sign in
        </h1>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          required
          className={inputStyles}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className={inputStyles}
        />

        <Button type="submit" size="md" disabled={pending}>
          {pending ? 'Signing in…' : 'Continue'}
        </Button>

        {error ? (
          <p role="alert" className={css({ color: 'brand.error.11', fontSize: 'sm' })}>
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
