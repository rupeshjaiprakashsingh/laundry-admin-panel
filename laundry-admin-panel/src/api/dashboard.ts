import api from './axios';
import type { DashboardStats } from '../types';

export const getDashboardStats = (): Promise<DashboardStats> =>
  api.get('/dashboard').then((r) => r.data);
