import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import type { LoginRequest, RegisterRequest } from "@/types/auth";

export const AUTH_KEY = ["auth", "me"] as const;

/* ── Current user ── */
export function useMe() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: AUTH_KEY,
    queryFn: () => authApi.getMe().then((r) => r.data.data),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

/* ── Login ── */
export function useLogin() {
  const { setAuth } = useAuthStore();
  const { addToast } = useUIStore();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data).then((r) => r.data.data),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      qc.setQueryData(AUTH_KEY, data.user);
    },
    onError: () => {
      addToast({ type: "error", title: "Login failed", message: "Invalid email or password." });
    },
  });
}

/* ── Register ── */
export function useRegister() {
  const { addToast } = useUIStore();

  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data).then((r) => r.data),
    onSuccess: () => {
      addToast({ type: "success", title: "Account created", message: "Check your email to verify your account." });
    },
    onError: () => {
      addToast({ type: "error", title: "Registration failed", message: "Please check your details and try again." });
    },
  });
}

/* ── Logout ── */
export function useLogout() {
  const { clearAuth } = useAuthStore();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearAuth();
      qc.clear();
    },
  });
}

/* ── Forgot password ── */
export function useForgotPassword() {
  const { addToast } = useUIStore();
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: () => {
      addToast({ type: "success", title: "Email sent", message: "Check your inbox for reset instructions." });
    },
  });
}

/* ── Reset password ── */
export function useResetPassword() {
  const { addToast } = useUIStore();
  return useMutation({
    mutationFn: (data: { token: string; password: string }) => authApi.resetPassword(data),
    onSuccess: () => {
      addToast({ type: "success", title: "Password updated", message: "You can now log in with your new password." });
    },
  });
}
