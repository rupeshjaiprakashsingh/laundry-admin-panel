import api from './axios';
import type { Order } from '../types';

export interface OrderCommunicationMessage {
  id: number;
  customerId: number;
  orderId?: number | null;
  orderNumber?: string | null;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string | null;
  isAdminMessage?: boolean;
  sentDate: string;
  status: string;
}

export const getOrders = (): Promise<Order[]> => api.get('/orders').then((r) => r.data);
export const getOrder = (id: number): Promise<Order> => api.get(`/orders/${id}`).then((r) => r.data);
export const updateOrderStatus = (id: number, orderStatus: string) =>
  api.put(`/orders/${id}/status`, { orderStatus }).then((r) => r.data);
export const updatePaymentStatus = (id: number, paymentStatus: string, paymentMode?: string) =>
  api.put(`/orders/${id}/payment-status`, { paymentStatus, paymentMode }).then((r) => r.data);
export const assignOrderToShop = (id: number, laundryShopId: number) =>
  api.put(`/orders/${id}/assign-shop`, { laundryShopId }).then((r) => r.data);
export const bulkAssignOrdersToShop = (orderIds: number[], laundryShopId: number) =>
  api.post('/orders/bulk-assign-shop', { orderIds, laundryShopId }).then((r) => r.data);

export const verifyOrderItems = (
  id: number,
  orderItems: Array<{ serviceId: number; clothType: string; quantity: number }>,
  verificationNotes?: string,
) => api.put(`/orders/${id}/verify-items`, { orderItems, verificationNotes }).then((r) => r.data);

export const sendCustomerOrderMessage = (data: {
  customerId: number;
  orderId?: number;
  orderNumber?: string;
  title?: string;
  message: string;
}) => api.post('/notifications/send-message', data).then((r) => r.data);

export const getOrderMessages = (
  orderId: number,
  orderNumber?: string,
): Promise<OrderCommunicationMessage[]> =>
  api.get(`/notifications/order/${orderId}`, { params: { orderNumber } }).then((r) => r.data);
