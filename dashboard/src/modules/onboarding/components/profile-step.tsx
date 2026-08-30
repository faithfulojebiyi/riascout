import { useState, type ComponentProps } from 'react';
import { Flex, VStack } from '@riascout-ui/styled-system/jsx';

import type { OnboardingState } from '../../../api/generated/rIAScoutAPI.schemas';
import { Button } from '../../../ui/primitives/button';
import { Input } from '../../../ui/primitives/input';
import { Label } from '../../../ui/primitives/label';
import { Switch } from '../../../ui/primitives/switch';
import { Separator } from '../../../ui/primitives/separator';
import { Span, Text } from '../../../ui/primitives/text';
import { useSaveProfile } from '../mutations/use-onboarding-steps';
import { initialsOf, splitName } from '../name';
import { ImageField } from './image-field';
import { StepHeader } from './step-header';

export type ProfileStepProps = {
  state: OnboardingState;
  step: number;
  total: number;
  onDone: () => void;
};

export const ProfileStep = ({
  state,
  step,
  total,
  onDone,
}: ProfileStepProps) => {
  const initial = splitName(state.user.name);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [image, setImage] = useState(state.user.image);
  const [marketingOptIn, setMarketingOptIn] = useState(
    state.user.marketingOptIn,
  );

  const saveProfile = useSaveProfile();

  const onSubmit: ComponentProps<'form'>['onSubmit'] = async (event) => {
    event.preventDefault();

    try {
      await saveProfile.mutateAsync({
        firstName,
        lastName,
        image,
        marketingOptIn,
      });
    } catch {
      // the mutation's onError already reported it; do not advance the step
      return;
    }

    onDone();
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <VStack alignItems="stretch" gap="6">
        <StepHeader step={step} title="Let's get to know you" total={total} />

        <ImageField
          fallback={initialsOf(firstName, lastName, state.user.email)}
          label="Profile picture"
          onChange={setImage}
          value={image}
        />

        <VStack alignItems="stretch" gap="4">
          <VStack alignItems="stretch" gap="1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              autoComplete="given-name"
              autoFocus
              id="firstName"
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Enter your first name…"
              required
              size="sm"
              value={firstName}
            />
          </VStack>

          <VStack alignItems="stretch" gap="1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              autoComplete="family-name"
              id="lastName"
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Enter your last name…"
              size="sm"
              value={lastName}
            />
          </VStack>

          <VStack alignItems="stretch" gap="1.5">
            <Label htmlFor="email">Email</Label>
            {/* the account is keyed on it, so changing it here is not a profile edit */}
            <Input
              disabled
              id="email"
              readOnly
              size="sm"
              value={state.user.email}
            />
          </VStack>
        </VStack>

        <Separator />

        <Flex align="center" gap="4" justify="space-between">
          <VStack alignItems="flex-start" gap="0.5">
            <Span fontSize="2" fontWeight="500">
              Subscribe to product update emails
            </Span>
            <Text color="text.muted" fontSize="1">
              New data sources, filters and movement coverage as they ship.
            </Text>
          </VStack>
          <Switch
            checked={marketingOptIn}
            onCheckedChange={setMarketingOptIn}
            size="md"
          />
        </Flex>

        <Button
          disabled={saveProfile.isPending || firstName.trim() === ''}
          size="sm"
          type="submit"
        >
          {saveProfile.isPending ? 'Saving…' : 'Continue'}
        </Button>
      </VStack>
    </form>
  );
};
