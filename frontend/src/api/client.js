import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_BASE_URL, AUTH_ENDPOINTS, PUBLIC_AUTH_ENDPOINTS } from './config';
import { clearAuthSession, getAccessToken, getRefreshToken } from './authStorage';

const client = axios.create({
  baseURL: API_BASE_URL,
});

let refreshPromise = null;

const RETRY_STATUSES = new Set([502, 503, 504]);
const MAX_RETRIES = 3;
const retryDelay = (attempt) => new Promise((res) => setTimeout(res, attempt * 3000));

const isAuthExcluded = (url = '') => PUBLIC_AUTH_ENDPOINTS.some((path) => url.includes(path));

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

const redirectToLogin = () => {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

const forceLogout = () => {
  clearAuthSession();
  useAuthStore.getState().logout();
  redirectToLogin();
};

const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    forceLogout();
    throw new Error('Missing refresh token');
  }

  refreshPromise = axios
    .post(`${API_BASE_URL}${AUTH_ENDPOINTS.refresh}`, { refreshToken })
    .then(({ data }) => {
      useAuthStore.getState().setToken(data.token);
      return data.token;
    })
    .catch((error) => {
      // Only force logout on actual auth rejection, not server unavailability.
      const status = error.response?.status;
      if (!status || status === 401 || status === 403) {
        forceLogout();
      }
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

  let token = getAccessToken();
  if (isTokenExpired(token)) {
    token = await refreshAccessToken();
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// On unexpected 401s: refresh once, retry once, then force logout.
// On 502/503/504 (cold start / gateway unavailable): retry up to 3 times with backoff.
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (RETRY_STATUSES.has(status) && original) {
      original._retryCount = (original._retryCount || 0) + 1;
      if (original._retryCount <= MAX_RETRIES) {
        await retryDelay(original._retryCount);
        return client(original);
      }
    }

    if (
      status === 401 &&
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
