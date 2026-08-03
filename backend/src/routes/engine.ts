import { Router, Request, Response } from 'express';
import { getSettings, getRecentWorkouts } from '../services/dynamodbService';
import { generateWorkout } from '../services/workoutEngine';
import { enhanceWorkoutWithClaude } from '../services/claudeService';
import { filterExercises } from '../services/exerciseService';
import { GenerateWorkoutRequest, MuscleGroup, Equipment } from '../types';
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
      getSettings(),
      getRecentWorkouts(14),
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

    const settings = await getSettings();
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
