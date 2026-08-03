import type {
  Exercise,
  GenerateWorkoutRequest,
  Workout,
  WorkoutStats,
  UserSettings,
} from '@/types';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  // ── Exercises ──────────────────────────────────────────────────────────────
  getExercises(params?: { muscle?: string; equipment?: string; search?: string }): Promise<Exercise[]> {
    const qs = new URLSearchParams();
    if (params?.muscle) qs.set('muscle', params.muscle);
    if (params?.equipment) qs.set('equipment', params.equipment);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString();
    return request<Exercise[]>(`/exercises${query ? `?${query}` : ''}`);
  },

  getExercise(id: string): Promise<Exercise> {
    return request<Exercise>(`/exercises/${encodeURIComponent(id)}`);
  },

  // ── Engine ──────────────────────────────────────────────────────────────────
  generateWorkout(req: GenerateWorkoutRequest): Promise<{ workout: Workout }> {
    return request('/engine/generate', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  // ── Workouts ────────────────────────────────────────────────────────────────
  async createWorkout(workout: Omit<Workout, 'id'>): Promise<Workout> {
    const res = await request<{ workout: Workout }>('/workouts', {
      method: 'POST',
      body: JSON.stringify(workout),
    });
    return res.workout;
  },

  getWorkout(date: string, id: string): Promise<Workout> {
    return request<Workout>(`/workouts/${encodeURIComponent(date)}/${encodeURIComponent(id)}`);
  },

  async updateWorkout(date: string, id: string, updates: Partial<Workout>): Promise<Workout> {
    const res = await request<{ workout: Workout }>(`/workouts/${encodeURIComponent(date)}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.workout;
  },

  completeWorkout(date: string, id: string): Promise<Workout> {
    return request<Workout>(`/workouts/${encodeURIComponent(date)}/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
    });
  },

  getHistory(start: string, end: string): Promise<Workout[]> {
    const qs = new URLSearchParams({ start, end });
    return request<Workout[]>(`/workouts?${qs.toString()}`);
  },

  getStats(): Promise<WorkoutStats> {
    return request<WorkoutStats>('/workouts/stats');
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  getSettings(): Promise<UserSettings> {
    return request<UserSettings>('/settings');
  },

  updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    return request<UserSettings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },
};
