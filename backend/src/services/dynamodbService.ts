import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

/** Thrown when an optimistic-lock condition fails (another device modified the record first) */
export class ConflictError extends Error {
  constructor(message = 'Workout was modified by another device. Please refresh.') {
    super(message);
    this.name = 'ConflictError';
  }
}
import { Workout, UserSettings, WorkoutStats, MuscleGroup } from '../types';

const TABLE_NAME = process.env.TABLE_NAME || 'gym-workout-engine-prod';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const DEFAULT_SETTINGS: UserSettings = {
  availableEquipment: [
    'barbell', 'dumbbell', 'kettlebell', 'bodyweight',
    'rings', 'pull-up-bar', 'resistance-band',
    'battle-rope', 'sled', 'plyometric-box', 'weight-vest',
    'sandbag', 'medicine-ball', 'echo-bike', 'rower', 'ski-erg', 'hip-circle-band', 'plate',
  ],
  goal: 'hypertrophy',
  fitnessLevel: 'intermediate',
  defaultDurationMinutes: 60,
  restBetweenSetsSeconds: 90,
  fatigueWindowHours: 48,
  exerciseVarietyDays: 7,
  preferCompound: true,
  includeWarmup: true,
  allowSupersets: true,
  voiceCoachingEnabled: true,
};

export async function getSettings(): Promise<UserSettings> {
  try {
    const result = await client.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: 'SETTINGS', SK: 'USER' },
    }));
    if (!result.Item) return { ...DEFAULT_SETTINGS };
    const { PK, SK, entityType, ...settings } = result.Item;
    return settings as UserSettings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: 'SETTINGS',
      SK: 'USER',
      entityType: 'Settings',
      updatedAt: new Date().toISOString(),
      ...settings,
    },
  }));
}

export async function saveWorkout(workout: Workout): Promise<void> {
  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `WORKOUT#${workout.date}`,
      SK: `WORKOUT#${workout.id}`,
      GSI1PK: 'WORKOUT',
      GSI1SK: workout.createdAt,
      entityType: 'Workout',
      ...workout,
    },
  }));
}

export async function getWorkout(date: string, id: string): Promise<Workout | null> {
  const result = await client.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `WORKOUT#${date}`, SK: `WORKOUT#${id}` },
  }));
  if (!result.Item) return null;
  const { PK, SK, GSI1PK, GSI1SK, entityType, ...workout } = result.Item;
  return workout as Workout;
}

/**
 * Versioned update with optimistic locking.
 * @param expectedVersion  The version the caller believes is current.
 *   If supplied and it does not match the DDB record, throws ConflictError.
 *   If omitted, only the DDB condition expression (TOCTOU guard) applies.
 */
export async function updateWorkout(
  date: string,
  id: string,
  updates: Partial<Workout>,
  expectedVersion?: number,
): Promise<Workout> {
  const existing = await getWorkout(date, id);
  if (!existing) throw new Error(`Workout ${id} not found`);

  // Application-level version check (catches stale-client scenarios)
  if (
    expectedVersion !== undefined &&
    existing.version !== undefined &&
    expectedVersion !== existing.version
  ) {
    throw new ConflictError();
  }

  const currentVersion = existing.version ?? 0;
  const newVersion = currentVersion + 1;
  // Strip client-supplied version from updates so we control it
  const { version: _v, ...safeUpdates } = updates as Workout;
  const merged: Workout = { ...existing, ...safeUpdates, version: newVersion };

  const item = {
    PK: `WORKOUT#${date}`,
    SK: `WORKOUT#${id}`,
    GSI1PK: 'WORKOUT',
    GSI1SK: merged.createdAt,
    entityType: 'Workout',
    ...merged,
  };

  try {
    await client.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      // Condition: either no version exists yet (first update) or version matches
      ConditionExpression: 'attribute_not_exists(#ver) OR #ver = :expected',
      ExpressionAttributeNames: { '#ver': 'version' },
      ExpressionAttributeValues: { ':expected': currentVersion },
    }));
  } catch (err: any) {
    if (err?.name === 'ConditionalCheckFailedException') {
      throw new ConflictError();
    }
    throw err;
  }

  return merged;
}

export async function getWorkoutsInRange(startDate: string, endDate: string, userId?: string): Promise<Workout[]> {
  const start = `WORKOUT#${startDate}`;
  const end = `WORKOUT#${endDate}\xff`;

  const filterParts = ['#pk BETWEEN :start AND :end', 'begins_with(#sk, :skPrefix)'];
  const attrNames: Record<string, string>  = { '#pk': 'PK', '#sk': 'SK' };
  const attrValues: Record<string, unknown> = { ':start': start, ':end': end, ':skPrefix': 'WORKOUT#' };

  if (userId) {
    filterParts.push('userId = :userId');
    attrValues[':userId'] = userId;
  }

  const result = await client.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: filterParts.join(' AND '),
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
  }));

  return (result.Items || []).map(item => {
    const { PK, SK, GSI1PK, GSI1SK, entityType, ...workout } = item;
    return workout as Workout;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getRecentWorkouts(days: number, userId?: string): Promise<Workout[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const startDate = cutoff.toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  return getWorkoutsInRange(startDate, endDate, userId);
}

export async function getStats(userId?: string): Promise<WorkoutStats> {
  const workouts = await getRecentWorkouts(90, userId);
  const completed = workouts.filter(w => w.status === 'completed');

  let totalVolumeKg = 0;
  const exerciseCounts: Record<string, number> = {};
  const muscleFreq: Partial<Record<MuscleGroup, number>> = {};

  for (const w of completed) {
    for (const ex of w.exercises) {
      exerciseCounts[ex.exerciseId] = (exerciseCounts[ex.exerciseId] || 0) + 1;
      const muscle = ex.exercise.primaryMuscle;
      muscleFreq[muscle] = (muscleFreq[muscle] || 0) + 1;
      for (const set of ex.sets) {
        if (set.completed && set.completedWeight && set.completedReps) {
          totalVolumeKg += set.completedWeight * set.completedReps;
        }
      }
    }
  }

  // Streak calculation
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  const workoutDates = new Set(completed.map(w => w.date));
  for (let i = 0; i <= 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (workoutDates.has(ds)) {
      streak++;
      if (i === 0 || currentStreak > 0) currentStreak = streak;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      if (i === 0) currentStreak = 0;
      streak = 0;
    }
  }

  const avgDuration = completed.length > 0
    ? completed.reduce((sum, w) => sum + (w.actualDurationMinutes || w.targetDurationMinutes), 0) / completed.length
    : 0;

  const favoriteExercise = Object.entries(exerciseCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

  return {
    totalWorkouts: completed.length,
    currentStreak,
    longestStreak,
    totalVolumeKg: Math.round(totalVolumeKg),
    averageDurationMinutes: Math.round(avgDuration),
    favoriteExercise,
    muscleGroupFrequency: muscleFreq,
  };
}

export async function deleteWorkout(date: string, id: string): Promise<void> {
  await client.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: `WORKOUT#${date}`, SK: `WORKOUT#${id}` },
  }));
}

