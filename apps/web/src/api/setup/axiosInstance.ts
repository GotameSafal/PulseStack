import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { getAuthToken, removeAuthToken } from "@/lib/authStorage";

// Extend the config type to include _retry flag
interface RetryAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const version = "/api/v1/en";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const axiosInstance: AxiosInstance = axios.create({
  baseURL: `${apiUrl}${version}`,
  timeout: 10000,
  withCredentials: true, // SUPER IMPORTANT for sending cookies
});

// Helper to extract farmId from URL pathname
const getFarmIdFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;

  // Match pattern: /farms/[farmId]/...
  const match = window.location.pathname.match(/\/farms\/([^\/]+)/);
  return match ? match[1] : null;
};

// ===================================================
// REQUEST INTERCEPTOR (PRE)
// ===================================================

axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Set custom headers
    config.headers.set("X-Requested-With", "XMLHttpRequest");

    // Cookie is sent automatically withCredentials: true

    // Inject Farm ID from URL if not already set explicitly
    if (!config.headers.get("x-farm-id")) {
      const farmId = getFarmIdFromUrl();
      if (farmId) {
        config.headers.set("x-farm-id", farmId);
      }
    }

    // Inject language preference from localStorage (set by i18n)
    if (typeof window !== "undefined") {
      const language = localStorage.getItem("i18nextLng") || "en";
      config.headers.set("Accept-Language", language);
    }

    // Log requests in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[API Request] ${config.method?.toUpperCase()} ${config.url}`,
        {
          data: config.data,
          params: config.params,
        },
      );
    }

    return config;
  },
  (error) => {
    console.error("[API Request Error]", error);
    return Promise.reject(error);
  },
);

// ===================================================
// RESPONSE INTERCEPTOR (POST)
// ===================================================

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log responses in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[API Response] ${response.config.method?.toUpperCase()} ${
          response.config.url
        }`,
        {
          status: response.status,
          data: response.data,
        },
      );
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config as RetryAxiosRequestConfig;

    // Log errors in development
    if (process.env.NODE_ENV === "development") {
      console.error("[API Error]", {
        url: originalRequest?.url,
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
    }

    // Handle 401 Unauthorized - Token expired or invalid
    // Since we're using cookie-based auth, we can't refresh tokens client-side
    // The cookie is HttpOnly and managed by the backend
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      console.log(
        `[Axios] 401 Unauthorized at ${
          typeof window !== "undefined" ? window.location.pathname : "SSR"
        } - clearing auth and checking for redirect`,
      );

      // Clear auth state
      await removeAuthToken();

      // Only redirect if we're in the browser and not already on a public auth page
      if (typeof window !== "undefined") {
        const pathname = window.location.pathname;
        const isPublicAuthPath =
          pathname === "/" ||
          pathname.startsWith("/auth") ||
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/invite");

        if (!isPublicAuthPath) {
          const returnUrl = encodeURIComponent(
            window.location.pathname + window.location.search,
          );
          window.location.href = `/auth?returnUrl=${returnUrl}`;
        }
      }

      return Promise.reject(error);
    }

    // Handle 403 Forbidden - User doesn't have permission
    if (error.response?.status === 403) {
      console.error("Access forbidden:", error.response?.data?.message);
    }

    // Handle network errors
    if (!error.response) {
      console.error("Network error - please check your connection");
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
