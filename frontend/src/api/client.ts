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
