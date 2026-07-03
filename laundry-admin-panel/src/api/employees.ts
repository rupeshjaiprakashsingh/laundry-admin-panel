import api from './axios';
import type { Employee } from '../types';

export const getEmployees = (): Promise<Employee[]> => api.get('/employees').then((r) => r.data);
export const getEmployee = (id: number): Promise<Employee> => api.get(`/employees/${id}`).then((r) => r.data);
export const updateEmployee = (id: number, data: Partial<Employee>) =>
  api.put(`/employees/${id}`, data).then((r) => r.data);
export const deleteEmployee = (id: number) => api.delete(`/employees/${id}`).then((r) => r.data);
