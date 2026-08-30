import { useState, type ComponentProps } from 'react';
import { VStack } from '@riascout-ui/styled-system/jsx';

import { authClient } from '../../../lib/auth-client';
import { Button } from '../../../ui/primitives/button';
import { Input } from '../../../ui/primitives/input';
import { Heading, Span, Text } from '../../../ui/primitives/text';

export type OtpStepProps = {
  email: string;
  onBack: () => void;
  onVerified: () => void;
};

/**
 * The code is logged rather than emailed until a mail provider is wired, so the
 * copy says where to find it. Telling someone to check an inbox that will never
 * receive anything is worse than saying nothing.
 */
export const OtpStep = ({ email, onBack, onVerified }: OtpStepProps) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit: ComponentProps<'form'>['onSubmit'] = async (event) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: verifyError } = await authClient.signIn.emailOtp({
      email,
      otp: code,
    });

    setPending(false);

    if (verifyError) {
      setError(verifyError.message ?? 'That code did not work');

      return;
    }

    onVerified();
  };

  return (
    <form onSubmit={onSubmit}>
      <VStack alignItems="stretch" gap="3">
        <Heading as="h2" fontSize="6" fontWeight="600" textAlign="center">
          Check your inbox
        </Heading>
        <Text color="text.muted" fontSize="2" textAlign="center">
          We sent a six digit code to {email}.
        </Text>

        <Input disabled readOnly size="sm" value={email} />
        <Input
          size="sm"
          autoComplete="one-time-code"
          autoFocus
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter the code"
          required
          value={code}
        />

        <Button disabled={pending || code.length < 6} size="sm" type="submit">
          {pending ? 'Verifying…' : 'Continue'}
        </Button>

        {error ? (
          <Text color="brand.error.11" fontSize="2" role="alert">
            {error}
          </Text>
        ) : null}

        <Button onClick={onBack} size="sm" type="button" variant="ghost">
          Use a different email
        </Button>

        <Span color="text.placeholder" fontSize="1" textAlign="center">
          No mail provider is configured yet — the code is written to the api
          log.
        </Span>
      </VStack>
    </form>
  );
};
