import type { LayoutNode } from '@/domain/layout/types';
import { http } from '../client';

export interface LayoutDto { id: string; name: string; tree: LayoutNode; updatedAt: string; }

export const layoutApi = {
  list: () => http.get<LayoutDto[]>('/layouts'),
  get: (id: string) => http.get<LayoutDto>(`/layouts/${id}`),
  save: (layout: LayoutDto) => http.put<LayoutDto>(`/layouts/${layout.id}`, layout),
  remove: (id: string) => http.delete<void>(`/layouts/${id}`),
};
