import api from './axios';
import type { Banner } from '../types';

export const getBanners = (): Promise<Banner[]> => api.get('/banners/admin/all').then((r) => r.data);
export const createBanner = (data: Partial<Banner>) => api.post('/banners', data).then((r) => r.data);
export const updateBanner = (id: number, data: Partial<Banner>) =>
  api.put(`/banners/${id}`, data).then((r) => r.data);
export const deleteBanner = (id: number) => api.delete(`/banners/${id}`).then((r) => r.data);
