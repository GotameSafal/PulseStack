import { create } from "zustand";
import { User, UserRole } from "@/types";
import {
  getAuthToken,
  setAuthToken as saveToken,
  removeAuthToken as clearToken,
  getStoredUser,
  setStoredUser,
} from "@/lib/authStorage";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (user, token) => {
    await saveToken(token);
    setStoredUser(user);
    set({ user, token, isAuthenticated: true });
  },

  logout: async () => {
    await clearToken();
    set({ user: null, token: null, isAuthenticated: false });
  },

  initAuth: async () => {
    set({ isLoading: true });
    const token = await getAuthToken();
    const user = getStoredUser<User>();

    if (token && user) {
      set({ user, token, isAuthenticated: true, isLoading: false });
    } else {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

// Permission helper
export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true; // Admins override permissions
  return user.permissions.includes(permission);
}

// Role utility helper
export function hasRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
