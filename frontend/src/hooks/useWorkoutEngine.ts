import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { GenerateWorkoutRequest, Workout } from '@/types';

const ACTIVE_WORKOUT_KEY = 'gym_active_workout';
const PAUSED_AT_KEY      = 'gym_paused_at';
const TURN_INDEX_KEY     = 'gym_turn_index';

// Legacy keys — only used for migration of stale localStorage state
const LEGACY_TIMER_KEY   = 'gym_timer_start';
const LEGACY_ELAPSED_KEY = 'gym_elapsed_offset';

export const WORKOUT_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Generate mutation ────────────────────────────────────────────────────────

export function useGenerateWorkout() {
  return useMutation({
    mutationFn: (req: GenerateWorkoutRequest) => api.generateWorkout(req),
  });
}

// ── Active workout ───────────────────────────────────────────────────────────

function loadActiveWorkout(): Workout | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WORKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Workout;
    if (!parsed?.id || !parsed?.goal || !parsed?.status || !Array.isArray(parsed?.exercises)) {
      localStorage.removeItem(ACTIVE_WORKOUT_KEY);
      return null;
    }

    // ── Migration: move legacy timer keys into the workout object ──
    if (!parsed.startedAt) {
      const legacyTimerRaw = localStorage.getItem(LEGACY_TIMER_KEY);
      const legacyElapsedRaw = localStorage.getItem(LEGACY_ELAPSED_KEY);
      const legacyTimer = legacyTimerRaw ? parseInt(legacyTimerRaw, 10) : null;

      if (legacyTimer && !isNaN(legacyTimer)) {
        const age = Date.now() - legacyTimer;
        if (age > 0 && age < WORKOUT_EXPIRE_MS) {
          // Reasonable timer: use it as the effective start
          parsed.startedAt = new Date(legacyTimer).toISOString();
          parsed.totalPausedMs = 0;
        } else {
          // Stale / garbage — reset to now so elapsed shows 0:00 not 951:55
          parsed.startedAt = new Date().toISOString();
          parsed.totalPausedMs = 0;
        }
      } else if (legacyElapsedRaw) {
        // Had a pause offset but no timer key — reconstruct from offset
        const offsetMs = parseInt(legacyElapsedRaw, 10) * 1000;
        parsed.startedAt = new Date(Date.now() - offsetMs).toISOString();
        parsed.totalPausedMs = 0;
      } else {
        // No legacy data at all — fresh start
        parsed.startedAt = new Date().toISOString();
        parsed.totalPausedMs = 0;
      }

      // Persist the migrated state and clean up legacy keys
      saveActiveWorkout(parsed);
      localStorage.removeItem(LEGACY_TIMER_KEY);
      localStorage.removeItem(LEGACY_ELAPSED_KEY);
    }

    return parsed;
  } catch {
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
    return null;
  }
}

function saveActiveWorkout(workout: Workout | null) {
  if (workout) {
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout));
  } else {
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
  }
}

