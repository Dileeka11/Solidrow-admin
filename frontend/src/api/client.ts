import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

export const TOKEN_KEY = 'sr_token';

export const api = axios.create({
  baseURL,
  headers: { Accept: 'application/json' },
});

// Attach the Sanctum bearer token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token is rejected (expired or revoked), drop it and send the user back to
// the login screen. Guard against a loop on the login request itself.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';
    const hadToken = Boolean(localStorage.getItem(TOKEN_KEY));
    if (status === 401 && hadToken && !url.includes('/login')) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);
