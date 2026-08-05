import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { WorkoutExercise, UserSettings, Workout, MuscleGroup, WorkoutGoal, WorkoutSet } from '../types';
import {
  AVAILABLE_DUMBBELL_WEIGHTS,
  AVAILABLE_KETTLEBELL_WEIGHTS,
  snapSuggestedWeight,
} from './equipmentWeights';

// ---------------------------------------------------------------------------
// Helper: strip markdown code fences Claude sometimes wraps JSON in
// ---------------------------------------------------------------------------
function extractJson(text: string): string {
  const stripped = text.trim();
  // Match ```json ... ``` or ``` ... ```
  const fenceMatch = stripped.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m);
  if (fenceMatch) return fenceMatch[1].trim();
  return stripped;
}

// ---------------------------------------------------------------------------
// Secrets Manager — cache key after first cold-start fetch
// ---------------------------------------------------------------------------
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
let cachedApiKey: string | null = null;

async function getAnthropicApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  const cmd = new GetSecretValueCommand({ SecretId: 'open-claw-secrets' });
  const result = await secretsClient.send(cmd);
  const secrets = JSON.parse(result.SecretString || '{}');
  const key = secrets['gym-workout-engine-api-key'];
  if (!key) throw new Error('gym-workout-engine-api-key not found in open-claw-secrets');
  cachedApiKey = key;
  return key;
}

/** Goal → allowed set/rep bands used to clamp Claude's load prescriptions. */
const LOAD_BANDS: Record<WorkoutGoal, { sets: [number, number]; reps: [number, number] }> = {
  strength:    { sets: [3, 6], reps: [2, 6] },
  hypertrophy: { sets: [3, 5], reps: [6, 15] },
  endurance:   { sets: [2, 4], reps: [12, 25] },
  'fat-loss':  { sets: [2, 4], reps: [10, 20] },
};

// ---------------------------------------------------------------------------
// Muscle families used by the deterministic superset fallback. Each entry is
// ordered by how well the muscles pair, so a group grown from the front stays
// sensible whether it ends up with 2, 3, or 4 movements.
// ---------------------------------------------------------------------------
const FALLBACK_SUPERSET_FAMILIES: MuscleGroup[][] = [
  ['chest', 'back', 'shoulders', 'core'],
  ['biceps', 'triceps', 'shoulders', 'core'],
  ['quads', 'hamstrings', 'glutes', 'calves'],
  ['back', 'chest', 'biceps', 'triceps'],
];

const MAX_SUPERSET_MEMBERS = 4;

// ---------------------------------------------------------------------------
// Types for Claude's JSON response (superset grouping format)
// ---------------------------------------------------------------------------
interface SupersetGroup {
  /** 'superset' = 2-4 exercises back-to-back; 'standalone' = normal rest.
   *  Claude sometimes answers 'tri-set'/'giant set', so anything other than
   *  'standalone' with 2+ members is treated as a superset group. */
  type: string;
  /** Ordered list of exercise IDs */
  exercises: string[];
}

interface ClaudeGroupResponse {
  groups: SupersetGroup[];
  /**
   * Compact load map: exerciseId → [sets, reps, weightLbs].
   * weightLbs 0 = bodyweight / no external load.
   */
  load?: Record<string, [number, number, number]>;
  reasoning?: string;
}

// ---------------------------------------------------------------------------
// Daily coaching note
// ---------------------------------------------------------------------------

interface CoachingNoteResponse {
  note: string;
  suggestedMuscles: MuscleGroup[];
  suggestedGoal?: WorkoutGoal;
}

