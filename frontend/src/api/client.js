import axios from 'axios';
import useAuthStore from '../store/useAuthStore';

// Dev: http://localhost:8080 (API Gateway directly)
// Docker: http://localhost (Nginx load balancer on port 80)
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const client = axios.create({
  baseURL: BASE_URL,
});

let refreshPromise = null;

const AUTH_NO_REFRESH = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'];

const isAuthExcluded = (url = '') => AUTH_NO_REFRESH.some((path) => url.includes(path));

const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const [, payload] = token.split('.');
    const { exp } = JSON.parse(atob(payload));
    if (!exp) return false;
    return exp * 1000 <= Date.now() + 5000;
  } catch {
    return true;
  }
};

const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise;

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    localStorage.clear();
    window.location.href = '/login';
    throw new Error('Missing refresh token');
  }

  refreshPromise = axios
    .post(`${BASE_URL}/api/auth/refresh`, { refreshToken })
    .then(({ data }) => {
      useAuthStore.getState().setToken(data.token);
      return data.token;
    })
    .catch((error) => {
      localStorage.clear();
      window.location.href = '/login';
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

// Refresh an expired access token before protected requests leave the browser.
client.interceptors.request.use(async (config) => {
  if (isAuthExcluded(config.url)) return config;

  let token = localStorage.getItem('token');
  if (isTokenExpired(token)) {
    token = await refreshAccessToken();
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// On unexpected 401s: refresh once, retry once, then force logout.
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !isAuthExcluded(original.url)
    ) {
      original._retried = true;

      try {
        const token = await refreshAccessToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return client(original);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
