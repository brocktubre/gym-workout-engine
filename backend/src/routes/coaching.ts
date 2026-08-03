import { Router, Request, Response } from 'express';
import { getSettings, getRecentWorkouts, getCachedCoachingNote, saveCoachingNote } from '../services/dynamodbService';
import { generateDailyCoachingNote } from '../services/claudeService';

const router = Router();

// GET /api/coaching/daily-note
// Returns (and caches) a Claude-generated coaching note for today.
router.get('/daily-note', async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Return cached note if already generated today
    const cached = await getCachedCoachingNote(today);
    if (cached) {
      res.json({ note: cached });
      return;
    }

    // 2. Fetch context
    const [settings, recentWorkouts] = await Promise.all([
      getSettings(),
      getRecentWorkouts(14),
    ]);

    // 3. Ask Claude
    const generated = await generateDailyCoachingNote(recentWorkouts, settings.goal);

    // 4. Cache in DynamoDB
    const noteRecord = {
      ...generated,
      date: today,
      generatedAt: new Date().toISOString(),
    };
    await saveCoachingNote(noteRecord);

    res.json({ note: noteRecord });
  } catch (err: any) {
    console.error('Coaching note error:', err);
    res.status(500).json({ error: 'Failed to generate coaching note', details: err.message });
  }
});

export default router;
