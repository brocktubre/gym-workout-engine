import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Workout } from '@/types';
import { getDateDaysAgo, getTodayDate } from '@/lib/utils';

export const workoutKeys = {
  all: ['workouts'] as const,
  history: (start: string, end: string) => ['workouts', 'history', start, end] as const,
  detail: (date: string, id: string) => ['workouts', 'detail', date, id] as const,
  stats: () => ['workouts', 'stats'] as const,
};

export function useWorkoutHistory(days: number = 30) {
  const end = getTodayDate();
  const start = getDateDaysAgo(days);

  return useQuery({
    queryKey: workoutKeys.history(start, end),
    queryFn: () => api.getHistory(start, end),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useWorkoutStats() {
  return useQuery({
    queryKey: workoutKeys.stats(),
    queryFn: () => api.getStats(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useWorkout(date: string, id: string, enabled = true) {
  return useQuery({
    queryKey: workoutKeys.detail(date, id),
    queryFn: () => api.getWorkout(date, id),
    enabled: enabled && Boolean(date) && Boolean(id),
  });
}

export function useCreateWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workout: Omit<Workout, 'id'>) => api.createWorkout(workout),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      date,
      id,
      updates,
    }: {
      date: string;
      id: string;
      updates: Partial<Workout>;
    }) => api.updateWorkout(date, id, updates),
    onSuccess: (_data, { date, id }) => {
      void queryClient.invalidateQueries({ queryKey: workoutKeys.detail(date, id) });
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}

export function useCompleteWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, id, version }: { date: string; id: string; version?: number }) =>
      api.completeWorkout(date, id, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, id }: { date: string; id: string }) =>
      api.deleteWorkout(date, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}
