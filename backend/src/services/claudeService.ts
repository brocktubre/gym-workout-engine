import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { WorkoutExercise, UserSettings, Workout, MuscleGroup, WorkoutGoal } from '../types';

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

// ---------------------------------------------------------------------------
// Antagonist pairs used for the deterministic superset fallback
// ---------------------------------------------------------------------------
const FALLBACK_SUPERSET_PAIRS: [MuscleGroup, MuscleGroup][] = [
  ['chest',     'back'],
  ['biceps',    'triceps'],
  ['quads',     'hamstrings'],
  ['shoulders', 'back'],
  ['chest',     'shoulders'],
];

// ---------------------------------------------------------------------------
// Types for Claude's JSON response (superset grouping format)
// ---------------------------------------------------------------------------
interface SupersetGroup {
  /** 'superset' = 2-4 exercises back-to-back; 'standalone' = normal rest */
  type: 'superset' | 'standalone';
  /** Ordered list of exercise IDs */
  exercises: string[];
}

interface ClaudeGroupResponse {
  groups: SupersetGroup[];
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

// ---------------------------------------------------------------------------
// Fallback: deterministic 2-exercise superset pairing when Claude is unavailable
// ---------------------------------------------------------------------------
function applyFallbackSupersets(exercises: WorkoutExercise[]): WorkoutExercise[] {
  const result: WorkoutExercise[] = [];
  const processed = new Set<string>();

  for (const ex of exercises) {
    if (processed.has(ex.exerciseId)) continue;
    processed.add(ex.exerciseId);

    // Try to find a complementary pairing
    let paired = false;
    for (const [a, b] of FALLBACK_SUPERSET_PAIRS) {
      const primaryMuscle = ex.exercise.primaryMuscle;
      const partnerMuscle = primaryMuscle === a ? b : primaryMuscle === b ? a : undefined;
      if (!partnerMuscle) continue;

      const partnerIdx = exercises.findIndex(e =>
        !processed.has(e.exerciseId) &&
        e.exercise.primaryMuscle === partnerMuscle &&
        !(ex.exercise.equipment === 'barbell' && e.exercise.equipment === 'barbell'),
      );

      if (partnerIdx !== -1) {
        const partner = exercises[partnerIdx];
        processed.add(partner.exerciseId);
        const groupId = uuidv4();
        const baseRest = ex.sets[0]?.restSeconds ?? 90;
        // Use user's full configured rest for superset rounds
        const supersetRest = baseRest;
        result.push({ ...ex,      sets: ex.sets.map(s => ({ ...s, restSeconds: supersetRest })),      supersetGroupId: groupId, supersetOrder: 1 });
        result.push({ ...partner, sets: partner.sets.map(s => ({ ...s, restSeconds: supersetRest })), supersetGroupId: groupId, supersetOrder: 2 });
        paired = true;
        break;
      }
    }

    if (!paired) {
      result.push({ ...ex, supersetGroupId: undefined, supersetOrder: undefined });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hybrid enhancement: rule engine generates, Claude refines order + supersets
// Claude can create 2-4 exercise supersets (pairs, tri-sets, giant sets)
// ---------------------------------------------------------------------------
export async function enhanceWorkoutWithClaude(
  draftExercises: WorkoutExercise[],
  settings: UserSettings,
  recentWorkouts: Workout[],
): Promise<WorkoutExercise[]> {
  try {
    const apiKey = await getAnthropicApiKey();
    const client = new Anthropic({ apiKey, timeout: 15_000 });

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

    // --- Compact exercise list for the prompt ---
    const exerciseList = draftExercises.map(we => ({
      id:        we.exerciseId,
      name:      we.exercise.name,
      muscle:    we.exercise.primaryMuscle,
      secondary: we.exercise.secondaryMuscles,
      category:  we.exercise.category,
      equipment: we.exercise.equipment,
    }));

    // ---------------------------------------------------------------------------
    // System prompt: Claude creates 2-4 exercise superset groups
    // ---------------------------------------------------------------------------
    const systemPrompt = `You are an expert personal trainer organizing a workout into optimal superset groups.

SUPERSET DEFINITIONS:
- Superset  (2 movements): back-to-back with short rest between rounds
- Tri-set   (3 movements): three movements back-to-back, rest only between rounds
- Giant set (4 movements): four movements back-to-back, rest only between full rounds

YOUR TASK:
Given the exercise list, decide which exercises should be grouped into supersets and which should be standalone.
Return them in an optimal workout order.

STRICT RULES:
1. Each exercise ID must appear EXACTLY ONCE across all groups
2. Superset groups must contain 2, 3, or 4 exercises — never 1, never more than 4
3. NEVER put two barbell exercises in the same superset group (only one barbell can be loaded)
4. Heavy compound barbell lifts (squats, deadlifts, bench press) are usually better as standalone
5. Isolation exercises group well into supersets
6. Good superset pairings (antagonist muscles work best):
   - chest ↔ back
   - biceps ↔ triceps
   - quads ↔ hamstrings
   - shoulders ↔ back
   - Tri-set example: biceps + triceps + rear delts
   - Tri-set example: quads + hamstrings + glutes
7. Compound movements should appear before isolation for the same muscle group
8. Avoid leading with muscles in recentFatigue
9. Return ONLY valid JSON — no markdown, no code fences

JSON format (standalone groups have exactly 1 exercise; superset groups have 2-4):
{"groups":[{"type":"superset","exercises":["id1","id2","id3"]},{"type":"standalone","exercises":["id4"]}],"reasoning":"1-2 sentences"}`;

    const userMessage = JSON.stringify({
      goal: settings.goal,
      fitnessLevel: settings.fitnessLevel,
      allowSupersets: settings.allowSupersets ?? true,
      recentFatigue,
      exercises: exerciseList,
    });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

    let claudeResult: ClaudeGroupResponse;
    try {
      claudeResult = JSON.parse(extractJson(rawText));
    } catch {
      console.warn('[Claude] Invalid JSON — using fallback superset logic. Raw:', rawText.slice(0, 200));
      return applyFallbackSupersets(draftExercises);
    }

    if (!Array.isArray(claudeResult.groups) || claudeResult.groups.length === 0) {
      console.warn('[Claude] Empty groups array — using fallback');
      return applyFallbackSupersets(draftExercises);
    }

    // --- Validate: all IDs must appear exactly once ---
    const draftIds = new Set(draftExercises.map(e => e.exerciseId));
    const allClaudeIds = claudeResult.groups.flatMap(g => g.exercises);
    const uniqueClaudeIds = new Set(allClaudeIds);

    const idMismatch =
      uniqueClaudeIds.size !== draftIds.size ||
      allClaudeIds.length !== draftIds.size ||
      ![...draftIds].every(id => uniqueClaudeIds.has(id));

    if (idMismatch) {
      console.warn('[Claude] Exercise ID mismatch — using fallback superset logic');
      return applyFallbackSupersets(draftExercises);
    }

    // --- Build lookup map ---
    const draftMap = new Map<string, WorkoutExercise>();
    for (const we of draftExercises) draftMap.set(we.exerciseId, we);

    // --- Reconstruct with Claude's groupings ---
    const result: WorkoutExercise[] = [];

    for (const group of claudeResult.groups) {
      const members = group.exercises
        .map(id => draftMap.get(id))
        .filter((e): e is WorkoutExercise => e !== undefined);

      if (members.length === 0) continue;

      const isSuperset = group.type === 'superset' && members.length >= 2;

      if (isSuperset) {
        // Guard: never more than 4 in a group, never 2+ barbells
        const barbellCount = members.filter(e => e.exercise.equipment === 'barbell').length;
        const safeMembers = barbellCount > 1
          ? members // fallback: push them in as standalone below
          : members.slice(0, 4); // cap at 4

        if (barbellCount > 1) {
          // Too many barbells — treat all as standalone
          for (const ex of safeMembers) {
            result.push({ ...ex, supersetGroupId: undefined, supersetOrder: undefined });
          }
          continue;
        }

        const groupId = uuidv4();
        const baseRest = safeMembers[0].sets[0]?.restSeconds ?? 90;
        // Use the user's full configured rest — rest fires once per round, not per movement
        const supersetRest = baseRest;

        safeMembers.forEach((ex, i) => {
          result.push({
            ...ex,
            sets: ex.sets.map(s => ({ ...s, restSeconds: supersetRest })),
            supersetGroupId: groupId,
            supersetOrder: i + 1,
          });
        });
      } else {
        // Standalone — strip any stale superset metadata
        for (const ex of members) {
          result.push({ ...ex, supersetGroupId: undefined, supersetOrder: undefined });
        }
      }
    }

    // Safety: output must match input count
    if (result.length !== draftExercises.length) {
      console.warn('[Claude] Output length mismatch — using fallback');
      return applyFallbackSupersets(draftExercises);
    }

    if (claudeResult.reasoning) {
      console.log(`[Claude superset] ${claudeResult.reasoning}`);
    }

    return result;
  } catch (err: any) {
    console.error('[Claude] Enhancement failed, using fallback superset logic:', err?.message ?? err);
    return applyFallbackSupersets(draftExercises);
  }
}
