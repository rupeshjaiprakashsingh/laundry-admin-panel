import api from './axios';
import type { LaundryShop } from '../types';

export const getLaundryShops = (): Promise<LaundryShop[]> =>
  api.get('/laundry-shops').then((r) => r.data);

export const getLaundryShop = (id: number): Promise<LaundryShop> =>
  api.get(`/laundry-shops/${id}`).then((r) => r.data);

export const createLaundryShop = (data: Partial<LaundryShop>) =>
  api.post('/laundry-shops', data).then((r) => r.data);

export const updateLaundryShop = (id: number, data: Partial<LaundryShop>) =>
  api.put(`/laundry-shops/${id}`, data).then((r) => r.data);

export const deleteLaundryShop = (id: number) =>
  api.delete(`/laundry-shops/${id}`).then((r) => r.data);

export const suggestLaundryShopsByPincode = (pincode: string): Promise<LaundryShop[]> =>
  api.get(`/laundry-shops/suggest?pincode=${pincode}`).then((r) => r.data);
