import { useQuery } from '@tanstack/react-query';

import { onboardingControllerGetState } from '../../../api/generated/onboarding/onboarding';
import { QUERY_KEYS } from '../../../lib/query';

export const onboardingQueryKey = () => [QUERY_KEYS.onboarding] as const;

export const useOnboardingState = () =>
  useQuery({
    queryKey: onboardingQueryKey(),
    queryFn: () => onboardingControllerGetState(),
    // the wizard is the only reader and writes through it, so never stale-serve
    staleTime: 0,
  });
