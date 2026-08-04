import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { UserSettings } from '../types';

const TABLE_NAME = process.env.TABLE_NAME || 'gym-workout-engine-prod';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);

export interface UserPreferences extends Partial<UserSettings> {
  theme?: string;
  darkMode?: boolean;
  weightUnit?: 'lbs' | 'kg';
  restTimerSeconds?: number;
  defaultWorkoutLength?: number;
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
}

export interface UserProfile {
  sub: string;
  email: string;
  displayName?: string;
  createdDate: string;
  lastLogin: string;
  preferences: UserPreferences;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  availableEquipment: [
    'barbell', 'dumbbell', 'kettlebell', 'bodyweight',
    'rings', 'pull-up-bar', 'resistance-band',
    'battle-rope', 'sled', 'plyometric-box', 'weight-vest',
    'sandbag', 'medicine-ball', 'echo-bike', 'rower', 'ski-erg', 'hip-circle-band',
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
  weightUnit: 'lbs',
  soundEnabled: true,
  notificationsEnabled: false,
};

function pk(sub: string) {
  return `USER#${sub}`;
}

function stripKeys<T extends Record<string, any>>(item: T): T {
  const { PK, SK, entityType, ...rest } = item as any;
  return rest as T;
}

export async function getUserProfile(sub: string): Promise<UserProfile | null> {
  const result = await client.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk(sub), SK: 'PROFILE' },
  }));
  if (!result.Item) return null;
  return stripKeys(result.Item) as UserProfile;
}

export async function getOrCreateUserProfile(sub: string, email: string): Promise<UserProfile> {
  const existing = await getUserProfile(sub);
  const now = new Date().toISOString();
  if (existing) {
    // Touch lastLogin (best-effort; do not fail if it errors)
    const updated: UserProfile = { ...existing, lastLogin: now };
    await client.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: pk(sub),
        SK: 'PROFILE',
        entityType: 'UserProfile',
        ...updated,
      },
    })).catch(() => {});
    return updated;
  }
  const profile: UserProfile = {
    sub,
    email,
    createdDate: now,
    lastLogin: now,
    preferences: { ...DEFAULT_PREFERENCES },
  };
  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: pk(sub),
      SK: 'PROFILE',
      entityType: 'UserProfile',
      ...profile,
    },
  }));
  return profile;
}

export async function updateUserProfile(
  sub: string,
  updates: Partial<UserProfile>,
): Promise<UserProfile> {
  const existing = await getUserProfile(sub);
  if (!existing) throw new Error(`User profile ${sub} not found`);
  const merged: UserProfile = {
    ...existing,
    ...updates,
    preferences: { ...existing.preferences, ...(updates.preferences ?? {}) },
    lastLogin: new Date().toISOString(),
  };
  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: pk(sub),
      SK: 'PROFILE',
      entityType: 'UserProfile',
      ...merged,
    },
  }));
  return merged;
}

export async function getUserPreferences(sub: string): Promise<UserPreferences> {
  const profile = await getUserProfile(sub);
  return profile?.preferences ?? { ...DEFAULT_PREFERENCES };
}

export async function updateUserPreferences(
  sub: string,
  email: string,
  prefs: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const profile = await getOrCreateUserProfile(sub, email);
  const nextPrefs = { ...profile.preferences, ...prefs };
  const updated = await updateUserProfile(sub, { preferences: nextPrefs });
  return updated.preferences;
}

export { DEFAULT_PREFERENCES };
