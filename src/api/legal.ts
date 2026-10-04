import api from './axios';

export interface LegalContent {
  id: number;
  key: string;
  title: string;
  content: string;
  updatedDate?: string;
  createdDate?: string;
}

export const getLegalContent = (key: string): Promise<LegalContent> =>
  api.get(`/legal/${key}`).then((r) => r.data);

export const getAllLegalContent = (): Promise<LegalContent[]> =>
  api.get('/legal').then((r) => r.data);

export const updateLegalContent = (
  key: string,
  data: { title?: string; content: string }
): Promise<LegalContent> => api.put(`/legal/${key}`, data).then((r) => r.data);
