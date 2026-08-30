import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type ComponentProps } from 'react';
import { VStack } from '@riascout-ui/styled-system/jsx';

import { authClient } from '../lib/auth-client';
import { AuthShell, WelcomeAside } from '../modules/auth/components/auth-shell';
import { OtpStep } from '../modules/auth/components/otp-step';
import { Button } from '../ui/primitives/button';
import { Input } from '../ui/primitives/input';
import { Separator } from '../ui/primitives/separator';
import { Span, Text } from '../ui/primitives/text';

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
  /** password is the default; a code is the alternative for anyone without one */
  const [method, setMethod] = useState<'password' | 'otp'>('password');
  const [awaitingCode, setAwaitingCode] = useState(false);

  const sendCode = async () => {
    setPending(true);
    setError(null);

    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
    });

    setPending(false);

    if (sendError) {
      setError(sendError.message ?? 'Could not send a code');

      return;
    }

    setAwaitingCode(true);
  };

  /** derived from the element so it tracks react's types rather than the deprecated FormEvent */
  const onSubmit: ComponentProps<'form'>['onSubmit'] = async (event) => {
    event.preventDefault();

    if (method === 'otp') {
      await sendCode();

      return;
    }

    setPending(true);
    setError(null);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    setPending(false);

    if (signInError) {
      setError(signInError.message ?? 'Could not sign in');

      return;
    }

    await navigate({ to: redirect ?? '/' });
  };

  if (awaitingCode) {
    return (
      <AuthShell aside={<WelcomeAside />}>
        <OtpStep
          email={email}
          onBack={() => setAwaitingCode(false)}
          onVerified={() => void navigate({ to: redirect ?? '/' })}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell aside={<WelcomeAside />}>
      <form onSubmit={onSubmit}>
        <VStack alignItems="stretch" gap="3">
          {/**
           * A single provider button would sit here above the divider. Nothing
           * but email is configured, so showing an inert one would be a lie.
           */}
          <Input
            size="sm"
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your work email address"
            required
            type="email"
            value={email}
          />
          {method === 'password' ? (
            <Input
              size="sm"
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              type="password"
              value={password}
            />
          ) : null}

          <Button disabled={pending || email === ''} size="sm" type="submit">
            {pending
              ? 'Working…'
              : method === 'password'
                ? 'Sign in'
                : 'Email me a code'}
          </Button>

          <Button
            onClick={() => {
              setMethod(method === 'password' ? 'otp' : 'password');
              setError(null);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {method === 'password'
              ? 'Sign in with a code instead'
              : 'Use a password instead'}
          </Button>

          {error ? (
            <Text color="brand.error.11" fontSize="2" role="alert">
              {error}
            </Text>
          ) : null}

          <Separator my="2" />

          <Span color="text.placeholder" fontSize="1">
            By continuing you agree that RIAScout may contact you about the
            product. Coverage is SEC-registered and exempt reporting advisers.
          </Span>
        </VStack>
      </form>
    </AuthShell>
  );
}