export async function generateDailyCoachingNote(
  recentWorkouts: Workout[],
  userGoal: WorkoutGoal,
): Promise<CoachingNoteResponse> {
  const ALL_MUSCLES: MuscleGroup[] = [
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'quads', 'hamstrings', 'glutes', 'core',
  ];

  // Build a compact history: muscle groups hit per workout, sorted recent-first
  const now = Date.now();
  const historyCompact = recentWorkouts
    .filter(w => w.status === 'completed' && w.completedAt)
    .slice(0, 10)
    .map(w => {
      const daysAgo = Math.round((now - new Date(w.completedAt!).getTime()) / 86_400_000);
      const muscles = [...new Set(w.exercises.map(e => e.exercise.primaryMuscle))];
      return { daysAgo, muscles, goal: w.goal };
    });

  // Figure out which muscles haven't been hit recently (for fallback)
  const recentMuscles = new Set(
    historyCompact.filter(w => w.daysAgo <= 2).flatMap(w => w.muscles),
  );
  const freshMuscles = ALL_MUSCLES.filter(m => !recentMuscles.has(m));

  const apiKey = await getAnthropicApiKey();
  const client = new Anthropic({ apiKey, timeout: 10_000 });

  const systemPrompt = `You are a personal trainer giving a brief daily tip.
Based on recent workout history, write ONE concise sentence (under 20 words) telling the user what to focus on today and why.
Also return the 1–3 best muscle groups to train today and the best goal.

RULES:
- Avoid muscles trained within the last 48 hours
- If no history exists, suggest a full-body or compound day
- Return ONLY valid JSON, no markdown

Format: {"note":"...","suggestedMuscles":["quads","hamstrings"],"suggestedGoal":"strength"}
Valid muscles: chest,back,shoulders,biceps,triceps,quads,hamstrings,glutes,core
Valid goals: strength,hypertrophy,endurance,fat-loss`;

  const userMessage = JSON.stringify({
    userGoal,
    freshMuscles,
    recentHistory: historyCompact,
  });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJson(rawText)) as CoachingNoteResponse;

    // Validate muscles
    const validMuscles = (parsed.suggestedMuscles ?? []).filter(m =>
      ALL_MUSCLES.includes(m as MuscleGroup),
    ) as MuscleGroup[];

    return {
      note: parsed.note ?? 'Good time for a full-body session.',
      suggestedMuscles: validMuscles.length > 0 ? validMuscles : (freshMuscles.slice(0, 2) as MuscleGroup[]),
      suggestedGoal: parsed.suggestedGoal ?? userGoal,
    };
  } catch (err) {
    console.error('[Claude] Coaching note failed:', err);
    // Sensible fallback without Claude
    const fallbackMuscles = freshMuscles.slice(0, 2) as MuscleGroup[];
    return {
      note: freshMuscles.length > 0
        ? `Fresh muscles available — good day for ${freshMuscles.slice(0, 2).join(' and ')}.`
        : 'Rest day recommended — most muscle groups need recovery.',
      suggestedMuscles: fallbackMuscles,
      suggestedGoal: userGoal,
    };
  }
}

/** Emit a group as a superset (2-4 members) or as standalone movements. */
function pushGroup(result: WorkoutExercise[], members: WorkoutExercise[]): void {
  if (members.length < 2) {
    for (const ex of members) {
      result.push({ ...ex, supersetGroupId: undefined, supersetOrder: undefined });
    }
    return;
  }

  const groupId = uuidv4();
  // Rest fires once per round rather than per movement, so keep the user's
  // configured rest rather than dividing it across members.
  const supersetRest = members[0].sets[0]?.restSeconds ?? 90;

  members.forEach((ex, i) => {
    result.push({
      ...ex,
      sets: ex.sets.map(s => ({ ...s, restSeconds: supersetRest })),
      supersetGroupId: groupId,
      supersetOrder: i + 1,
    });
  });
}

/** Heavy barbell compounds are better trained on their own. */
function isHeavyCompound(ex: WorkoutExercise): boolean {
  return ex.exercise.equipment === 'barbell' && ex.exercise.category === 'compound';
}

// Cycled so a workout gets a mix of supersets, tri-sets and giant sets rather
// than every group landing on the same size.
const FALLBACK_GROUP_SIZES = [3, 2, 4];

