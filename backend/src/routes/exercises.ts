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

/** API Gateway caps a Lambda response at 6 MB, and base64 inflates bytes by ~33%. */
const MAX_STREAM_CHUNK_BYTES = 3 * 1024 * 1024;

/** Bound open-ended ranges so one response can never exceed the Lambda payload cap. */
function clampRangeHeader(rangeHeader?: string): string {
  const raw = (rangeHeader ?? '').trim();
  // Suffix ranges (bytes=-N) fetch trailing metadata and are always small.
  if (/^bytes=-\d+$/.test(raw)) return raw;
  const match = /^bytes=(\d+)-(\d+)?$/.exec(raw);
  const start = match ? Number(match[1]) : 0;
  const maxEnd = start + MAX_STREAM_CHUNK_BYTES - 1;
  const requestedEnd = match?.[2] ? Number(match[2]) : undefined;
  const end = requestedEnd === undefined ? maxEnd : Math.min(requestedEnd, maxEnd);
  return `bytes=${start}-${end}`;
}

/** Parse `bytes start-end/total` into its numeric parts. */
function parseContentRange(value: string | null): { start: number; end: number; total: number } | null {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value ?? '');
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]), total: Number(match[3]) };
}

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

    const clientRange = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const upstream = await proxyStream(path, clampRangeHeader(clientRange));
    const body = Buffer.from(upstream.body);

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    res.setHeader('Content-Type', contentType);
    // helmet defaults CORP to same-origin, which blocks <video> when the SPA is
    // served from a different origin than the API (localhost:5173 → :3001)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
    res.setHeader('Cache-Control', upstream.headers.get('cache-control') || 'private, max-age=3600');
    res.setHeader('Content-Length', String(body.length));

    const range = parseContentRange(upstream.headers.get('content-range'));
    // We always send upstream a Range, so answer 200 when the client didn't ask
    // for one and the clamped chunk turned out to be the whole file.
    const isWholeFile = range !== null && range.start === 0 && range.end === range.total - 1;
    if (!clientRange && isWholeFile) {
      res.status(200);
    } else {
      res.status(upstream.status);
      if (range) res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${range.total}`);
    }

    res.send(body);
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
