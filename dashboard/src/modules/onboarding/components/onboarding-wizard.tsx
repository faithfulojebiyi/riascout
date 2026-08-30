import { useState } from 'react';
import { VStack } from '@riascout-ui/styled-system/jsx';

import { AuthShell } from '../../auth/components/auth-shell';
import { Text } from '../../../ui/primitives/text';
import { useCompleteOnboarding } from '../mutations/use-onboarding-steps';
import { useOnboardingState } from '../queries/use-onboarding-state';
import { InviteStep } from './invite-step';
import { ProductPreview } from './product-preview';
import { ProfileStep } from './profile-step';
import { UseCaseStep } from './use-case-step';
import { WorkspaceStep } from './workspace-step';

/**
 * Four steps, not five: the one missing against the reference is connect your
 * mailbox, and there is no mail integration to connect to yet.
 */
const TOTAL_STEPS = 4;

export type OnboardingWizardProps = {
  onFinished: () => void;
  onSignOut: () => void;
};

export const OnboardingWizard = ({
  onFinished,
  onSignOut,
}: OnboardingWizardProps) => {
  const [step, setStep] = useState(1);

  const stateQuery = useOnboardingState();
  const complete = useCompleteOnboarding();

  const state = stateQuery.data;

  if (!state) {
    return (
      <AuthShell onSignOut={onSignOut}>
        <Text color="text.muted">
          {stateQuery.isError ? 'Could not load your account' : 'Loading…'}
        </Text>
      </AuthShell>
    );
  }

  const finish = async () => {
    try {
      await complete.mutateAsync();
    } catch {
      // the mutation's onError already reported it; stay on the last step
      return;
    }

    onFinished();
  };

  const back = () => setStep((current) => Math.max(1, current - 1));
  const next = () => setStep((current) => current + 1);

  return (
    <AuthShell
      aside={<ProductPreview workspaceName={state.workspace.name} />}
      onSignOut={onSignOut}
    >
      <VStack alignItems="stretch" gap="0">
        {step === 1 ? (
          <ProfileStep
            onDone={next}
            state={state}
            step={1}
            total={TOTAL_STEPS}
          />
        ) : null}

        {step === 2 ? (
          <WorkspaceStep
            onBack={back}
            onDone={next}
            state={state}
            step={2}
            total={TOTAL_STEPS}
          />
        ) : null}

        {step === 3 ? (
          <UseCaseStep
            onBack={back}
            onDone={next}
            state={state}
            step={3}
            total={TOTAL_STEPS}
          />
        ) : null}

        {step === 4 ? (
          <InviteStep
            finishing={complete.isPending}
            onBack={back}
            onDone={() => void finish()}
            state={state}
            step={4}
            total={TOTAL_STEPS}
          />
        ) : null}
      </VStack>
    </AuthShell>
  );
};
