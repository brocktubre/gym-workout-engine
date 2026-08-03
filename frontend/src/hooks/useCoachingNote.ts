import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCoachingNote() {
  return useQuery({
    queryKey: ['coaching-note', new Date().toISOString().split('T')[0]],
    queryFn: () => api.getCoachingNote(),
    // Cache for the day — stale after 6 hours, don't refetch on window focus
    staleTime: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
