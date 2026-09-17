import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;           // primary user type: patient | clinic | pharmacy_partner
  roles: string[];        // admin role slugs e.g. ["pharmacist", "staff"]
  permissions: string[];  // effective permission keys e.g. ["prescriptions.read"]
  emailVerified: boolean;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("access_token", accessToken);
        }
        set({ user, accessToken, isAuthenticated: true });
      },

      setUser: (user) => set({ user }),

      setAccessToken: (token) => {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("access_token", token);
        }
        set({ accessToken: token });
      },

      clearAuth: () => {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("access_token");
        }
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        return user.permissions.includes(permission);
      },
    }),
    {
      name: "medisyn-auth",
      /* only persist user identity — not the token (stored in sessionStorage) */
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
