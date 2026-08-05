import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const MW_BASE = 'https://api.musclewiki.com';
const TABLE_NAME = process.env.TABLE_NAME || 'gym-workout-engine-prod';
const REGION = process.env.AWS_REGION || 'us-east-1';

const secretsClient = new SecretsManagerClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);

let cachedApiKey: string | null = null;

/** Raised when the API key cannot be resolved — a config problem, not an upstream failure. */
export class MuscleWikiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MuscleWikiConfigError';
  }
}

export async function getMuscleWikiApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  // Local dev escape hatch: avoids needing secretsmanager:GetSecretValue.
  // Lambda has no such env var and always reads from Secrets Manager.
  const fromEnv = process.env.MUSCLE_WIKI_API_KEY?.trim();
  if (fromEnv) {
    cachedApiKey = fromEnv;
    return fromEnv;
  }

  let secretString: string | undefined;
  try {
    const result = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: 'open-claw-secrets' }),
    );
    secretString = result.SecretString;
  } catch (err) {
    throw new MuscleWikiConfigError(
      `Unable to read open-claw-secrets (${(err as Error).name}). ` +
      'Grant secretsmanager:GetSecretValue or set MUSCLE_WIKI_API_KEY for local dev.',
    );
  }

  const secrets = JSON.parse(secretString || '{}');
  const key = secrets['muscle-wiki-api-key'];
  if (!key) {
    throw new MuscleWikiConfigError('muscle-wiki-api-key not found in open-claw-secrets');
  }
  cachedApiKey = key;
  return key;
}

async function mwFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const apiKey = await getMuscleWikiApiKey();
  const url = path.startsWith('http') ? path : `${MW_BASE}${path}`;
  const headers = new Headers(init.headers);
  headers.set('X-API-Key', apiKey);
  const resp = await fetch(url, { ...init, headers });

  // 401/403 are account-level problems (bad key, or a plan that forbids direct
  // API access) rather than transient upstream failures — report them as config.
  if (resp.status === 401 || resp.status === 403) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.clone().json() as { detail?: string; message?: string };
      detail = body.detail ?? body.message ?? detail;
    } catch {
      // non-JSON body — keep the status code
    }
    throw new MuscleWikiConfigError(detail);
  }

  return resp;
}

// ── DynamoDB mapping cache ───────────────────────────────────────────────────

export type MappingStatus = 'hit' | 'miss';

export interface MuscleWikiMapping {
  status: MappingStatus;
  muscleWikiId?: number;
  muscleWikiName?: string;
  /** Cached demo stream path; when present, metadata requests skip MuscleWiki entirely. */
  streamPath?: string;
  queriedName: string;
  updatedAt: string;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mappingKeys(exerciseId?: string, name?: string): { PK: string; SK: string } | null {
  if (exerciseId?.trim()) {
    return { PK: 'MUSCLEWIKI#MAP', SK: `EXERCISE#${exerciseId.trim()}` };
  }
  if (name?.trim()) {
    return { PK: 'MUSCLEWIKI#MAP', SK: `WARMUP#${normalizeName(name)}` };
  }
  return null;
}

export async function getMapping(
  exerciseId?: string,
  name?: string,
): Promise<MuscleWikiMapping | null> {
  const keys = mappingKeys(exerciseId, name);
  if (!keys) return null;
  const result = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: keys,
  }));
  if (!result.Item) return null;
  const { PK, SK, entityType, ...rest } = result.Item;
  return rest as MuscleWikiMapping;
}

async function putMapping(
  keys: { PK: string; SK: string },
  mapping: MuscleWikiMapping,
): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ...keys,
      entityType: 'MuscleWikiMapping',
      ...mapping,
    },
  }));
}

export async function putHit(
  exerciseId: string | undefined,
  name: string,
  muscleWikiId: number,
  muscleWikiName: string,
  streamPath: string,
): Promise<void> {
  const keys = mappingKeys(exerciseId, name);
  if (!keys) return;
  await putMapping(keys, {
    status: 'hit',
    muscleWikiId,
    muscleWikiName,
    streamPath,
    queriedName: name,
    updatedAt: new Date().toISOString(),
  });
}

export async function putMiss(exerciseId: string | undefined, name: string): Promise<void> {
  const keys = mappingKeys(exerciseId, name);
  if (!keys) return;
  await putMapping(keys, {
    status: 'miss',
    queriedName: name,
    updatedAt: new Date().toISOString(),
  });
}

// ── MuscleWiki API ───────────────────────────────────────────────────────────

export interface SearchHit {
  id: number;
  name: string;
}

export interface MwVideo {
  url?: string;
  gender?: string;
  angle?: string;
  branded?: boolean | string;
  unbranded?: string;
  [key: string]: unknown;
}

export async function searchExercise(name: string): Promise<SearchHit[]> {
  const qs = new URLSearchParams({ q: name, limit: '5' });
  const resp = await mwFetch(`/search?${qs.toString()}`);
  if (!resp.ok) {
    throw new Error(`MuscleWiki search failed: ${resp.status}`);
  }
  const data = await resp.json() as unknown;
  // Support both `{ results: [...] }` and bare array shapes
  const results = Array.isArray(data)
    ? data
    : (data as { results?: unknown[] }).results ?? (data as { exercises?: unknown[] }).exercises ?? [];
  return (results as Array<{ id?: number; name?: string }>)
    .filter((r) => typeof r.id === 'number' && typeof r.name === 'string')
    .map((r) => ({ id: r.id as number, name: r.name as string }));
}

