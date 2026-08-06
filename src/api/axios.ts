import axios from 'axios';
import { store } from '../app/store';
import { logout, setTokens } from '../app/authSlice';

const baseURL = import.meta.env.VITE_API_URL || 'https://starfish-app-sy95b.ondigitalocean.app/api/v1';

const axiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Request interceptor: attach JWT
axiosInstance.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401, try refresh
axiosInstance.interceptors.response.use(
  (res) => {
    if (res.data && res.data.success === true && res.data.data !== undefined) {
      res.data = res.data.data;
    }
    return res;
  },
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = store.getState().auth.refreshToken;
        if (!refreshToken) throw new Error('No refresh token');
        const refreshUrl = `${baseURL.replace(/\/$/, '')}/auth/refresh`;
        const { data } = await axios.post(refreshUrl, { refreshToken });
        store.dispatch(setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }));
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosInstance(originalRequest);
      } catch {
        store.dispatch(logout());
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