// ---------------------------------------------------------------------------
// Fallback: deterministic superset grouping when Claude is unavailable.
// Builds 2-4 movement groups (superset → tri-set → giant set) from
// complementary muscle families, so a Claude outage doesn't mean pairs only.
// ---------------------------------------------------------------------------
function applyFallbackSupersets(exercises: WorkoutExercise[]): WorkoutExercise[] {
  const result: WorkoutExercise[] = [];
  const processed = new Set<string>();
  let groupCount = 0;

  const canJoin = (members: WorkoutExercise[], candidate: WorkoutExercise) => {
    // Only one barbell can be loaded at a time, so never stack two in a group
    if (candidate.exercise.equipment === 'barbell') {
      if (members.some(m => m.exercise.equipment === 'barbell')) return false;
    }
    // Don't hit the same muscle twice in one round
    return !members.some(m => m.exercise.primaryMuscle === candidate.exercise.primaryMuscle);
  };

  for (const ex of exercises) {
    if (processed.has(ex.exerciseId)) continue;
    processed.add(ex.exerciseId);

    const family = FALLBACK_SUPERSET_FAMILIES.find(f => f.includes(ex.exercise.primaryMuscle));
    if (!family || isHeavyCompound(ex)) {
      result.push({ ...ex, supersetGroupId: undefined, supersetOrder: undefined });
      continue;
    }

    const targetSize = Math.min(
      FALLBACK_GROUP_SIZES[groupCount % FALLBACK_GROUP_SIZES.length],
      MAX_SUPERSET_MEMBERS,
    );
    const members = [ex];

    const take = (partner: WorkoutExercise | undefined) => {
      if (!partner) return;
      processed.add(partner.exerciseId);
      members.push(partner);
    };

    // Walk the family in order so the closest complements are added first
    for (const muscle of family) {
      if (members.length >= targetSize) break;
      if (muscle === ex.exercise.primaryMuscle) continue;

      take(exercises.find(candidate =>
        !processed.has(candidate.exerciseId) &&
        !isHeavyCompound(candidate) &&
        candidate.exercise.primaryMuscle === muscle &&
        canJoin(members, candidate),
      ));
    }

    // Family exhausted before hitting the target — top up with any other
    // unused movement that doesn't repeat a muscle already in the group
    while (members.length < targetSize) {
      const filler = exercises.find(candidate =>
        !processed.has(candidate.exerciseId) &&
        !isHeavyCompound(candidate) &&
        canJoin(members, candidate),
      );
      if (!filler) break;
      take(filler);
    }

    if (members.length >= 2) groupCount++;
    pushGroup(result, members);
  }
  return result;
}

/**
 * Apply Claude's compact [sets, reps, weight] prescriptions onto the draft.
 * Invalid / missing entries keep the rule-engine numbers. DB/KB snaps always run.
 */
function applyLoadPrescriptions(
  exercises: WorkoutExercise[],
  load: Record<string, [number, number, number]> | undefined,
  goal: WorkoutGoal,
): WorkoutExercise[] {
  if (!load) return exercises;
  const band = LOAD_BANDS[goal] ?? LOAD_BANDS.hypertrophy;

  return exercises.map((we) => {
    const prescription = load[we.exerciseId];
    if (!prescription || prescription.length < 3) return we;

    // Holds and timed intervals keep their duration targets — only set count may change
    const isHold = we.sets.some(s => s.targetHoldSeconds !== undefined);
    const isTimed = we.sets.some(s => s.targetDurationSeconds !== undefined);
    if (isHold || isTimed) {
      const [rawSets] = prescription;
      const setCount = Math.min(band.sets[1], Math.max(band.sets[0], Math.round(Number(rawSets) || we.sets.length)));
      if (setCount === we.sets.length) return we;
      const template = we.sets[0];
      const restSeconds = template?.restSeconds ?? 90;
      const sets: WorkoutSet[] = Array.from({ length: setCount }, (_, i) => ({
        ...template,
        setNumber: i + 1,
        completed: false,
        restSeconds,
        completedReps: undefined,
        completedWeight: undefined,
        completedHoldSeconds: undefined,
        completedDurationSeconds: undefined,
      }));
      return { ...we, sets };
    }

    const [rawSets, rawReps, rawWeight] = prescription;
    const setCount = Math.min(band.sets[1], Math.max(band.sets[0], Math.round(Number(rawSets) || we.sets.length)));
    const reps = Math.min(band.reps[1], Math.max(band.reps[0], Math.round(Number(rawReps) || we.sets[0]?.targetReps || 10)));

    const equipment = we.exercise.equipment;
    const noExternalLoad = equipment === 'bodyweight' || equipment === 'rings' || equipment === 'pull-up-bar'
      || we.exercise.category === 'cardio';

    let weight: number | undefined;
    if (noExternalLoad) {
      weight = undefined;
    } else {
      const numeric = Number(rawWeight);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        weight = we.sets[0]?.targetWeight;
      } else {
        weight = snapSuggestedWeight(equipment, numeric);
      }
    }

    const restSeconds = we.sets[0]?.restSeconds ?? 90;
    const sets: WorkoutSet[] = Array.from({ length: setCount }, (_, i) => ({
      setNumber: i + 1,
      targetReps: reps,
      targetWeight: weight,
      completed: false,
      restSeconds,
    }));

    return { ...we, sets };
  });
}