export async function getExerciseVideos(id: number): Promise<MwVideo[]> {
  const resp = await mwFetch(`/exercises/${id}/videos`);
  if (!resp.ok) {
    throw new Error(`MuscleWiki videos failed: ${resp.status}`);
  }
  const data = await resp.json() as unknown;
  if (Array.isArray(data)) return data as MwVideo[];
  const obj = data as { videos?: MwVideo[]; results?: MwVideo[] };
  return obj.videos ?? obj.results ?? [];
}

/** Pull a usable /stream/videos/... path from a video object or absolute URL. */
function extractStreamPath(video: MwVideo): string | null {
  const candidates: string[] = [];
  if (typeof video.unbranded === 'string') candidates.push(video.unbranded);
  if (typeof video.url === 'string') candidates.push(video.url);
  if (typeof video.branded === 'string') candidates.push(video.branded);
  for (const value of Object.values(video)) {
    if (typeof value === 'string' && value.includes('/stream/videos/')) {
      candidates.push(value);
    }
  }

  for (const candidate of candidates) {
    try {
      const pathname = candidate.startsWith('http')
        ? new URL(candidate).pathname
        : candidate.startsWith('/')
          ? candidate
          : `/${candidate}`;
      if (pathname.startsWith('/stream/videos/')) return pathname;
      // Bare filename → assume unbranded
      if (/^[a-zA-Z0-9._-]+\.mp4$/i.test(candidate)) {
        return `/stream/videos/unbranded/${candidate}`;
      }
    } catch {
      // ignore bad URLs
    }
  }
  return null;
}

function scoreVideo(video: MwVideo, path: string): number {
  let score = 0;
  const lower = `${path} ${video.gender ?? ''} ${video.angle ?? ''}`.toLowerCase();
  if (lower.includes('unbranded')) score += 40;
  if (lower.includes('male') && !lower.includes('female')) score += 30;
  if (lower.includes('front')) score += 20;
  if (lower.includes('branded')) score -= 10;
  return score;
}

export function resolveDemo(videos: MwVideo[]): string | null {
  const scored = videos
    .map((v) => {
      const path = extractStreamPath(v);
      return path ? { path, score: scoreVideo(v, path) } : null;
    })
    .filter((x): x is { path: string; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.path ?? null;
}

export function isAllowedStreamPath(path: string): boolean {
  // Only /stream/videos/branded|unbranded/<safe-filename>
  return /^\/stream\/videos\/(branded|unbranded)\/[A-Za-z0-9._-]+$/.test(path);
}

export async function proxyStream(
  path: string,
  rangeHeader?: string,
): Promise<{ status: number; headers: Headers; body: ArrayBuffer }> {
  if (!isAllowedStreamPath(path)) {
    throw new Error('Invalid stream path');
  }
  const headers: Record<string, string> = {};
  if (rangeHeader) headers.Range = rangeHeader;
  const resp = await mwFetch(path, { headers });
  const body = await resp.arrayBuffer();
  return { status: resp.status, headers: resp.headers, body };
}

export class VideoNotFoundError extends Error {
  constructor(message = 'No video found for this exercise') {
    super(message);
    this.name = 'VideoNotFoundError';
  }
}

/**
 * Resolve a demo video for an exercise/warmup name.
 * Uses DynamoDB cache; only calls MuscleWiki when the mapping (or stream path) is missing.
 * Once a hit with streamPath is cached, metadata requests make zero MuscleWiki calls.
 * Playback still proxies bytes from MuscleWiki via /video/stream.
 */
export async function resolveExerciseVideo(params: {
  name: string;
  exerciseId?: string;
}): Promise<{ muscleWikiId: number; matchedName: string; streamPath: string }> {
  const name = params.name.trim();
  if (!name) throw new VideoNotFoundError('Exercise name is required');

  const stored = await getMapping(params.exerciseId, name);
  // Entries are keyed by exerciseId, so a renamed exercise would otherwise keep
  // resolving to the movement matched under its old name.
  const cached = stored && normalizeName(stored.queriedName) === normalizeName(name)
    ? stored
    : null;
  if (cached?.status === 'miss') {
    throw new VideoNotFoundError();
  }

  // Full cache hit: ID + stream path already known — no MuscleWiki calls.
  if (
    cached?.status === 'hit'
    && typeof cached.muscleWikiId === 'number'
    && typeof cached.streamPath === 'string'
    && isAllowedStreamPath(cached.streamPath)
  ) {
    return {
      muscleWikiId: cached.muscleWikiId,
      matchedName: cached.muscleWikiName ?? name,
      streamPath: cached.streamPath,
    };
  }

  let muscleWikiId = cached?.status === 'hit' ? cached.muscleWikiId : undefined;
  let matchedName = cached?.muscleWikiName ?? name;

  if (muscleWikiId === undefined) {
    const hits = await searchExercise(name);
    const best = hits.find((hit) => normalizeName(hit.name) === normalizeName(name)) ?? hits[0];
    if (!best) {
      await putMiss(params.exerciseId, name);
      throw new VideoNotFoundError();
    }
    muscleWikiId = best.id;
    matchedName = best.name;
  }

  // Legacy hits (ID only) or fresh searches still need the videos endpoint once.
  const videos = await getExerciseVideos(muscleWikiId);
  const streamPath = resolveDemo(videos);
  if (!streamPath) {
    await putMiss(params.exerciseId, name);
    throw new VideoNotFoundError('No streamable video for this exercise');
  }

  await putHit(params.exerciseId, name, muscleWikiId, matchedName, streamPath);
  return { muscleWikiId, matchedName, streamPath };
}
