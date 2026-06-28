// ===================== ENTITY TYPES =====================

export interface Employee {
  id: number;
  employeeCode: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  role: 'SuperAdmin' | 'BranchManager' | 'Employee' | 'DeliveryBoy';
  branchId?: number;
  branch?: Branch;
  isActive: boolean;
  createdDate: string;
}

export interface Customer {
  id: number;
  customerCode: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
  houseDetails?: string;
  gender?: string;
  dob?: string;
  isActive: boolean;
  createdDate: string;
}

export interface Branch {
  id: number;
  branchName: string;
  branchCode: string;
  address?: string;
  contactNumber?: string;
  email?: string;
  isActive: boolean;
  createdDate: string;
}

export interface LaundryShop {
  id: number;
  shopName: string;
  shopCode: string;
  ownerName?: string;
  contactNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  capacity?: number;
  isActive: boolean;
  createdDate: string;
  // computed
  totalOrders?: number;
  activeOrders?: number;
  completedToday?: number;
  orders?: Order[];
}

export interface Service {
  id: number;
  serviceName: string;
  serviceType: string;
  price: number;
  description?: string;
  estimatedHours?: number;
  isActive: boolean;
  image?: string;
  linkedServiceIds?: any;
}

export interface Product {
  id: number;
  name: string;
  emoji: string;
  isActive: boolean;
  createdDate: string;
}

export interface ServicePrice {
  id: number;
  serviceId: number;
  service?: Service;
  productId: number;
  product?: Product;
  pincode: string;
  price: number;
  isActive: boolean;
}

export interface OrderItem {
  id: number;
  orderId: number;
  serviceId: number;
  service?: Service;
  clothType: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Payment {
  id: number;
  orderId: number;
  paymentMode: string;
  amount: number;
  transactionReference?: string;
  paymentStatus: string;
  paidDate: string;
}

export interface OrderStatusHistory {
  id: number;
  orderId: number;
  status: string;
  createdDate: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  customer?: Customer;
  branchId: number;
  branch?: Branch;
  laundryShopId?: number;
  laundryShop?: LaundryShop;
  pickupDate?: string;
  deliveryDate?: string;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  notes?: string;
  createdDate: string;
  orderItems?: OrderItem[];
  payments?: Payment[];
  deliveries?: Delivery[];
  statusHistory?: OrderStatusHistory[];
}

export interface PickupRequest {
  id: number;
  customerId: number;
  customer?: Customer;
  pickupAddress: string;
  pickupDate: string;
  pickupTime: string;
  status: string;
  assignedEmployeeId?: number;
  assignedEmployee?: Employee;
}

export interface Delivery {
  id: number;
  orderId: number;
  order?: Order;
  deliveryEmployeeId?: number;
  deliveryEmployee?: Employee;
  deliveryDate?: string;
  deliveryStatus: string;
  deliveryRemarks?: string;
}

export interface DashboardStats {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingDeliveries: number;
  todayPickups: number;
  todayDeliveries: number;
  monthlyRevenue: number;
  topCustomers: { customer: Partial<Customer>; totalSpent: number; orderCount: number }[];
  topServices: { service: Partial<Service>; totalQuantity: number }[];
}

// ===================== AUTH TYPES =====================
export interface AuthUser {
  userId: number;
  email: string;
  role: string;
  fullName: string;
  employeeCode: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
