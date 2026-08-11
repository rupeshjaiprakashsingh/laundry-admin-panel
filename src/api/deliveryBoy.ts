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

export interface LaundryShopInfo {
  id: number;
  shopName: string;
  shopCode?: string;
  contactNumber?: string;
  address?: string;
  city?: string;
  pincode?: string;
}

export interface OrderInfo {
  id: number;
  orderNumber: string;
  customer: CustomerInfo;
  orderItems?: OrderItemInfo[];
  netAmount?: number;
  paymentStatus?: string;
  laundryShop?: LaundryShopInfo;
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
  order?: {
    id: number;
    orderNumber: string;
    netAmount?: number;
    paymentStatus?: string;
    laundryShop?: LaundryShopInfo;
  } | null;
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
  deliveryOtp?: string,
) => api.put(`/deliveries/${id}/status`, { deliveryStatus, deliveryRemarks, deliveryOtp }).then((r) => r.data);

export const requestDeliveryOtp = (id: number) =>
  api.post(`/deliveries/${id}/request-otp`).then((r) => r.data);

export const updateMyPickupStatus = (id: number, status: string, laundryShopId?: number) =>
  api.put(`/pickup/${id}/status`, { status, laundryShopId }).then((r) => r.data);