// ---------------------------------------------------------------------------
// Hybrid enhancement: ONE Claude call for supersets + load prescription.
// Token budget is kept tight — compact keys, no secondary muscles, draft
// numbers included as hints so Claude mostly adjusts rather than invents.
// ---------------------------------------------------------------------------
export async function enhanceWorkoutWithClaude(
  draftExercises: WorkoutExercise[],
  settings: UserSettings,
  recentWorkouts: Workout[],
  options?: { durationMinutes?: number; goal?: WorkoutGoal },
): Promise<WorkoutExercise[]> {
  const goal = options?.goal ?? settings.goal;
  const durationMinutes = options?.durationMinutes ?? settings.defaultDurationMinutes ?? 60;
  const allowSupersets = settings.allowSupersets !== false;

  try {
    const apiKey = await getAnthropicApiKey();
    const client = new Anthropic({ apiKey, timeout: 15_000 });

    // --- Compact fatigue (muscle names only) ---
    const now = Date.now();
    const fatigueWindowMs = settings.fatigueWindowHours * 3_600_000;
    const fatigued = new Set<string>();
    for (const w of recentWorkouts) {
      if (!w.completedAt) continue;
      if (now - new Date(w.completedAt).getTime() >= fatigueWindowMs) continue;
      for (const ex of w.exercises) fatigued.add(ex.exercise.primaryMuscle);
    }

    // Last completed performance per exercise — tiny [w,r] hints for progression
    const lastById = new Map<string, [number, number]>();
    for (const w of recentWorkouts) {
      if (w.status !== 'completed') continue;
      for (const ex of w.exercises) {
        if (lastById.has(ex.exerciseId)) continue;
        const done = ex.sets.filter(s => s.completed);
        if (!done.length) continue;
        const avgW = done.reduce((s, x) => s + (x.completedWeight || 0), 0) / done.length;
        const avgR = done.reduce((s, x) => s + (x.completedReps || x.targetReps), 0) / done.length;
        lastById.set(ex.exerciseId, [Math.round(avgW), Math.round(avgR)]);
      }
    }

    // Compact exercise rows: id, name, eq, muscle, category, draft sets/reps/wt, optional last
    const exercises = draftExercises.map(we => {
      const first = we.sets[0];
      const row: Record<string, unknown> = {
        id: we.exerciseId,
        n: we.exercise.name,
        eq: we.exercise.equipment,
        m: we.exercise.primaryMuscle,
        c: we.exercise.category,
        s: we.sets.length,
        r: first?.targetReps ?? 0,
        w: first?.targetWeight ?? 0,
      };
      if (first?.targetHoldSeconds) row.h = first.targetHoldSeconds;
      if (first?.targetDurationSeconds) row.d = first.targetDurationSeconds;
      const last = lastById.get(we.exerciseId);
      if (last) row.last = last;
      return row;
    });

    const user: Record<string, unknown> = {
      goal,
      mins: durationMinutes,
      level: settings.fitnessLevel,
      ss: allowSupersets ? 1 : 0,
    };
    if (settings.sex) user.sex = settings.sex;
    if (settings.bodyWeightLbs) user.wt = settings.bodyWeightLbs;
    if (settings.heightInches) user.ht = settings.heightInches;
    if (fatigued.size) user.fat = [...fatigued];

    // Short system prompt — grouping + load in one response
    const systemPrompt = `Expert trainer. Group exercises + prescribe load. JSON only, no markdown.

GROUPS: type "superset"|"standalone". Superset=2-4 ids. Each id once. No 2 barbells in one group. Prefer antagonist pairings; use 3-4 when safe. If ss=0 every group is standalone. Heavy barbell compounds usually standalone.

LOAD: for EVERY id return load[id]=[sets,reps,weightLbs]. weight 0 = bodyweight/no load. Holds/timed: keep duration, sets only.
DB only ${AVAILABLE_DUMBBELL_WEIGHTS.join(',')}. KB only ${AVAILABLE_KETTLEBELL_WEIGHTS.join(',')}. Never invent other DB/KB.
Use sex/wt/ht/level + goal + draft s/r/w + last[w,r] when present. Prefer progressing from last when completed well.
Rep ranges: strength 2-6, hypertrophy 6-15, endurance 12-25, fat-loss 10-20.

Format: {"groups":[{"type":"superset","exercises":["id1","id2"]}],"load":{"id1":[4,10,50]},"reasoning":"1 sentence"}`;

    const userMessage = JSON.stringify({ user, exercises });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

    let claudeResult: ClaudeGroupResponse;
    try {
      claudeResult = JSON.parse(extractJson(rawText));
    } catch {
      console.warn('[Claude] Invalid JSON — using fallback. Raw:', rawText.slice(0, 200));
      return applyLoadPrescriptions(applyFallbackSupersets(draftExercises), undefined, goal);
    }

    if (!Array.isArray(claudeResult.groups) || claudeResult.groups.length === 0) {
      console.warn('[Claude] Empty groups — using fallback');
      return applyLoadPrescriptions(applyFallbackSupersets(draftExercises), claudeResult.load, goal);
    }

    const draftIds = new Set(draftExercises.map(e => e.exerciseId));
    const allClaudeIds = claudeResult.groups.flatMap(g => g.exercises);
    const uniqueClaudeIds = new Set(allClaudeIds);

    const idMismatch =
      uniqueClaudeIds.size !== draftIds.size ||
      allClaudeIds.length !== draftIds.size ||
      ![...draftIds].every(id => uniqueClaudeIds.has(id));

    if (idMismatch) {
      console.warn('[Claude] Exercise ID mismatch — using fallback');
      return applyLoadPrescriptions(applyFallbackSupersets(draftExercises), claudeResult.load, goal);
    }

    const draftMap = new Map<string, WorkoutExercise>();
    for (const we of draftExercises) draftMap.set(we.exerciseId, we);

    const result: WorkoutExercise[] = [];

    for (const group of claudeResult.groups) {
      const members = group.exercises
        .map(id => draftMap.get(id))
        .filter((e): e is WorkoutExercise => e !== undefined);

      if (members.length === 0) continue;

      const isSuperset = allowSupersets
        && String(group.type).toLowerCase() !== 'standalone'
        && members.length >= 2;

      if (isSuperset) {
        const groupable: WorkoutExercise[] = [];
        const displacedBarbells: WorkoutExercise[] = [];
        let hasBarbell = false;
        for (const ex of members) {
          if (ex.exercise.equipment === 'barbell') {
            if (hasBarbell) {
              displacedBarbells.push(ex);
              continue;
            }
            hasBarbell = true;
          }
          groupable.push(ex);
        }

        for (let i = 0; i < groupable.length; i += MAX_SUPERSET_MEMBERS) {
          pushGroup(result, groupable.slice(i, i + MAX_SUPERSET_MEMBERS));
        }
        for (const ex of displacedBarbells) {
          result.push({ ...ex, supersetGroupId: undefined, supersetOrder: undefined });
        }
      } else {
        for (const ex of members) {
          result.push({ ...ex, supersetGroupId: undefined, supersetOrder: undefined });
        }
      }
    }

    if (result.length !== draftExercises.length) {
      console.warn('[Claude] Output length mismatch — using fallback');
      return applyLoadPrescriptions(applyFallbackSupersets(draftExercises), claudeResult.load, goal);
    }

    const withLoad = applyLoadPrescriptions(result, claudeResult.load, goal);

    const groupSizes = new Map<string, number>();
    for (const ex of withLoad) {
      if (!ex.supersetGroupId) continue;
      groupSizes.set(ex.supersetGroupId, (groupSizes.get(ex.supersetGroupId) ?? 0) + 1);
    }
    const loadCount = claudeResult.load ? Object.keys(claudeResult.load).length : 0;
    console.log(
      `[Claude] groups: ${[...groupSizes.values()].join(', ') || 'none'} | ` +
      `load prescriptions: ${loadCount}/${withLoad.length}`,
    );
    if (claudeResult.reasoning) {
      console.log(`[Claude] ${claudeResult.reasoning}`);
    }

    return withLoad;
  } catch (err: any) {
    console.error('[Claude] Enhancement failed, using fallback:', err?.message ?? err);
    return applyFallbackSupersets(draftExercises);
  }
}

