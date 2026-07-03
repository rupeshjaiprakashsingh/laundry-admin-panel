import api from './axios';
import type { Order } from '../types';

export const getOrders = (): Promise<Order[]> => api.get('/orders').then((r) => r.data);
export const getOrder = (id: number): Promise<Order> => api.get(`/orders/${id}`).then((r) => r.data);
export const updateOrderStatus = (id: number, orderStatus: string) =>
  api.put(`/orders/${id}/status`, { orderStatus }).then((r) => r.data);
export const updatePaymentStatus = (id: number, paymentStatus: string) =>
  api.put(`/orders/${id}/payment-status`, { paymentStatus }).then((r) => r.data);
export const assignOrderToShop = (id: number, laundryShopId: number) =>
  api.put(`/orders/${id}/assign-shop`, { laundryShopId }).then((r) => r.data);
export const bulkAssignOrdersToShop = (orderIds: number[], laundryShopId: number) =>
  api.post('/orders/bulk-assign-shop', { orderIds, laundryShopId }).then((r) => r.data);
