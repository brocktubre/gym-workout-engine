import { Router, Request, Response } from 'express';
import { getSettings, getRecentWorkouts } from '../services/dynamodbService';
import { generateWorkout } from '../services/workoutEngine';
import { GenerateWorkoutRequest } from '../types';
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

    const exercises = await generateWorkout({ settings, recentWorkouts, request });

    const today = new Date().toISOString().split('T')[0];
    const workout = {
      id: uuidv4(),
      date: today,
      createdAt: new Date().toISOString(),
      status: 'generated' as const,
      exercises,
      targetDurationMinutes: request.durationMinutes,
      goal: request.goal || settings.goal,
    };

    res.json({ workout });
  } catch (err: any) {
    console.error('Engine generate error:', err);
    res.status(500).json({ error: 'Failed to generate workout', details: err.message });
  }
});

export default router;
