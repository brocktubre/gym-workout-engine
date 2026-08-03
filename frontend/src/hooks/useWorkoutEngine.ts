import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { GenerateWorkoutRequest, Workout } from '@/types';

const ACTIVE_WORKOUT_KEY = 'gym_active_workout';
const TIMER_START_KEY = 'gym_timer_start';

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
    return JSON.parse(raw) as Workout;
  } catch {
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
    }
  }, []);

  const startWorkout = useCallback((workout: Workout) => {
    saveTimerStart(Date.now());
    setActiveWorkout({ ...workout, status: 'in-progress' });
  }, [setActiveWorkout]);

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
  }, [setActiveWorkout]);

  return {
    activeWorkout,
    startWorkout,
    updateActiveWorkout,
    clearActiveWorkout,
    hasActiveWorkout: activeWorkout !== null,
  };
}

// ── Timer ────────────────────────────────────────────────────────────────────

export function useWorkoutTimer(running: boolean) {
  const [elapsed, setElapsed] = useState<number>(() => {
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
