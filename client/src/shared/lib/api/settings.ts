import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  ResetWorkspaceRequest,
  ResetWorkspaceResponse,
  SessionResponse,
  SettingsProfileMutationResponse,
  SettingsProfileResponse,
  UpdateSettingsProfileRequest,
} from "@life-os/contracts";
import {
  apiRequest,
  queryKeys,
} from "./core";

export const useSettingsProfileQuery = () =>
  useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiRequest<SettingsProfileResponse>("/api/settings/profile"),
    retry: false,
  });

export const useUpdateSettingsProfileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateSettingsProfileRequest) =>
      apiRequest<SettingsProfileMutationResponse>("/api/settings/profile", {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Settings saved.",
      errorMessage: "Settings could not be saved.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
};

export const useResetWorkspaceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ResetWorkspaceRequest) =>
      apiRequest<ResetWorkspaceResponse>("/api/settings/reset-workspace", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Workspace cleared.",
      errorMessage: "Workspace reset failed.",
    },
    onSuccess: () => {
      const sessionSnapshot = queryClient.getQueryData<SessionResponse>(queryKeys.session);

      queryClient.clear();

      if (sessionSnapshot?.authenticated) {
        queryClient.setQueryData<SessionResponse>(queryKeys.session, {
          ...sessionSnapshot,
          generatedAt: new Date().toISOString(),
        });
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
};
