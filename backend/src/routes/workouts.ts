import { Router, Request, Response } from 'express';
import {
  saveWorkout,
  getWorkout,
  updateWorkout,
  getWorkoutsInRange,
  getStats,
  getRecentWorkouts,
  deleteWorkout,
  ConflictError,
} from '../services/dynamodbService';
import { requireAuth } from '../middleware/auth';
import { Workout } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/workouts/stats — returns empty stats for anonymous users
router.get('/stats', async (req: Request, res: Response) => {
  if (!req.user) {
    res.json({ stats: { totalWorkouts: 0, currentStreak: 0, longestStreak: 0, totalVolumeKg: 0, averageDurationMinutes: 0, muscleGroupFrequency: {} } });
    return;
  }
  try {
    const stats = await getStats();
    res.json({ stats });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load stats', details: err.message });
  }
});

// GET /api/workouts/history — returns empty array for anonymous users
router.get('/history', async (req: Request, res: Response) => {
  if (!req.user) {
    res.json({ workouts: [], total: 0 });
    return;
  }
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
      const workouts = await getWorkoutsInRange(startDate, endDate);
      res.json({ workouts, total: workouts.length });
      return;
    }
    const workouts = await getWorkoutsInRange(start as string, end as string);
    res.json({ workouts, total: workouts.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load history', details: err.message });
  }
});

// GET /api/workouts/recent?days=14
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 14;
    const workouts = await getRecentWorkouts(days);
    res.json({ workouts });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load recent workouts' });
  }
});

// POST /api/workouts — requires auth
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const today = new Date().toISOString().split('T')[0];
    const workout: Workout = {
      id: body.id || uuidv4(),
      date: body.date || today,
      createdAt: body.createdAt || new Date().toISOString(),
      status: body.status || 'generated',
      exercises: body.exercises || [],
      targetDurationMinutes: body.targetDurationMinutes || 60,
      goal: body.goal || 'hypertrophy',
      notes: body.notes,
      // Preserve warmup fields
      ...(body.warmup ? { warmup: body.warmup } : {}),
      ...(body.warmupStatus ? { warmupStatus: body.warmupStatus } : {}),
    };
    await saveWorkout(workout);
    res.status(201).json({ workout });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create workout', details: err.message });
  }
});

// GET /api/workouts/:date/:id
router.get('/:date/:id', async (req: Request, res: Response) => {
  try {
    const { date, id } = req.params;
    const workout = await getWorkout(date, id);
    if (!workout) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.json({ workout });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load workout' });
  }
});

// PUT /api/workouts/:date/:id
router.put('/:date/:id', async (req: Request, res: Response) => {
  try {
    const { date, id } = req.params;
    // Extract the client's expected version from the request body
    const expectedVersion: number | undefined = typeof req.body.version === 'number'
      ? req.body.version
      : undefined;
    const workout = await updateWorkout(date, id, req.body, expectedVersion);
    res.json({ workout });
  } catch (err: any) {
    if (err instanceof ConflictError) {
      res.status(409).json({ error: 'STALE_WORKOUT', message: err.message });
      return;
    }
    if (err.message?.includes('not found')) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to update workout', details: err.message });
  }
});

// POST /api/workouts/:date/:id/complete
router.post('/:date/:id/complete', async (req: Request, res: Response) => {
  try {
    const { date, id } = req.params;
    const existing = await getWorkout(date, id);
    if (!existing) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

    // Client may send its expected version to detect conflicts
    const expectedVersion: number | undefined = typeof req.body?.version === 'number'
      ? req.body.version
      : undefined;

    const completedAt = new Date().toISOString();
    // Use startedAt if available (accurate), fall back to createdAt, then now
    const startTime = existing.startedAt
      ? new Date(existing.startedAt).getTime()
      : existing.createdAt
      ? new Date(existing.createdAt).getTime()
      : Date.now();
    const pausedMs = existing.totalPausedMs ?? 0;
    const activeMs = Math.max(0, Date.now() - startTime - pausedMs);
    const actualDurationMinutes = Math.round(activeMs / 60_000);

    // Calculate total volume
    let totalVolume = 0;
    for (const ex of existing.exercises) {
      for (const set of ex.sets) {
        if (set.completed && set.completedWeight && set.completedReps) {
          totalVolume += set.completedWeight * set.completedReps;
        }
      }
    }

    const updated = await updateWorkout(date, id, {
      status: 'completed',
      completedAt,
      actualDurationMinutes,
      totalVolume: Math.round(totalVolume),
    }, expectedVersion);

    res.json({ workout: updated });
  } catch (err: any) {
    if (err instanceof ConflictError) {
      res.status(409).json({ error: 'STALE_WORKOUT', message: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to complete workout', details: err.message });
  }
});

// DELETE /api/workouts/:date/:id — hard-delete a workout (used when user cancels)
router.delete('/:date/:id', async (req: Request, res: Response) => {
  try {
    const { date, id } = req.params;
    await deleteWorkout(date, id);
    res.json({ success: true, message: 'Workout deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete workout', details: err.message });
  }
});

export default router;
