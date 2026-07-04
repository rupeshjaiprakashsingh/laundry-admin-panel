import api from './axios';

// ── Types ──────────────────────────────────────────────────────
export interface CustomerInfo {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  houseDetails?: string;
  landmark?: string;
}

export interface OrderItemInfo {
  clothType: string;
  quantity: number;
  service?: { serviceName: string };
}

export interface OrderInfo {
  id: number;
  orderNumber: string;
  customer: CustomerInfo;
  orderItems?: OrderItemInfo[];
  netAmount?: number;
  paymentStatus?: string;
}

export interface DeliveryAssignment {
  id: number;
  orderId: number;
  order: OrderInfo;
  deliveryStatus: string; // Pending | OutForDelivery | Delivered | Failed
  deliveryDate: string | null;
  deliveryRemarks: string | null;
}

export interface PickupAssignment {
  id: number;
  customerId: number;
  customer: CustomerInfo;
  pickupAddress: string;
  pickupDate: string;
  pickupTime: string;
  status: string; // Pending | Assigned | Completed | Cancelled
}

// ── API calls ──────────────────────────────────────────────────
export const getMyDeliveries = (): Promise<DeliveryAssignment[]> =>
  api.get('/deliveries/my-deliveries').then((r) => r.data);

export const getMyPickupAssignments = (): Promise<PickupAssignment[]> =>
  api.get('/pickup/my-assignments').then((r) => r.data);

export const updateMyDeliveryStatus = (
  id: number,
  deliveryStatus: string,
  deliveryRemarks?: string,
) => api.put(`/deliveries/${id}/status`, { deliveryStatus, deliveryRemarks }).then((r) => r.data);

export const updateMyPickupStatus = (id: number, status: string) =>
  api.put(`/pickup/${id}/status`, { status }).then((r) => r.data);
