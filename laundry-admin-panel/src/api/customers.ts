import api from './axios';
import type { Customer } from '../types';

export const getCustomers = (): Promise<Customer[]> => api.get('/customers').then((r) => r.data);
export const getCustomer = (id: number): Promise<Customer> => api.get(`/customers/${id}`).then((r) => r.data);
export const updateCustomer = (id: number, data: Partial<Customer>) =>
  api.put(`/customers/${id}`, data).then((r) => r.data);
export const deleteCustomer = (id: number) => api.delete(`/customers/${id}`).then((r) => r.data);
