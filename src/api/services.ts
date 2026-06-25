import api from './axios';
import type { Service, Product, ServicePrice } from '../types';

// Services
export const getServices = (): Promise<Service[]> => api.get('/services').then((r) => r.data);
export const createService = (data: Partial<Service>) => api.post('/services', data).then((r) => r.data);
export const updateService = (id: number, data: Partial<Service>) =>
  api.put(`/services/${id}`, data).then((r) => r.data);
export const deleteService = (id: number) => api.delete(`/services/${id}`).then((r) => r.data);

// Products
export const getProducts = (): Promise<Product[]> =>
  api.get('/services/admin/products').then((r) => r.data);
export const createProduct = (data: Partial<Product>) =>
  api.post('/services/admin/products', data).then((r) => r.data);
export const updateProduct = (id: number, data: Partial<Product>) =>
  api.put(`/services/admin/products/${id}`, data).then((r) => r.data);
export const deleteProduct = (id: number) =>
  api.delete(`/services/admin/products/${id}`).then((r) => r.data);

// Service Prices
export const getServicePrices = (): Promise<ServicePrice[]> =>
  api.get('/services/admin/prices').then((r) => r.data);
export const createServicePrice = (data: Partial<ServicePrice>) =>
  api.post('/services/admin/prices', data).then((r) => r.data);
export const updateServicePrice = (id: number, data: Partial<ServicePrice>) =>
  api.put(`/services/admin/prices/${id}`, data).then((r) => r.data);
export const deleteServicePrice = (id: number) =>
  api.delete(`/services/admin/prices/${id}`).then((r) => r.data);

// Resolved pricing
export const getResolvedPricing = (pincode?: string) =>
  api.get('/services/pricing/resolve', { params: { pincode } }).then((r) => r.data);
