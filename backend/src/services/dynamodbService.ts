import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
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
    'rings', 'pull-up-bar', 'landmine', 'resistance-band',
    'battle-rope', 'sled', 'plyometric-box', 'weight-vest',
    'sandbag', 'medicine-ball', 'echo-bike', 'rower', 'ski-erg',
  ],
  goal: 'hypertrophy',
  fitnessLevel: 'intermediate',
  defaultDurationMinutes: 60,
  restBetweenSetsSeconds: 90,
  fatigueWindowHours: 48,
  exerciseVarietyDays: 7,
  preferCompound: true,
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

export async function updateWorkout(date: string, id: string, updates: Partial<Workout>): Promise<Workout> {
  const existing = await getWorkout(date, id);
  if (!existing) throw new Error(`Workout ${id} not found`);
  const merged = { ...existing, ...updates };
  await saveWorkout(merged);
  return merged;
}

export async function getWorkoutsInRange(startDate: string, endDate: string): Promise<Workout[]> {
  const start = `WORKOUT#${startDate}`;
  const end = `WORKOUT#${endDate}\xff`;

  const result = await client.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: '#pk BETWEEN :start AND :end AND begins_with(#sk, :skPrefix)',
    ExpressionAttributeNames: { '#pk': 'PK', '#sk': 'SK' },
    ExpressionAttributeValues: { ':start': start, ':end': end, ':skPrefix': 'WORKOUT#' },
  }));

  return (result.Items || []).map(item => {
    const { PK, SK, GSI1PK, GSI1SK, entityType, ...workout } = item;
    return workout as Workout;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getRecentWorkouts(days: number): Promise<Workout[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const startDate = cutoff.toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  return getWorkoutsInRange(startDate, endDate);
}

export async function getStats(): Promise<WorkoutStats> {
  const workouts = await getRecentWorkouts(90);
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
