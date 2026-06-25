import api from './axios';
import type { LoginResponse } from '../types';

export const loginEmployee = (email: string, password: string): Promise<LoginResponse> =>
  api.post('/auth/login', { email, password }).then((r) => r.data);

export const registerEmployee = (data: {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  role: string;
  branchId?: number;
}) => api.post('/auth/register-employee', data).then((r) => r.data);

export const refreshAccessToken = (refreshToken: string) =>
  api.post('/auth/refresh', { refreshToken }).then((r) => r.data);
