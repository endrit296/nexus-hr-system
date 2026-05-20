const readImportMetaEnv = () =>
  (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {});

const readProcessEnv = () =>
  (typeof process !== 'undefined' && process.env ? process.env : {});

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const importMetaEnv = readImportMetaEnv();
const processEnv = readProcessEnv();

const rawApiBaseUrl =
  importMetaEnv.VITE_API_BASE_URL ||
  processEnv.REACT_APP_API_URL ||
  'http://localhost:8080';

export const API_BASE_URL = trimTrailingSlash(rawApiBaseUrl);

export const AUTH_STORAGE_KEYS = Object.freeze({
  accessToken: 'nexus_token',
  refreshToken: 'nexus_refresh_token',
  user: 'nexus_user',
  store: 'nexus_auth',
});

export const AUTH_ENDPOINTS = Object.freeze({
  activate: '/api/auth/activate',
  changePassword: '/api/auth/change-password',
  forgotPassword: '/api/auth/forgot-password',
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  refresh: '/api/auth/refresh',
  register: '/api/auth/register',
  resetPassword: '/api/auth/reset-password',
});

export const PUBLIC_AUTH_ENDPOINTS = Object.freeze([
  AUTH_ENDPOINTS.login,
  AUTH_ENDPOINTS.register,
  AUTH_ENDPOINTS.refresh,
  AUTH_ENDPOINTS.logout,
  AUTH_ENDPOINTS.forgotPassword,
  AUTH_ENDPOINTS.activate,
  AUTH_ENDPOINTS.resetPassword,
]);
