import type {
  Exercise,
  GenerateWorkoutRequest,
  Workout,
  WorkoutSet,
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

import { getApiBaseUrl } from '@/lib/apiBase';
import {
  authService,
  isTokenExpiringSoon,
  notifySessionExpired,
} from '@/lib/auth';

const BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Shared in-flight refresh so concurrent 401s only hit Cognito once. */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshIdToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = authService
      .refreshSession()
      .then((tokens) => tokens.idToken)
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function isAuthFailureMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid')
    || lower.includes('expired')
    || lower.includes('authentication required')
    || lower.includes('unauthorized')
  );
}

async function resolveIdToken(): Promise<string | null> {
  const current = authService.getIdToken();
  if (!current) return null;
  if (!isTokenExpiringSoon(current)) return current;
  // Proactively refresh before the request if the JWT is near expiry
  return (await refreshIdToken()) ?? current;
}

async function parseErrorMessage(response: Response): Promise<string> {
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    message = body.error ?? body.message ?? message;
  } catch {
    // ignore parse errors
  }
  return message;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const idToken = await resolveIdToken();
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Expired / invalid JWT — try one silent refresh, then retry once
  if (response.status === 401 && idToken) {
    const message = await parseErrorMessage(response.clone());
    if (isAuthFailureMessage(message)) {
      const refreshed = await refreshIdToken();
      if (refreshed) {
        headers.Authorization = `Bearer ${refreshed}`;
        response = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        notifySessionExpired();
        throw new ApiError(401, message);
      }
    }
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    if (response.status === 401 && idToken && isAuthFailureMessage(message)) {
      notifySessionExpired();
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

  /**
   * On-demand MuscleWiki demo lookup. Only call when the user taps Watch video.
   * Throws ApiError 404 when no match (caller should hide the button).
   */
  async getExerciseVideo(params: {
    name: string;
    exerciseId?: string;
  }): Promise<{ muscleWikiId: number; matchedName: string; streamUrl: string }> {
    const qs = new URLSearchParams({ name: params.name });
    if (params.exerciseId) qs.set('exerciseId', params.exerciseId);
    return request(`/exercises/video?${qs.toString()}`);
  },

  /** Absolute URL for the proxied video stream (for <video src>). */
  getExerciseVideoStreamUrl(streamUrl: string): string {
    if (streamUrl.startsWith('http')) return streamUrl;
    const path = streamUrl.startsWith('/') ? streamUrl : `/${streamUrl}`;
    return `${BASE_URL}${path}`;
  },

  // ── Engine ──────────────────────────────────────────────────────────────────
  generateWorkout(req: GenerateWorkoutRequest): Promise<{ workout: Workout }> {
    return request('/engine/generate', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async getDailyWorkout(localDate: string): Promise<{
    daily: {
      localDate: string;
      status: 'available' | 'completed';
      targetMuscleGroups: string[];
      workout: Workout;
      createdAt: string;
      completedAt?: string;
    };
  }> {
    return request(`/engine/daily?date=${encodeURIComponent(localDate)}`);
  },

  async completeDailyWorkout(localDate: string): Promise<void> {
    await request('/engine/daily/complete', {
      method: 'POST',
      body: JSON.stringify({ date: localDate }),
    });
  },

  async regenerateDailyWorkout(localDate: string): Promise<{
    daily: {
      localDate: string;
      status: 'available' | 'completed';
      targetMuscleGroups: string[];
      workout: Workout;
      createdAt: string;
      completedAt?: string;
    };
  }> {
    return request('/engine/daily/regenerate', {
      method: 'POST',
      body: JSON.stringify({ date: localDate }),
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

  // ── Active workout state (per-user, persisted in DynamoDB) ────────────────
  async getActiveWorkout(): Promise<{ state: { workout: Workout; turnIndex: number; isPaused: boolean; savedAt: string } | null }> {
    return request('/workouts/active');
  },

  async setActiveWorkout(workout: Workout, turnIndex: number, isPaused: boolean): Promise<void> {
    await request('/workouts/active', {
      method: 'PUT',
      body: JSON.stringify({ workout, turnIndex, isPaused }),
    });
  },

  async deleteActiveWorkout(): Promise<void> {
    await request('/workouts/active', { method: 'DELETE' });
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

  /** Recalculate sets/reps/weight after swapping a movement. */
  async swapPrescribe(params: {
    newExerciseId: string;
    replaced: {
      name: string;
      equipment: string;
      sets: number;
      reps: number;
      weight: number;
    };
    goal?: WorkoutGoal;
    durationMinutes?: number;
    restSeconds?: number;
  }): Promise<{ exercise: Exercise; sets: WorkoutSet[]; source: 'claude' | 'fallback' }> {
    return request('/engine/swap-prescribe', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // ── Coaching ─────────────────────────────────────────────────────────────────
  async getCoachingNote(): Promise<CoachingNote> {
    const res = await request<{ note: CoachingNote }>('/coaching/daily-note');
    return res.note;
  },

  // ── Feature Flags ──────────────────────────────────────────────────────
  async getFeatureFlags(): Promise<{ videoPlaybackEnabled: boolean }> {
    const res = await request<{ flags: { videoPlaybackEnabled: boolean } }>('/config/features');
    return res.flags;
  },

  // ── TTS ────────────────────────────────────────────────────────────────────
  async synthesizeSpeech(text: string): Promise<{ audio: string }> {
    return request('/tts', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
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
