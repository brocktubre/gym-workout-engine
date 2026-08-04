import type {
  Exercise,
  GenerateWorkoutRequest,
  Workout,
  WorkoutStats,
  UserSettings,
  MuscleGroup,
  WorkoutGoal,
} from '@/types';

export interface CoachingNote {
  note: string;
  suggestedMuscles: MuscleGroup[];
  suggestedGoal?: WorkoutGoal;
  date: string;
  generatedAt: string;
}

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export class ApiError extends Error {
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
  const idToken = localStorage.getItem('gym_id_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const response = await fetch(url, {
    ...options,
    headers,
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
  async getExercises(params?: { muscle?: string; equipment?: string; search?: string }): Promise<Exercise[]> {
    const qs = new URLSearchParams();
    if (params?.muscle) qs.set('muscle', params.muscle);
    if (params?.equipment) qs.set('equipment', params.equipment);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString();
    const res = await request<{ exercises: Exercise[]; total: number }>(`/exercises${query ? `?${query}` : ''}`);
    return res.exercises;
  },

  async getExercise(id: string): Promise<Exercise> {
    const res = await request<{ exercise: Exercise }>(`/exercises/${encodeURIComponent(id)}`);
    return res.exercise;
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

  async getWorkout(date: string, id: string): Promise<Workout> {
    const res = await request<{ workout: Workout }>(`/workouts/${encodeURIComponent(date)}/${encodeURIComponent(id)}`);
    return res.workout;
  },

  async updateWorkout(date: string, id: string, updates: Partial<Workout>): Promise<Workout> {
    const res = await request<{ workout: Workout }>(`/workouts/${encodeURIComponent(date)}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.workout;
  },

  async deleteWorkout(date: string, id: string): Promise<void> {
    await request<{ success: boolean }>(`/workouts/${encodeURIComponent(date)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async completeWorkout(date: string, id: string, version?: number): Promise<Workout> {
    const res = await request<{ workout: Workout }>(`/workouts/${encodeURIComponent(date)}/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      body: version !== undefined ? JSON.stringify({ version }) : undefined,
    });
    return res.workout;
  },

  async getHistory(start: string, end: string): Promise<Workout[]> {
    const qs = new URLSearchParams({ start, end });
    const res = await request<{ workouts: Workout[]; total: number }>(`/workouts/history?${qs.toString()}`);
    return res.workouts;
  },

  async getStats(): Promise<WorkoutStats> {
    const res = await request<{ stats: WorkoutStats }>('/workouts/stats');
    return res.stats;
  },

  // ── Engine extras ───────────────────────────────────────────────────────────
  async swapSuggest(params: {
    primaryMuscle: MuscleGroup;
    excludeIds: string[];
  }): Promise<Exercise[]> {
    const res = await request<{ suggestions: Exercise[] }>('/engine/swap-suggest', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.suggestions;
  },

  // ── Coaching ─────────────────────────────────────────────────────────────────
  async getCoachingNote(): Promise<CoachingNote> {
    const res = await request<{ note: CoachingNote }>('/coaching/daily-note');
    return res.note;
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  async getSettings(): Promise<UserSettings> {
    const res = await request<{ settings: UserSettings }>('/settings');
    return res.settings;
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const res = await request<{ settings: UserSettings }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return res.settings;
  },
};
