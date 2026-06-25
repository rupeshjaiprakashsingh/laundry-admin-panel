import api from './axios';
import type { Branch } from '../types';

export const getBranches = (): Promise<Branch[]> => api.get('/branches').then((r) => r.data);
export const getBranch = (id: number): Promise<Branch> => api.get(`/branches/${id}`).then((r) => r.data);
export const createBranch = (data: Partial<Branch>) => api.post('/branches', data).then((r) => r.data);
export const updateBranch = (id: number, data: Partial<Branch>) =>
  api.put(`/branches/${id}`, data).then((r) => r.data);
export const deleteBranch = (id: number) => api.delete(`/branches/${id}`).then((r) => r.data);
