import axios from 'axios';

const api = axios.create({
  baseURL: '/',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log(`[API] Sending request to ${config.url} with token: ${token.substring(0, 10)}...`);
  } else {
    console.warn('[API] No token found in localStorage for request:', config.url);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthError = error.response?.status === 401 || error.response?.status === 403;
    const isAuthRoute = error.config?.url?.includes('/api/auth/login') || error.config?.url?.includes('/api/auth/signup');

    if (isAuthError && !isAuthRoute) {
      console.error(`[API] Auth error (${error.response?.status}) on ${error.config?.url}. Clearing session.`);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
