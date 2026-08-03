import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const exerciseKeys = {
  all: ['exercises'] as const,
  list: (params?: { muscle?: string; equipment?: string; search?: string }) =>
    ['exercises', 'list', params] as const,
  detail: (id: string) => ['exercises', 'detail', id] as const,
};

export function useExercises(params?: {
  muscle?: string;
  equipment?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: exerciseKeys.list(params),
    queryFn: () => api.getExercises(params),
    staleTime: 1000 * 60 * 10, // 10 minutes – exercise list is fairly static
  });
}

export function useExercise(id: string, enabled = true) {
  return useQuery({
    queryKey: exerciseKeys.detail(id),
    queryFn: () => api.getExercise(id),
    enabled: enabled && Boolean(id),
    staleTime: 1000 * 60 * 10,
  });
}
