import api from './axios';
import type { PickupRequest } from '../types';

export const getPickups = (): Promise<PickupRequest[]> => api.get('/pickup').then((r) => r.data);
export const getPickup = (id: number): Promise<PickupRequest> => api.get(`/pickup/${id}`).then((r) => r.data);
export const assignPickup = (id: number, assignedEmployeeId: number) =>
  api.put(`/pickup/${id}/assign`, { assignedEmployeeId }).then((r) => r.data);
export const updatePickupStatus = (id: number, status: string) =>
  api.put(`/pickup/${id}/status`, { status }).then((r) => r.data);
