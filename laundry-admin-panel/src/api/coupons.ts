import api from './axios';
import type { Coupon } from '../types';

export const getCoupons = (): Promise<Coupon[]> => api.get('/coupons').then((r) => r.data);
export const createCoupon = (data: Partial<Coupon>) => api.post('/coupons', data).then((r) => r.data);
export const updateCoupon = (id: number, data: Partial<Coupon>) =>
  api.put(`/coupons/${id}`, data).then((r) => r.data);
export const deleteCoupon = (id: number) => api.delete(`/coupons/${id}`).then((r) => r.data);
