import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { GenerateWorkoutRequest, Workout } from '@/types';

const ACTIVE_WORKOUT_KEY = 'gym_active_workout';
const TIMER_START_KEY = 'gym_timer_start';
const PAUSED_AT_KEY = 'gym_paused_at';
const TURN_INDEX_KEY = 'gym_turn_index';
const ELAPSED_OFFSET_KEY = 'gym_elapsed_offset';

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
    // Validate required fields — clear stale/corrupted entries
    if (!parsed?.id || !parsed?.goal || !parsed?.status || !Array.isArray(parsed?.exercises)) {
      localStorage.removeItem(ACTIVE_WORKOUT_KEY);
      return null;
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

function loadTimerStart(): number | null {
  const raw = localStorage.getItem(TIMER_START_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function saveTimerStart(ts: number | null) {
  if (ts !== null) {
    localStorage.setItem(TIMER_START_KEY, String(ts));
  } else {
    localStorage.removeItem(TIMER_START_KEY);
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
      saveTimerStart(null);
      localStorage.removeItem(PAUSED_AT_KEY);
      localStorage.removeItem(TURN_INDEX_KEY);
      localStorage.removeItem(ELAPSED_OFFSET_KEY);
    }
  }, []);

  const startWorkout = useCallback((workout: Workout) => {
    localStorage.removeItem(PAUSED_AT_KEY);
    localStorage.removeItem(TURN_INDEX_KEY);
    localStorage.removeItem(ELAPSED_OFFSET_KEY);
    saveTimerStart(Date.now());
    setIsPaused(false);
    setActiveWorkout({ ...workout, status: 'in-progress' });
  }, [setActiveWorkout]);

  /** Pause and save current turn index so user can resume later */
  const pauseWorkout = useCallback((turnIndex: number, elapsedSeconds: number) => {
    localStorage.setItem(PAUSED_AT_KEY, String(Date.now()));
    localStorage.setItem(TURN_INDEX_KEY, String(turnIndex));
    localStorage.setItem(ELAPSED_OFFSET_KEY, String(elapsedSeconds));
    setIsPaused(true);
    // Dispatch storage event so other hook instances (Dashboard) re-sync
    window.dispatchEvent(new StorageEvent('storage', { key: PAUSED_AT_KEY }));
  }, []);

  /** Return the saved turn index (0 if none) */
  const getSavedTurnIndex = useCallback((): number => {
    const raw = localStorage.getItem(TURN_INDEX_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return isNaN(n) ? 0 : n;
  }, []);

  /** Restore timer to saved elapsed offset and unpause */
  const resumeFromPause = useCallback(() => {
    const offsetRaw = localStorage.getItem(ELAPSED_OFFSET_KEY);
    const offsetSeconds = offsetRaw ? parseInt(offsetRaw, 10) : 0;
    // Set timer start so elapsed reads correctly
    saveTimerStart(Date.now() - offsetSeconds * 1000);
    localStorage.removeItem(PAUSED_AT_KEY);
    localStorage.removeItem(ELAPSED_OFFSET_KEY);
    setIsPaused(false);
    window.dispatchEvent(new StorageEvent('storage', { key: PAUSED_AT_KEY }));
  }, []);

  /** Get saved elapsed offset in seconds (used to initialize timer display when paused) */
  const getSavedElapsed = useCallback((): number => {
    const raw = localStorage.getItem(ELAPSED_OFFSET_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return isNaN(n) ? 0 : n;
  }, []);

  /** Whether the workout is currently paused (saved, not actively running) */
  const [isPaused, setIsPaused] = useState<boolean>(
    () => localStorage.getItem(PAUSED_AT_KEY) !== null
  );

  const updateActiveWorkout = useCallback((updates: Partial<Workout>) => {
    setActiveWorkoutState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveActiveWorkout(updated);
      return updated;
    });
  }, []);

  const clearActiveWorkout = useCallback(() => {
    setActiveWorkout(null);
    setIsPaused(false);
  }, [setActiveWorkout]);

  // Sync isPaused across all hook instances via storage events
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PAUSED_AT_KEY || e.key === ACTIVE_WORKOUT_KEY) {
        setIsPaused(localStorage.getItem(PAUSED_AT_KEY) !== null);
        // Also re-sync activeWorkout in case another instance cleared it
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
    getSavedElapsed,
    updateActiveWorkout,
    clearActiveWorkout,
    hasActiveWorkout: activeWorkout !== null,
    isPaused,
  };
}

// ── Timer ────────────────────────────────────────────────────────────────────

export function useWorkoutTimer(running: boolean, initialElapsed?: number) {
  const [elapsed, setElapsed] = useState<number>(() => {
    if (initialElapsed !== undefined) return initialElapsed;
    const start = loadTimerStart();
    if (!start) return 0;
    return Math.floor((Date.now() - start) / 1000);
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Ensure timer start is stored
    let start = loadTimerStart();
    if (!start) {
      start = Date.now() - elapsed * 1000;
      saveTimerStart(start);
    }

    const tick = () => {
      const s = loadTimerStart();
      if (s) {
        setElapsed(Math.floor((Date.now() - s) / 1000));
      }
    };

    intervalRef.current = setInterval(tick, 1000);
    tick(); // immediate first tick

    // Persist on page unload
    const handleUnload = () => {
      // timer start already stored; nothing extra needed
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [running, elapsed]);

  const resetTimer = useCallback(() => {
    saveTimerStart(Date.now());
    setElapsed(0);
  }, []);

  return { elapsed, resetTimer };
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
