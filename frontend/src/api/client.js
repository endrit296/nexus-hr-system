import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_BASE_URL, AUTH_ENDPOINTS, PUBLIC_AUTH_ENDPOINTS } from './config';
import { clearAuthSession, getAccessToken, getRefreshToken } from './authStorage';

const client = axios.create({
  baseURL: API_BASE_URL,
});

let refreshPromise = null;

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
      forceLogout();
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
