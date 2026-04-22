import axios from 'axios';
import useAuthStore from '../store/useAuthStore';

// Dev: http://localhost:8080 (API Gateway directly)
// Docker: http://localhost (Nginx load balancer on port 80)
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const client = axios.create({
  baseURL: BASE_URL,
});

// Attach access token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: attempt silent token refresh, then retry the original request once
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Only attempt refresh once, and not for auth endpoints themselves
    if (
      error.response?.status === 401 &&
      !original._retried &&
      !original.url.includes('/api/auth/')
    ) {
      original._retried = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        // No refresh token — force logout
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        // Sync new token to Zustand store (also updates localStorage via setToken)
        useAuthStore.getState().setToken(data.token);
        original.headers.Authorization = `Bearer ${data.token}`;
        return client(original);
      } catch {
        // Refresh failed — clear session and redirect to login
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
