import api from './axios';
import type { Banner } from '../types';

export const getBanners = (): Promise<Banner[]> => api.get('/banners/admin/all').then((r) => r.data);
export const createBanner = (data: Partial<Banner>) => api.post('/banners', data).then((r) => r.data);
export const updateBanner = (id: number, data: Partial<Banner>) =>
  api.put(`/banners/${id}`, data).then((r) => r.data);
export const deleteBanner = (id: number) => api.delete(`/banners/${id}`).then((r) => r.data);

export const uploadBannerImage = (file: File): Promise<{ imageUrl: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/banners/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const resolveImageUrl = (url?: string): string => {
  if (!url || !url.trim()) return 'https://placehold.co/600x300?text=No+Banner+Image';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  const apiBase = import.meta.env.VITE_API_URL || 'https://starfish-app-sy95b.ondigitalocean.app/api/v1';
  const rootServer = apiBase.replace(/\/api\/v1\/?$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${rootServer}${cleanPath}`;
};
