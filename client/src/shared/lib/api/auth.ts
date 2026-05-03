import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  SessionResponse,
} from "@life-os/contracts";

import {
  apiRequest,
  queryKeys,
} from "./core";

export const useSessionQuery = () =>
  useQuery({
    queryKey: queryKeys.session,
    queryFn: () => apiRequest<SessionResponse>("/api/auth/session"),
    retry: false,
  });

export const useLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginRequest) =>
      apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Signed in.",
    },
    onSuccess: (data) => {
      queryClient.setQueryData<SessionResponse>(queryKeys.session, {
        authenticated: true,
        generatedAt: new Date().toISOString(),
        user: data.user,
      });

      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
    },
  });
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest<LogoutResponse>("/api/auth/logout", {
        method: "POST",
      }),
    meta: {
      successMessage: "Signed out.",
      errorMessage: "Sign-out failed.",
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData<SessionResponse>(queryKeys.session, {
        authenticated: false,
        generatedAt: new Date().toISOString(),
        user: null,
      });
    },
  });
};
