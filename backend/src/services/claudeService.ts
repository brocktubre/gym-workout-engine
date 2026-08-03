import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { WorkoutExercise, UserSettings, Workout, MuscleGroup, WorkoutGoal } from '../types';

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

// ---------------------------------------------------------------------------
// Types for Claude's JSON response
// ---------------------------------------------------------------------------
interface ClaudeExerciseChoice {
  id: string;
  supersetWith?: string | null;
}

interface ClaudeResponse {
  exercises: ClaudeExerciseChoice[];
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

    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(text) as CoachingNoteResponse;

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

// ---------------------------------------------------------------------------
// Hybrid enhancement: rule engine generates, Claude refines order + supersets
// ---------------------------------------------------------------------------
export async function enhanceWorkoutWithClaude(
  draftExercises: WorkoutExercise[],
  settings: UserSettings,
  recentWorkouts: Workout[],
): Promise<WorkoutExercise[]> {
  try {
    const apiKey = await getAnthropicApiKey();
    const client = new Anthropic({ apiKey, timeout: 12_000 }); // 12s hard cap

    // --- Build compact fatigue summary ---
    const now = Date.now();
    const fatigueWindowMs = settings.fatigueWindowHours * 3_600_000;
    const seenMuscles = new Set<string>();
    const recentFatigue: string[] = [];
    for (const w of recentWorkouts) {
      if (!w.completedAt) continue;
      const hoursAgo = Math.round((now - new Date(w.completedAt).getTime()) / 3_600_000);
      if (hoursAgo * 3_600_000 < fatigueWindowMs) {
        for (const ex of w.exercises) {
          const m = ex.exercise.primaryMuscle;
          if (!seenMuscles.has(m)) {
            recentFatigue.push(`${m} (${hoursAgo}h ago)`);
            seenMuscles.add(m);
          }
        }
      }
    }

    // --- Compact draft for the prompt (keep tokens low) ---
    const draftCompact = draftExercises.map(we => ({
      id: we.exerciseId,
      name: we.exercise.name,
      muscle: we.exercise.primaryMuscle,
      secondary: we.exercise.secondaryMuscles,
      category: we.exercise.category,
      equipment: we.exercise.equipment,
      currentSuperset: draftExercises.find(
        o => o.supersetGroupId === we.supersetGroupId &&
             we.supersetGroupId !== undefined &&
             o.exerciseId !== we.exerciseId,
      )?.exerciseId ?? null,
    }));

    // ---------------------------------------------------------------------------
    // System prompt — strict rules to keep Claude from hallucinating exercise IDs
    // ---------------------------------------------------------------------------
    const systemPrompt = `You are an expert personal trainer reviewing a rule-generated workout.
Your job: reorder the given exercises and adjust superset pairings for optimal results.

STRICT RULES:
1. Return EXACTLY the same exercise IDs provided — do NOT add, remove, or rename any
2. Never pair two barbell exercises as a superset (user only has one barbell loaded at a time)
3. Only superset antagonist muscle pairs: chest↔back, biceps↔triceps, quads↔hamstrings, shoulders↔back
4. List each ID exactly ONCE in your response — no duplicates
5. Compound movements should come before isolation movements for the same muscle group
6. Avoid leading the workout with muscles listed in recentFatigue
7. Return ONLY valid JSON — no markdown, no code fences, no extra text

JSON format:
{"exercises":[{"id":"exact-id-here","supersetWith":"partner-id-or-null"}],"reasoning":"1–2 sentences"}`;

    const userMessage = JSON.stringify({
      goal: settings.goal,
      fitnessLevel: settings.fitnessLevel,
      preferCompound: settings.preferCompound,
      allowSupersets: settings.allowSupersets ?? true,
      recentFatigue,
      exercises: draftCompact,
    });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

    // --- Parse ---
    let claudeResult: ClaudeResponse;
    try {
      claudeResult = JSON.parse(text);
    } catch {
      console.warn('[Claude] Invalid JSON — falling back to rule-engine output. Raw:', text.slice(0, 200));
      return draftExercises;
    }

    if (!Array.isArray(claudeResult.exercises) || claudeResult.exercises.length === 0) {
      console.warn('[Claude] Empty exercises array — falling back');
      return draftExercises;
    }

    // --- Validate: Claude must return exactly the same IDs ---
    const draftIds = new Set(draftExercises.map(e => e.exerciseId));
    const claudeIds = claudeResult.exercises.map(e => e.id);
    const uniqueClaudeIds = new Set(claudeIds);
    const idMismatch =
      uniqueClaudeIds.size !== draftIds.size ||
      claudeIds.length !== draftIds.size ||
      ![...draftIds].every(id => uniqueClaudeIds.has(id));

    if (idMismatch) {
      console.warn('[Claude] Exercise ID mismatch — falling back to rule-engine output');
      return draftExercises;
    }

    // --- Build lookup ---
    const draftMap = new Map<string, WorkoutExercise>();
    for (const we of draftExercises) draftMap.set(we.exerciseId, we);

    // --- Reconstruct with Claude's ordering and superset pairings ---
    const result: WorkoutExercise[] = [];
    const processed = new Set<string>();

    for (const choice of claudeResult.exercises) {
      if (processed.has(choice.id)) continue;
      const original = draftMap.get(choice.id);
      if (!original) continue;

      if (choice.supersetWith && !processed.has(choice.supersetWith)) {
        const partner = draftMap.get(choice.supersetWith);
        if (partner) {
          // Guard: no double-barbell supersets
          const bothBarbell =
            original.exercise.equipment === 'barbell' &&
            partner.exercise.equipment === 'barbell';

          if (!bothBarbell) {
            const groupId = uuidv4();
            const baseRest = original.sets[0]?.restSeconds ?? 90;
            const supersetRest = Math.max(30, Math.round(baseRest * 0.5));

            result.push({
              ...original,
              sets: original.sets.map(s => ({ ...s, restSeconds: supersetRest })),
              supersetGroupId: groupId,
              supersetOrder: 1,
            });
            result.push({
              ...partner,
              sets: partner.sets.map(s => ({ ...s, restSeconds: supersetRest })),
              supersetGroupId: groupId,
              supersetOrder: 2,
            });
            processed.add(choice.id);
            processed.add(choice.supersetWith);
            continue;
          }
        }
      }

      // Standard — strip any stale superset metadata from the rule engine
      result.push({
        ...original,
        supersetGroupId: undefined,
        supersetOrder: undefined,
      });
      processed.add(choice.id);
    }

    // Final safety check: output count must match input count
    if (result.length !== draftExercises.length) {
      console.warn('[Claude] Output length mismatch — falling back');
      return draftExercises;
    }

    if (claudeResult.reasoning) {
      console.log(`[Claude] ${claudeResult.reasoning}`);
    }

    return result;
  } catch (err: any) {
    // Graceful fallback — Claude enhancement is additive, never break the workout
    console.error('[Claude] Enhancement failed, using rule-engine output:', err?.message ?? err);
    return draftExercises;
  }
}
