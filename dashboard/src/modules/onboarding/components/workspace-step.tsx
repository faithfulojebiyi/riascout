import { useState, type ComponentProps } from 'react';
import { Flex, VStack } from '@riascout-ui/styled-system/jsx';

import type { OnboardingState } from '../../../api/generated/rIAScoutAPI.schemas';
import { Button } from '../../../ui/primitives/button';
import { Input } from '../../../ui/primitives/input';
import { Label } from '../../../ui/primitives/label';
import { useSaveWorkspace } from '../mutations/use-onboarding-steps';
import { ImageField } from './image-field';
import { StepHeader } from './step-header';

export type WorkspaceStepProps = {
  state: OnboardingState;
  step: number;
  total: number;
  onBack: () => void;
  onDone: () => void;
};

export const WorkspaceStep = ({
  state,
  step,
  total,
  onBack,
  onDone,
}: WorkspaceStepProps) => {
  const [name, setName] = useState(state.workspace.name);
  const [logo, setLogo] = useState(state.workspace.logo);

  const saveWorkspace = useSaveWorkspace();

  const onSubmit: ComponentProps<'form'>['onSubmit'] = async (event) => {
    event.preventDefault();

    try {
      await saveWorkspace.mutateAsync({ name, logo });
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
          description="Everything you save — lists, records and views — lives inside it, and this is what your teammates will see."
          step={step}
          title="Name your workspace"
          total={total}
        />

        <ImageField
          fallback={(name.trim().charAt(0) || 'W').toUpperCase()}
          label="Workspace logo"
          onChange={setLogo}
          rounded="md"
          value={logo}
        />

        <VStack alignItems="stretch" gap="1.5">
          <Label htmlFor="workspaceName">Workspace name</Label>
          <Input
            autoFocus
            id="workspaceName"
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter a workspace name…"
            required
            size="sm"
            value={name}
          />
        </VStack>

        <Flex gap="2">
          <Button onClick={onBack} size="sm" type="button" variant="ghost">
            Back
          </Button>
          <Button
            disabled={saveWorkspace.isPending || name.trim() === ''}
            flex="1"
            size="sm"
            type="submit"
          >
            {saveWorkspace.isPending ? 'Saving…' : 'Continue'}
          </Button>
        </Flex>
      </VStack>
    </form>
  );
};
