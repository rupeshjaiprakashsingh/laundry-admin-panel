import api from './axios';

export interface TimeSlot {
  id: number;
  slotName: string;
  maxCapacity: number;
  isActive: boolean;
}

export const getTimeSlotsAdmin = (): Promise<TimeSlot[]> =>
  api.get('/orders/time-slots/admin').then((r) => r.data);

export const createTimeSlot = (data: Partial<TimeSlot>) =>
  api.post('/orders/time-slots', data).then((r) => r.data);

export const updateTimeSlot = (id: number, data: Partial<TimeSlot>) =>
  api.put(`/orders/time-slots/${id}`, data).then((r) => r.data);

export const deleteTimeSlot = (id: number) =>
  api.delete(`/orders/time-slots/${id}`).then((r) => r.data);
