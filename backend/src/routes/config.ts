import { Router, Request, Response } from 'express';
import { getFeatureFlags, saveFeatureFlags } from '../services/dynamodbService';

const router = Router();

// GET /api/config/features — public
// Returns global feature flags. Defaults to all features enabled if item not yet in DynamoDB.
router.get('/features', async (_req: Request, res: Response) => {
  try {
    const flags = await getFeatureFlags();
    res.json({ flags });
  } catch (err) {
    console.error('Failed to load feature flags:', err);
    res.status(500).json({ error: 'Failed to load feature flags' });
  }
});

// POST /api/config/features/seed — force-creates the default item; idempotent
// Remove or lock this down once the item is confirmed in DynamoDB
router.post('/features/seed', async (_req: Request, res: Response) => {
  try {
    const flags = await saveFeatureFlags({ videoPlaybackEnabled: true });
    res.json({ seeded: true, flags });
  } catch (err) {
    console.error('Seed failed:', err);
    res.status(500).json({ error: 'Seed failed', detail: (err as Error).message });
  }
});

// PUT /api/config/features — admin only (requires X-Admin-Secret header)
// Allows toggling feature flags without a redeployment.
// Set ADMIN_SECRET env var on the Lambda to protect this endpoint.
router.put('/features', async (req: Request, res: Response) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers['x-admin-secret'];

  if (!adminSecret || providedSecret !== adminSecret) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { videoPlaybackEnabled } = req.body ?? {};

  if (typeof videoPlaybackEnabled !== 'boolean') {
    res.status(400).json({ error: 'videoPlaybackEnabled must be a boolean' });
    return;
  }

  try {
    const updated = await saveFeatureFlags({ videoPlaybackEnabled });
    res.json({ flags: updated });
  } catch (err) {
    console.error('Failed to save feature flags:', err);
    res.status(500).json({ error: 'Failed to save feature flags' });
  }
});

export default router;
