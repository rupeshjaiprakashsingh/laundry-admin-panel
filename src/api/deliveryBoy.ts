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
  id?: number;
  serviceId?: number;
  clothType: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  service?: {
    id?: number;
    serviceName: string;
    serviceType?: string;
  };
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
  orderStatus?: string;
  customer: CustomerInfo;
  orderItems?: OrderItemInfo[];
  totalClothes?: number;
  totalAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  netAmount?: number;
  paymentStatus?: string;
  notes?: string | null;
  laundryShop?: LaundryShopInfo;
  addressTitle?: string | null;
  houseDetails?: string | null;
  landmark?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
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
    orderStatus?: string;
    orderItems?: OrderItemInfo[];
    totalClothes?: number;
    totalAmount?: number;
    discountAmount?: number;
    taxAmount?: number;
    netAmount?: number;
    paymentStatus?: string;
    notes?: string | null;
    laundryShop?: LaundryShopInfo;
    addressTitle?: string | null;
    houseDetails?: string | null;
    landmark?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
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
  paymentMode?: string,
) => api.put(`/deliveries/${id}/status`, { deliveryStatus, deliveryRemarks, deliveryOtp, paymentMode }).then((r) => r.data);

export const requestDeliveryOtp = (id: number) =>
  api.post(`/deliveries/${id}/request-otp`).then((r) => r.data);

export const updateMyPickupStatus = (id: number, status: string, laundryShopId?: number) =>
  api.put(`/pickup/${id}/status`, { status, laundryShopId }).then((r) => r.data);

export const verifyOrderItems = (
  orderId: number,
  orderItems: Array<{ serviceId: number; clothType: string; quantity: number }>,
  verificationNotes?: string,
) =>
  api.put(`/orders/${orderId}/verify-items`, { orderItems, verificationNotes }).then((r) => r.data);
