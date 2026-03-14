import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api",
  withCredentials: true, // send httpOnly cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercept 401s — user session expired
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // Clear any local state; AuthProvider handles redirect
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    return Promise.reject(error);
  }
);
