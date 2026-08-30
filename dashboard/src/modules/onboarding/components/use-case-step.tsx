import { useState, type ComponentProps } from 'react';
import { Flex, VStack, Wrap } from '@riascout-ui/styled-system/jsx';

import type {
  OnboardingState,
  SavePreferencesUseCasesItem,
} from '../../../api/generated/rIAScoutAPI.schemas';
import { Button } from '../../../ui/primitives/button';
import { Span } from '../../../ui/primitives/text';
import { useSavePreferences } from '../mutations/use-onboarding-steps';
import { USE_CASE_OPTIONS } from '../use-cases';
import { StepHeader } from './step-header';

export type UseCaseStepProps = {
  state: OnboardingState;
  step: number;
  total: number;
  onBack: () => void;
  onDone: () => void;
};

export const UseCaseStep = ({
  state,
  step,
  total,
  onBack,
  onDone,
}: UseCaseStepProps) => {
  const [selected, setSelected] = useState<SavePreferencesUseCasesItem[]>(
    state.preferences.useCases,
  );

  const savePreferences = useSavePreferences();

  const toggle = (value: SavePreferencesUseCasesItem) =>
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );

  const onSubmit: ComponentProps<'form'>['onSubmit'] = async (event) => {
    event.preventDefault();

    try {
      await savePreferences.mutateAsync({ useCases: selected });
    } catch {
      // the mutation's onError already reported it; do not advance the step
      return;
    }

    onDone();
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <VStack alignItems="stretch" gap="6">
        <StepHeader
          description="Advisors, firms and the moves between them are one dataset — how you work it is up to you. Pick everything that applies."
          step={step}
          title="Help us customize your workspace"
          total={total}
        />

        <VStack alignItems="stretch" gap="3">
          <Span color="text.muted" fontSize="2">
            What will you be using RIAScout for?
          </Span>

          <Wrap gap="2">
            {USE_CASE_OPTIONS.map((option) => (
              <Button
                aria-pressed={selected.includes(option.value)}
                key={option.value}
                onClick={() => toggle(option.value)}
                rounded="full"
                size="sm"
                type="button"
                variant={selected.includes(option.value) ? 'solid' : 'outline'}
              >
                {option.label}
              </Button>
            ))}
          </Wrap>
        </VStack>

        <Flex gap="2">
          <Button onClick={onBack} size="sm" type="button" variant="ghost">
            Back
          </Button>
          <Button
            disabled={savePreferences.isPending}
            flex="1"
            size="sm"
            type="submit"
          >
            {savePreferences.isPending ? 'Saving…' : 'Continue'}
          </Button>
        </Flex>
      </VStack>
    </form>
  );
};