// ---------------------------------------------------------------------------
// Coaching note cache (one per calendar date)
// ---------------------------------------------------------------------------

export interface CachedCoachingNote {
  note: string;
  suggestedMuscles: string[];
  suggestedGoal?: string;
  date: string;
  generatedAt: string;
}

export async function getCachedCoachingNote(date: string): Promise<CachedCoachingNote | null> {
  try {
    const result = await client.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: 'COACHING', SK: `NOTE#${date}` },
    }));
    if (!result.Item) return null;
    const { PK, SK, entityType, ...note } = result.Item;
    return note as CachedCoachingNote;
  } catch {
    return null;
  }
}

export async function saveCoachingNote(note: CachedCoachingNote): Promise<void> {
  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: 'COACHING',
      SK: `NOTE#${note.date}`,
      entityType: 'CoachingNote',
      ...note,
    },
  }));
}

// ---------------------------------------------------------------------------
// Per-user active workout state
// PK: USER#<sub>  SK: ACTIVE_WORKOUT
// Stores the full workout + turn index so any device can restore the session.
// ---------------------------------------------------------------------------

export interface ActiveWorkoutState {
  workout: import('../types').Workout;
  turnIndex: number;
  isPaused: boolean;
  savedAt: string;
}

export async function saveActiveWorkoutState(sub: string, state: ActiveWorkoutState): Promise<void> {
  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `USER#${sub}`,
      SK: 'ACTIVE_WORKOUT',
      entityType: 'ActiveWorkout',
      ...state,
    },
  }));
}

export async function getActiveWorkoutState(sub: string): Promise<ActiveWorkoutState | null> {
  try {
    const result = await client.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${sub}`, SK: 'ACTIVE_WORKOUT' },
    }));
    if (!result.Item) return null;
    const { PK, SK, entityType, ...state } = result.Item;
    return state as ActiveWorkoutState;
  } catch {
    return null;
  }
}

export async function deleteActiveWorkoutState(sub: string): Promise<void> {
  await client.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${sub}`, SK: 'ACTIVE_WORKOUT' },
  }));
}

// ── Feature Flags ────────────────────────────────────────────────────────────

export interface FeatureFlags {
  videoPlaybackEnabled: boolean;
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  videoPlaybackEnabled: true,
};

export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const result = await client.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: 'CONFIG', SK: 'FEATURES' },
    }));
    if (!result.Item) return { ...DEFAULT_FEATURE_FLAGS };
    const { PK, SK, entityType, updatedAt, ...flags } = result.Item;
    return { ...DEFAULT_FEATURE_FLAGS, ...flags } as FeatureFlags;
  } catch {
    return { ...DEFAULT_FEATURE_FLAGS };
  }
}

export async function saveFeatureFlags(flags: Partial<FeatureFlags>): Promise<FeatureFlags> {
  const current = await getFeatureFlags();
  const updated: FeatureFlags = { ...current, ...flags };
  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: 'CONFIG',
      SK: 'FEATURES',
      entityType: 'FeatureFlags',
      updatedAt: new Date().toISOString(),
      ...updated,
    },
  }));
  return updated;
}

// ---------------------------------------------------------------------------
// Per-user daily workout plan
// PK: USER#<sub>  SK: DAILY#YYYY-MM-DD  (client local calendar date)
// Generated once per day; survives start/pause; cleared when marked completed.
// ---------------------------------------------------------------------------

export interface DailyWorkoutRecord {
  localDate: string;
  status: 'available' | 'completed';
  targetMuscleGroups: MuscleGroup[];
  workout: Workout;
  createdAt: string;
  completedAt?: string;
}

export async function getDailyWorkout(
  sub: string,
  localDate: string,
): Promise<DailyWorkoutRecord | null> {
  try {
    const result = await client.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${sub}`, SK: `DAILY#${localDate}` },
    }));
    if (!result.Item) return null;
    const { PK, SK, entityType, ...record } = result.Item;
    return record as DailyWorkoutRecord;
  } catch {
    return null;
  }
}

export async function saveDailyWorkout(
  sub: string,
  record: DailyWorkoutRecord,
): Promise<void> {
  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `USER#${sub}`,
      SK: `DAILY#${record.localDate}`,
      entityType: 'DailyWorkout',
      ...record,
    },
  }));
}
