import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  apiRequest,
  queryKeys,
} from "./core";

type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

type SessionResponse = {
  authenticated: boolean;
  generatedAt: string;
  user: SessionUser | null;
};

type LoginResponse = {
  success: true;
  generatedAt: string;
  user: SessionUser;
};

type LogoutResponse = {
  success: true;
  generatedAt: string;
};

export const useSessionQuery = () =>
  useQuery({
    queryKey: queryKeys.session,
    queryFn: () => apiRequest<SessionResponse>("/api/auth/session"),
    retry: false,
  });

export const useLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
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
