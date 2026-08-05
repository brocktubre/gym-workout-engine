import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface FeatureFlags {
  videoPlaybackEnabled: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  videoPlaybackEnabled: true,
};

export function useFeatureFlags(): FeatureFlags {
  const { data } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: () => api.getFeatureFlags(),
    staleTime: 1000 * 60 * 5, // cache for 5 minutes
    retry: 1,
  });

  return data ?? DEFAULT_FLAGS;
}
