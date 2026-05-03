import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  OnboardingCompleteRequest,
  OnboardingCompleteResponse,
  OnboardingStateResponse,
} from "@life-os/contracts";

import {
  apiRequest,
  queryKeys,
} from "./core";

export const useOnboardingStateQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.onboarding,
    queryFn: () => apiRequest<OnboardingStateResponse>("/api/onboarding/state"),
    enabled,
    retry: false,
  });

export const useCompleteOnboardingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: OnboardingCompleteRequest) =>
      apiRequest<OnboardingCompleteResponse>(
        "/api/onboarding/complete",
        {
          method: "POST",
          body: payload,
        },
      ),
    meta: {
      successMessage: "Setup complete.",
      errorMessage: "Setup could not be completed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
};