export function useActiveWorkout() {
  const [activeWorkout, setActiveWorkoutState] = useState<Workout | null>(
    () => loadActiveWorkout(),
  );

  const setActiveWorkout = useCallback((workout: Workout | null) => {
    setActiveWorkoutState(workout);
    saveActiveWorkout(workout);
    if (!workout) {
      // Clean up all related localStorage keys
      localStorage.removeItem(PAUSED_AT_KEY);
      localStorage.removeItem(TURN_INDEX_KEY);
      localStorage.removeItem(LEGACY_TIMER_KEY);
      localStorage.removeItem(LEGACY_ELAPSED_KEY);
      // Remove from DynamoDB so this user's next session starts clean
      api.deleteActiveWorkout().catch(() => {});
    }
    // Notify all other hook instances in this window (BottomNav, Dashboard, etc.)
    window.dispatchEvent(new StorageEvent('storage', { key: ACTIVE_WORKOUT_KEY }));
  }, []);

  const updateActiveWorkout = useCallback((updates: Partial<Workout>) => {
    setActiveWorkoutState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveActiveWorkout(updated);
      return updated;
    });
  }, []);

  const startWorkout = useCallback((workout: Workout) => {
    localStorage.removeItem(PAUSED_AT_KEY);
    localStorage.removeItem(TURN_INDEX_KEY);
    localStorage.removeItem(LEGACY_TIMER_KEY);
    localStorage.removeItem(LEGACY_ELAPSED_KEY);

    const now = new Date().toISOString();
    setIsPaused(false);
    const started: Workout = {
      ...workout,
      status: 'in-progress',
      startedAt: workout.startedAt ?? now, // preserve if already set by server
      totalPausedMs: 0,
      lastPausedAt: undefined,
    };
    setActiveWorkout(started);
    // Persist to DynamoDB so this user's session survives device switches
    api.setActiveWorkout(started, 0, false).catch(() => {});
  }, [setActiveWorkout]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Pause: record the pause timestamp in the workout object */
  const pauseWorkout = useCallback((turnIndex: number) => {
    const now = new Date().toISOString();
    localStorage.setItem(PAUSED_AT_KEY, String(Date.now()));
    localStorage.setItem(TURN_INDEX_KEY, String(turnIndex));
    setIsPaused(true);
    // Store lastPausedAt in the workout object so elapsed stays frozen
    setActiveWorkoutState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, lastPausedAt: now };
      saveActiveWorkout(updated);
      // Persist paused state to DynamoDB so user can resume on any device
      api.setActiveWorkout(updated, turnIndex, true).catch(() => {});
      return updated;
    });
    window.dispatchEvent(new StorageEvent('storage', { key: PAUSED_AT_KEY }));
  }, []);

  /** Resume: accumulate pause duration into totalPausedMs, clear lastPausedAt */
  const resumeFromPause = useCallback(() => {
    const now = Date.now();
    setActiveWorkoutState((prev) => {
      if (!prev) return prev;
      const additionalPausedMs = prev.lastPausedAt
        ? Math.max(0, now - new Date(prev.lastPausedAt).getTime())
        : 0;
      const updated: Workout = {
        ...prev,
        totalPausedMs: (prev.totalPausedMs ?? 0) + additionalPausedMs,
        lastPausedAt: undefined,
      };
      saveActiveWorkout(updated);
      return updated;
    });
    localStorage.removeItem(PAUSED_AT_KEY);
    setIsPaused(false);
    window.dispatchEvent(new StorageEvent('storage', { key: PAUSED_AT_KEY }));
  }, []);

  /** Persist the current turn so leaving the screen mid-workout resumes in place */
  const saveTurnIndex = useCallback((turnIndex: number) => {
    localStorage.setItem(TURN_INDEX_KEY, String(turnIndex));
  }, []);

  /** Return the saved turn index (0 if none) */
  const getSavedTurnIndex = useCallback((): number => {
    const raw = localStorage.getItem(TURN_INDEX_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return isNaN(n) ? 0 : n;
  }, []);

  const [isPaused, setIsPaused] = useState<boolean>(
    () => localStorage.getItem(PAUSED_AT_KEY) !== null,
  );

  const clearActiveWorkout = useCallback(() => {
    setActiveWorkout(null);
    setIsPaused(false);
  }, [setActiveWorkout]);

  // Sync isPaused and workout state across hook instances via storage events
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PAUSED_AT_KEY || e.key === ACTIVE_WORKOUT_KEY) {
        setIsPaused(localStorage.getItem(PAUSED_AT_KEY) !== null);
        const latest = loadActiveWorkout();
        setActiveWorkoutState(latest);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return {
    activeWorkout,
    startWorkout,
    pauseWorkout,
    resumeFromPause,
    getSavedTurnIndex,
    saveTurnIndex,
    updateActiveWorkout,
    clearActiveWorkout,
    hasActiveWorkout: activeWorkout !== null,
    isPaused,
  };
}

// ── Timer — anchored to workout.startedAt ────────────────────────────────────
//
// elapsed = (now - startedAt) - totalPausedMs
// When paused, frozen at (lastPausedAt - startedAt) - totalPausedMs
//
export function useWorkoutTimer(workout: Workout | null, isPaused: boolean) {
  const getElapsed = useCallback((): number => {
    if (!workout?.startedAt) return 0;
    const startMs = new Date(workout.startedAt).getTime();
    const pausedMs = workout.totalPausedMs ?? 0;
    if (isPaused && workout.lastPausedAt) {
      // Frozen at the moment the user paused
      return Math.max(0, Math.floor(
        (new Date(workout.lastPausedAt).getTime() - startMs - pausedMs) / 1000,
      ));
    }
    return Math.max(0, Math.floor((Date.now() - startMs - pausedMs) / 1000));
  }, [workout?.startedAt, workout?.totalPausedMs, workout?.lastPausedAt, isPaused]);

  const [elapsed, setElapsed] = useState(getElapsed);

  useEffect(() => {
    setElapsed(getElapsed()); // sync immediately when inputs change

    if (isPaused || !workout?.startedAt) return; // don't tick while paused

    const timer = setInterval(() => setElapsed(getElapsed()), 1000);
    return () => clearInterval(timer);
  }, [getElapsed]);

  return { elapsed };
}

// ── Rest countdown ────────────────────────────────────────────────────────────

export function useRestCountdown() {
  const [restSeconds, setRestSeconds] = useState<number>(0);
  const [isResting, setIsResting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRest = useCallback((seconds: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRestSeconds(seconds);
    setIsResting(true);

    intervalRef.current = setInterval(() => {
      setRestSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setIsResting(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const skipRest = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRestSeconds(0);
    setIsResting(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { restSeconds, isResting, startRest, skipRest };
}
