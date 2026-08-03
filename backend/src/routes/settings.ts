import { Router, Request, Response } from 'express';
import { getSettings, saveSettings } from '../services/dynamodbService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    await saveSettings(settings);
    res.json({ settings, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
