import { Router, Request, Response } from 'express';
import { getRecentWorkouts, getDailyWorkout, saveDailyWorkout } from '../services/dynamodbService';
import { resolveUserSettings } from '../services/userService';
import { generateWorkout } from '../services/workoutEngine';
import { enhanceWorkoutWithClaude } from '../services/claudeService';
import { filterExercises } from '../services/exerciseService';
import { musclesForLocalDate } from '../services/dailyWorkout';
import { GenerateWorkoutRequest, MuscleGroup, Equipment } from '../types';
import { requireAuth } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const request: GenerateWorkoutRequest = req.body;
    if (!request.durationMinutes || request.durationMinutes < 15) {
      res.status(400).json({ error: 'durationMinutes must be at least 15' });
      return;
    }

    const [settings, recentWorkouts] = await Promise.all([
      resolveUserSettings(req.user?.sub),
      getRecentWorkouts(14, req.user?.sub),
    ]);

    const { exercises: ruleExercises, warmup } = await generateWorkout({ settings, recentWorkouts, request });

    // Hybrid: rule engine generates candidates, Claude refines order + supersets
    const exercises = await enhanceWorkoutWithClaude(ruleExercises, settings, recentWorkouts);

    const today = new Date().toISOString().split('T')[0];
    const workout = {
      id: uuidv4(),
      date: today,
      createdAt: new Date().toISOString(),
      status: 'generated' as const,
      exercises,
      warmup,
      warmupStatus: warmup.length > 0 ? 'pending' as const : undefined,
      targetDurationMinutes: request.durationMinutes,
      goal: request.goal || settings.goal,
    };

    res.json({ workout });
  } catch (err: any) {
    console.error('Engine generate error:', err);
    res.status(500).json({ error: 'Failed to generate workout', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/engine/daily?date=YYYY-MM-DD
// Get-or-create this user's daily workout for their local calendar date.
// ---------------------------------------------------------------------------
router.get('/daily', requireAuth, async (req: Request, res: Response) => {
  try {
    const sub = req.user?.sub;
    if (!sub) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const localDate = String(req.query.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD (local calendar day)' });
      return;
    }

    const existing = await getDailyWorkout(sub, localDate);
    if (existing) {
      res.json({ daily: existing });
      return;
    }

    const [settings, recentWorkouts] = await Promise.all([
      resolveUserSettings(sub),
      getRecentWorkouts(14, sub),
    ]);

    const targetMuscleGroups = musclesForLocalDate(localDate);
    const durationMinutes = Math.max(15, settings.defaultDurationMinutes || 60);
    const request: GenerateWorkoutRequest = {
      durationMinutes,
      goal: settings.goal,
      targetMuscleGroups,
      includeWarmup: settings.includeWarmup ?? true,
      allowSupersets: settings.allowSupersets ?? true,
    };

    const { exercises: ruleExercises, warmup } = await generateWorkout({
      settings,
      recentWorkouts,
      request,
    });
    const exercises = await enhanceWorkoutWithClaude(ruleExercises, settings, recentWorkouts);

    const workout = {
      id: uuidv4(),
      date: localDate,
      createdAt: new Date().toISOString(),
      status: 'generated' as const,
      exercises,
      warmup,
      warmupStatus: warmup.length > 0 ? ('pending' as const) : undefined,
      targetDurationMinutes: durationMinutes,
      goal: settings.goal,
    };

    const daily = {
      localDate,
      status: 'available' as const,
      targetMuscleGroups,
      workout,
      createdAt: new Date().toISOString(),
    };

    await saveDailyWorkout(sub, daily);
    res.json({ daily });
  } catch (err: any) {
    console.error('Daily workout error:', err);
    res.status(500).json({ error: 'Failed to load daily workout', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/engine/daily/complete  { date: YYYY-MM-DD }
// Mark today's daily plan done so it leaves the Dashboard.
// ---------------------------------------------------------------------------
router.post('/daily/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const sub = req.user?.sub;
    if (!sub) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const localDate = String(req.body?.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      return;
    }

    const existing = await getDailyWorkout(sub, localDate);
    if (!existing) {
      res.status(404).json({ error: 'Daily workout not found' });
      return;
    }

    const updated = {
      ...existing,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
    };
    await saveDailyWorkout(sub, updated);
    res.json({ daily: updated });
  } catch (err: any) {
    console.error('Daily complete error:', err);
    res.status(500).json({ error: 'Failed to complete daily workout', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/engine/swap-suggest
// Returns alternative exercises for the same muscle group,
// filtered by user's available equipment, excluding current workout IDs.
// ---------------------------------------------------------------------------
router.post('/swap-suggest', async (req: Request, res: Response) => {
  try {
    const {
      primaryMuscle,
      excludeIds = [],
    }: { primaryMuscle: MuscleGroup; excludeIds?: string[] } = req.body;

    if (!primaryMuscle) {
      res.status(400).json({ error: 'primaryMuscle is required' });
      return;
    }

    const settings = await resolveUserSettings(req.user?.sub);
    const excludeSet = new Set<string>(excludeIds);

    // All exercises that primarily target this muscle group
    const pool = filterExercises({ muscle: primaryMuscle })
      .filter(e =>
        e.primaryMuscle === primaryMuscle &&           // primary match only
        settings.availableEquipment.includes(e.equipment as Equipment) &&
        !excludeSet.has(e.id),
      );

    // Compounds first, then isolation — shuffle within each tier
    const shuffle = <T,>(arr: T[]): T[] =>
      [...arr].sort(() => Math.random() - 0.5);

    const compounds = shuffle(pool.filter(e => e.category === 'compound'));
    const isolations = shuffle(pool.filter(e => e.category !== 'compound'));

    const suggestions = [...compounds, ...isolations].slice(0, 6);

    res.json({ suggestions });
  } catch (err: any) {
    console.error('Swap suggest error:', err);
    res.status(500).json({ error: 'Failed to get swap suggestions', details: err.message });
  }
});

export default router;