// ---------------------------------------------------------------------------
// Single-exercise load prescription for swaps — tiny prompt, tiny response.
// Falls back to a deterministic band when Claude is unavailable.
// ---------------------------------------------------------------------------

export interface SwapPrescribeInput {
  /** The exercise the user just picked */
  newExercise: {
    id: string;
    name: string;
    primaryMuscle: MuscleGroup;
    equipment: string;
    category: string;
    isHold?: boolean;
    holdSeconds?: number;
    durationSeconds?: number;
  };
  /** Load from the movement being replaced (context for Claude) */
  replaced: {
    name: string;
    equipment: string;
    sets: number;
    reps: number;
    weight: number;
  };
  settings: UserSettings;
  goal: WorkoutGoal;
  durationMinutes?: number;
  /** Optional last completed [weight, reps] for the NEW exercise */
  lastPerformance?: [number, number];
  restSeconds?: number;
}

function buildSetsFromPrescription(
  input: SwapPrescribeInput,
  sets: number,
  reps: number,
  weight: number | undefined,
): WorkoutSet[] {
  const restSeconds = input.restSeconds ?? 90;
  const ex = input.newExercise;

  if (ex.durationSeconds) {
    return Array.from({ length: sets }, (_, i) => ({
      setNumber: i + 1,
      targetReps: 1,
      targetDurationSeconds: ex.durationSeconds,
      completed: false,
      restSeconds,
    }));
  }
  if (ex.isHold && ex.holdSeconds) {
    return Array.from({ length: sets }, (_, i) => ({
      setNumber: i + 1,
      targetReps: 1,
      targetHoldSeconds: ex.holdSeconds,
      completed: false,
      restSeconds,
    }));
  }

  return Array.from({ length: sets }, (_, i) => ({
    setNumber: i + 1,
    targetReps: reps,
    targetWeight: weight,
    completed: false,
    restSeconds,
  }));
}

