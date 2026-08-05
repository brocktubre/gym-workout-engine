import { Router, Request, Response } from 'express';
import { getExerciseById, filterExercises, getAllEquipment } from '../services/exerciseService';
import {
  resolveExerciseVideo,
  proxyStream,
  isAllowedStreamPath,
  VideoNotFoundError,
  MuscleWikiConfigError,
} from '../services/muscleWikiService';
import { MuscleGroup, Equipment } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { muscle, equipment, search } = req.query;
  const exercises = filterExercises({
    muscle: muscle as MuscleGroup | undefined,
    equipment: equipment as Equipment | undefined,
    search: search as string | undefined,
  });
  res.json({ exercises, total: exercises.length });
});

// GET /api/exercises/equipment — full equipment inventory
router.get('/equipment', (_req: Request, res: Response) => {
  const equipment = getAllEquipment();
  res.json({ equipment, total: equipment.length });
});

/**
 * GET /api/exercises/video?name=&exerciseId=
 * On-demand MuscleWiki lookup (search + videos), with DynamoDB hit/miss cache.
 * Cache stores muscleWikiId + streamPath so repeat opens skip MuscleWiki until play.
 * Only called when the user taps Watch video.
 */
router.get('/video', async (req: Request, res: Response) => {
  try {
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    const exerciseId = typeof req.query.exerciseId === 'string' ? req.query.exerciseId : undefined;
    if (!name.trim()) {
      res.status(400).json({ error: 'name query parameter is required' });
      return;
    }

    const result = await resolveExerciseVideo({ name, exerciseId });
    const streamUrl = `/exercises/video/stream?path=${encodeURIComponent(result.streamPath)}`;
    res.json({
      muscleWikiId: result.muscleWikiId,
      matchedName: result.matchedName,
      streamUrl,
      streamPath: result.streamPath,
    });
  } catch (err) {
    if (err instanceof VideoNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof MuscleWikiConfigError) {
      console.error('[exercises/video] config:', err.message);
      res.status(503).json({ error: `MuscleWiki not configured: ${err.message}` });
      return;
    }
    console.error('[exercises/video]', err);
    res.status(502).json({ error: `Failed to load exercise video: ${(err as Error).message}` });
  }
});

/**
 * GET /api/exercises/video/stream?path=/stream/videos/unbranded/...
 * Proxies MuscleWiki media with X-API-Key so <video> can play + seek (Range).
 */
router.get('/video/stream', async (req: Request, res: Response) => {
  try {
    const path = typeof req.query.path === 'string' ? req.query.path : '';
    if (!path || !isAllowedStreamPath(path)) {
      res.status(400).json({ error: 'Invalid or missing stream path' });
      return;
    }

    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const upstream = await proxyStream(path, rangeHeader);

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    // helmet defaults CORP to same-origin, which blocks <video> when the SPA is
    // served from a different origin than the API (localhost:5173 → :3001)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const cacheControl = upstream.headers.get('cache-control');
    res.setHeader('Cache-Control', cacheControl || 'private, max-age=3600');

    res.send(Buffer.from(upstream.body));
  } catch (err) {
    if (err instanceof MuscleWikiConfigError) {
      console.error('[exercises/video/stream] config:', err.message);
      res.status(503).json({ error: `MuscleWiki not configured: ${err.message}` });
      return;
    }
    console.error('[exercises/video/stream]', err);
    res.status(502).json({ error: 'Failed to stream exercise video' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  const exercise = getExerciseById(req.params.id);
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }
  res.json({ exercise });
});

export default router;
