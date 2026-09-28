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

const version = "/v1";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const axiosInstance: AxiosInstance = axios.create({
  baseURL: `${apiUrl}${version}`,
  timeout: 10000,
  withCredentials: true,
});

// ===================================================
// REQUEST INTERCEPTOR (PRE)
// ===================================================

axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Set custom headers
    config.headers.set("X-Requested-With", "XMLHttpRequest");

    // Attach Bearer token if present
    const token = await getAuthToken();
    if (token && !config.headers.get("Authorization")) {
      config.headers.set("Authorization", `Bearer ${token}`);
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
    // Ignore canceled/aborted requests (e.g. component unmount, Fast Refresh, TanStack Query aborts)
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

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
          window.location.href = `/auth/login?returnUrl=${returnUrl}`;
        }
      }

      return Promise.reject(error);
    }

    // Handle 403 Forbidden - User doesn't have permission
    if (error.response?.status === 403) {
      console.error("Access forbidden:", error.response?.data?.message);
    }

    // Handle actual network connection errors (server down, CORS failure, offline)
    if (!error.response && error.code === "ERR_NETWORK") {
      console.error("Network error - please check your connection");
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
