import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  onboardingControllerComplete,
  onboardingControllerInviteTeammates,
  onboardingControllerSavePreferences,
  onboardingControllerSaveProfile,
  onboardingControllerSaveWorkspace,
  onboardingControllerUploadImage,
} from '../../../api/generated/onboarding/onboarding';
import type {
  InviteTeammates,
  SavePreferences,
  SaveProfile,
  SaveWorkspace,
  UploadImage,
} from '../../../api/generated/rIAScoutAPI.schemas';
import { toast } from '../../../ui/primitives/toast/toast';
import { onboardingQueryKey } from '../queries/use-onboarding-state';

/** each step reloads the state it just wrote, so Back shows what was saved */
const useStepMutation = <TBody, TResult>(
  fn: (body: TBody) => Promise<TResult>,
  errorMessage: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: onboardingQueryKey() });
    },
    onError: () => toast.error(errorMessage),
  });
};

export const useSaveProfile = () =>
  useStepMutation(
    (body: SaveProfile) => onboardingControllerSaveProfile(body),
    'Could not save your details',
  );

export const useSaveWorkspace = () =>
  useStepMutation(
    (body: SaveWorkspace) => onboardingControllerSaveWorkspace(body),
    'Could not save the workspace',
  );

export const useSavePreferences = () =>
  useStepMutation(
    (body: SavePreferences) => onboardingControllerSavePreferences(body),
    'Could not save that',
  );

export const useInviteTeammates = () =>
  useStepMutation(
    (body: InviteTeammates) => onboardingControllerInviteTeammates(body),
    'Could not send the invites',
  );

export const useUploadImage = () =>
  useMutation({
    mutationFn: (body: UploadImage) => onboardingControllerUploadImage(body),
    onError: () => toast.error('Could not upload that image'),
  });

export const useCompleteOnboarding = () =>
  useMutation({
    mutationFn: () => onboardingControllerComplete(),
    onError: () => toast.error('Could not finish setting up'),
  });