function fallbackSwapSets(input: SwapPrescribeInput): WorkoutSet[] {
  const band = LOAD_BANDS[input.goal] ?? LOAD_BANDS.hypertrophy;
  const sets = Math.min(band.sets[1], Math.max(band.sets[0], input.replaced.sets || 3));
  const reps = Math.round((band.reps[0] + band.reps[1]) / 2);
  const noLoad = ['bodyweight', 'rings', 'pull-up-bar'].includes(input.newExercise.equipment)
    || input.newExercise.category === 'cardio'
    || input.newExercise.isHold
    || !!input.newExercise.durationSeconds;

  let weight: number | undefined;
  if (!noLoad) {
    if (input.lastPerformance && input.lastPerformance[0] > 0) {
      weight = snapSuggestedWeight(input.newExercise.equipment, input.lastPerformance[0]);
    } else if (input.replaced.weight > 0) {
      // Soft carry from replaced movement, then snap to real inventory
      weight = snapSuggestedWeight(input.newExercise.equipment, input.replaced.weight);
    }
  }

  return buildSetsFromPrescription(input, sets, reps, weight);
}

/**
 * Prescribe sets/reps/weight for a swapped-in movement using a minimal Claude call.
 */
export async function prescribeSwapLoad(input: SwapPrescribeInput): Promise<{
  sets: WorkoutSet[];
  source: 'claude' | 'fallback';
}> {
  const band = LOAD_BANDS[input.goal] ?? LOAD_BANDS.hypertrophy;
  const ex = input.newExercise;

  // Holds / timed — no Claude needed
  if (ex.durationSeconds || (ex.isHold && ex.holdSeconds)) {
    const sets = Math.min(band.sets[1], Math.max(band.sets[0], input.replaced.sets || 3));
    return { sets: buildSetsFromPrescription(input, sets, 1, undefined), source: 'fallback' };
  }

  try {
    const apiKey = await getAnthropicApiKey();
    const client = new Anthropic({ apiKey, timeout: 10_000 });

    const user: Record<string, unknown> = {
      goal: input.goal,
      mins: input.durationMinutes ?? input.settings.defaultDurationMinutes ?? 60,
      level: input.settings.fitnessLevel,
    };
    if (input.settings.sex) user.sex = input.settings.sex;
    if (input.settings.bodyWeightLbs) user.wt = input.settings.bodyWeightLbs;
    if (input.settings.heightInches) user.ht = input.settings.heightInches;

    const payload = {
      user,
      replace: {
        n: input.replaced.name,
        eq: input.replaced.equipment,
        s: input.replaced.sets,
        r: input.replaced.reps,
        w: input.replaced.weight,
      },
      neu: {
        id: ex.id,
        n: ex.name,
        eq: ex.equipment,
        m: ex.primaryMuscle,
        c: ex.category,
        ...(input.lastPerformance ? { last: input.lastPerformance } : {}),
      },
    };

    const systemPrompt = `Prescribe load for ONE swapped exercise. JSON only.
Return {"s":sets,"r":reps,"w":weightLbs}. w=0 means bodyweight/no load.
DB only ${AVAILABLE_DUMBBELL_WEIGHTS.join(',')}. KB only ${AVAILABLE_KETTLEBELL_WEIGHTS.join(',')}.
Match goal rep bands. Use sex/wt/ht/level + replace load + neu.last when present.`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJson(rawText)) as { s?: number; r?: number; w?: number };

    const setCount = Math.min(band.sets[1], Math.max(band.sets[0], Math.round(Number(parsed.s) || input.replaced.sets || 3)));
    const reps = Math.min(band.reps[1], Math.max(band.reps[0], Math.round(Number(parsed.r) || 10)));

    const noLoad = ['bodyweight', 'rings', 'pull-up-bar'].includes(ex.equipment)
      || ex.category === 'cardio';
    let weight: number | undefined;
    if (!noLoad) {
      const numeric = Number(parsed.w);
      if (Number.isFinite(numeric) && numeric > 0) {
        weight = snapSuggestedWeight(ex.equipment, numeric);
      }
    }

    console.log(`[Claude swap] ${ex.name}: ${setCount}×${reps} @ ${weight ?? 0}`);
    return { sets: buildSetsFromPrescription(input, setCount, reps, weight), source: 'claude' };
  } catch (err: any) {
    console.warn('[Claude swap] failed, using fallback:', err?.message ?? err);
    return { sets: fallbackSwapSets(input), source: 'fallback' };
  }
}

