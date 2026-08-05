import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getTodayDate } from '@/lib/utils';
import type { Workout, MuscleGroup } from '@/types';

export interface DailyWorkout {
  localDate: string;
  status: 'available' | 'completed';
  targetMuscleGroups: MuscleGroup[];
  workout: Workout;
  createdAt: string;
  completedAt?: string;
}

export const dailyWorkoutKeys = {
  all: ['daily-workout'] as const,
  date: (date: string) => [...dailyWorkoutKeys.all, date] as const,
};

export function useDailyWorkout() {
  const { isAuthenticated } = useAuth();
  const localDate = getTodayDate();

  return useQuery({
    queryKey: dailyWorkoutKeys.date(localDate),
    queryFn: async (): Promise<DailyWorkout> => {
      const { daily } = await api.getDailyWorkout(localDate);
      return {
        ...daily,
        targetMuscleGroups: daily.targetMuscleGroups as MuscleGroup[],
      };
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

export function useInvalidateDailyWorkout() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: dailyWorkoutKeys.all });
  };
}
