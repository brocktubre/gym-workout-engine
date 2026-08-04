import { Router, Request, Response } from 'express';
import { getSettings } from '../services/dynamodbService';
import {
  getOrCreateUserProfile,
  updateUserProfile,
  DEFAULT_PREFERENCES,
} from '../services/userService';

const router = Router();

// GET /api/settings
// Authenticated → user's persisted preferences from DynamoDB profile
// Anonymous     → default settings (allows anonymous users to browse the app)
router.get('/', async (req: Request, res: Response) => {
  try {
    if (req.user) {
      const profile = await getOrCreateUserProfile(req.user.sub, req.user.email);
      const settings = {
        ...profile.preferences,
        displayName: profile.displayName,
      };
      res.json({ settings });
      return;
    }
    // Anonymous: fall back to global defaults (legacy behavior)
    const settings = await getSettings().catch(() => DEFAULT_PREFERENCES);
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PUT /api/settings — authenticated only
router.put('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const { displayName, ...prefs } = req.body ?? {};
    const profile = await getOrCreateUserProfile(req.user.sub, req.user.email);
    const merged = await updateUserProfile(req.user.sub, {
      ...(typeof displayName === 'string' ? { displayName } : {}),
      preferences: { ...profile.preferences, ...prefs },
    });
    res.json({
      settings: {
        ...merged.preferences,
        displayName: merged.displayName,
      },
      message: 'Settings saved successfully',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
