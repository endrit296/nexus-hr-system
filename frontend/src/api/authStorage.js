import { AUTH_STORAGE_KEYS } from './config';

const getStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

const readJson = (key) => {
  const value = getStorage()?.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readPersistedState = () => {
  const persisted = readJson(AUTH_STORAGE_KEYS.store);
  return persisted?.state ?? null;
};

const readValue = (key) => getStorage()?.getItem(key) ?? null;

export const getAccessToken = () =>
  readValue(AUTH_STORAGE_KEYS.accessToken) ?? readPersistedState()?.token ?? null;

export const getRefreshToken = () =>
  readValue(AUTH_STORAGE_KEYS.refreshToken) ?? readPersistedState()?.refreshToken ?? null;

export const getStoredUser = () =>
  readJson(AUTH_STORAGE_KEYS.user) ?? readPersistedState()?.user ?? null;

export const setStoredUser = (user) => {
  if (user) {
    getStorage()?.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user));
    return;
  }

  getStorage()?.removeItem(AUTH_STORAGE_KEYS.user);
};

export const setAccessToken = (token) => {
  if (token) {
    getStorage()?.setItem(AUTH_STORAGE_KEYS.accessToken, token);
    return;
  }

  getStorage()?.removeItem(AUTH_STORAGE_KEYS.accessToken);
};

export const setRefreshToken = (token) => {
  if (token) {
    getStorage()?.setItem(AUTH_STORAGE_KEYS.refreshToken, token);
    return;
  }

  getStorage()?.removeItem(AUTH_STORAGE_KEYS.refreshToken);
};

export const setAuthSession = ({ user, token, refreshToken }) => {
  setStoredUser(user);
  setAccessToken(token);
  setRefreshToken(refreshToken);
};

export const clearAuthSession = () => {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  storage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
  storage.removeItem(AUTH_STORAGE_KEYS.user);
  storage.removeItem(AUTH_STORAGE_KEYS.store);
};
