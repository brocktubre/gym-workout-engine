import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UserSettings } from '@/types';

export const settingsKeys = {
  all: ['settings'] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => api.getSettings(),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<UserSettings>) => api.updateSettings(settings),
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsKeys.all, updated);
    },
  });
}
