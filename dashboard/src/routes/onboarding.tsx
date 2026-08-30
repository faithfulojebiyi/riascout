import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { authClient } from '../lib/auth-client';
import { OnboardingWizard } from '../modules/onboarding/components/onboarding-wizard';

/**
 * Outside _authed on purpose: that layout redirects here when onboarding is
 * unfinished, so nesting it would loop.
 */
export const Route = createFileRoute('/onboarding')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession();

    if (!data) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    }

    if (data.user.onboardedAt) {
      throw redirect({ to: '/' });
    }
  },
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();

  return (
    <OnboardingWizard
      onFinished={() => void navigate({ to: '/' })}
      onSignOut={() =>
        void authClient
          .signOut()
          .then(() => navigate({ to: '/sign-in', search: {} }))
      }
    />
  );
}
