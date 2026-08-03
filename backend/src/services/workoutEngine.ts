import { v4 as uuidv4 } from 'uuid';
import {
  Exercise, Workout, WorkoutExercise, WorkoutSet,
  WorkoutGoal, MuscleGroup, UserSettings, GenerateWorkoutRequest,
  WarmupItem,
} from '../types';
import { getExercisesForEquipment } from './exerciseService';

// ---------------------------------------------------------------------------
// Volume config per goal — restSeconds is the default; actual rest used from
// settings.restBetweenSetsSeconds when available.
// ---------------------------------------------------------------------------
const VOLUME_CONFIG: Record<WorkoutGoal, {
  sets: number; minReps: number; maxReps: number; restSeconds: number;
}> = {
  strength:    { sets: 5, minReps: 3,  maxReps: 5,  restSeconds: 180 },
  hypertrophy: { sets: 4, minReps: 8,  maxReps: 12, restSeconds: 90  },
  endurance:   { sets: 3, minReps: 15, maxReps: 20, restSeconds: 45  },
  'fat-loss':  { sets: 3, minReps: 12, maxReps: 15, restSeconds: 60  },
};

// Average work time per set in seconds (30s execution + transition buffer)
const SET_WORK_SECONDS = 40;

// ---------------------------------------------------------------------------
// Starting weights in lbs by muscle group + equipment
// ---------------------------------------------------------------------------
const STARTING_WEIGHTS: Partial<Record<MuscleGroup, Partial<Record<string, number>>>> = {
  chest:      { barbell: 135, dumbbell: 45, machine: 90,  cable: 45,  rings: 0 },
  back:       { barbell: 185, dumbbell: 55, machine: 110, cable: 65,  kettlebell: 53, sled: 135 },
  shoulders:  { barbell: 95,  dumbbell: 25, machine: 65,  cable: 30,  kettlebell: 35 },
  biceps:     { barbell: 65,  dumbbell: 25, cable: 35,    'ez-bar': 55, rings: 0 },
  triceps:    { barbell: 95,  dumbbell: 25, cable: 45,    rings: 0 },
  quads:      { barbell: 185, machine: 135, sled: 185,    'plyometric-box': 0, kettlebell: 53, sandbag: 65 },
  hamstrings: { barbell: 135, machine: 90,  kettlebell: 53, sled: 135 },
  glutes:     { barbell: 185, machine: 110, sled: 185,    kettlebell: 53 },
  core:       { 'medicine-ball': 20, sandbag: 45, rings: 0 },
};

// ---------------------------------------------------------------------------
// Antagonist pairs for supersets (push/pull, bis/tris, quads/hams)
// ---------------------------------------------------------------------------
const SUPERSET_PAIRS: [MuscleGroup, MuscleGroup][] = [
  ['chest',   'back'],
  ['biceps',  'triceps'],
  ['quads',   'hamstrings'],
  ['shoulders', 'back'],
  ['chest',   'shoulders'],
];

// ---------------------------------------------------------------------------
// Warmup stretches by muscle group
// ---------------------------------------------------------------------------
const WARMUP_STRETCHES: Partial<Record<MuscleGroup, WarmupItem[]>> = {
  chest: [
    { name: 'Band Chest Opener', type: 'stretch', durationSeconds: 45, targetMuscles: ['chest', 'shoulders'],
      equipment: 'resistance-band', instructions: ['Hold band behind back at hip height', 'Slowly raise arms overhead, feeling chest stretch', 'Hold 2s at top, lower and repeat'] },
    { name: 'Doorway / Ring Chest Stretch', type: 'stretch', durationSeconds: 30, targetMuscles: ['chest'],
      equipment: 'bodyweight', instructions: ['Stand in plank position on rings or doorway', 'Allow chest to drop forward between arms', 'Hold stretch 30 seconds'] },
  ],
  back: [
    { name: 'Cat-Cow', type: 'mobility', durationSeconds: 45, targetMuscles: ['back', 'core'],
      equipment: 'bodyweight', instructions: ['On all fours, alternate arching and rounding spine', 'Move slowly through full range', 'Breathe out on cat, in on cow'] },
    { name: 'Lat Hang', type: 'stretch', durationSeconds: 30, targetMuscles: ['back'],
      equipment: 'pull-up-bar', instructions: ['Hang from pull-up bar, arms fully extended', 'Let shoulders unpack and lats stretch', 'Hold 30 seconds'] },
  ],
  shoulders: [
    { name: 'Cross-Body Shoulder Stretch', type: 'stretch', durationSeconds: 30, targetMuscles: ['shoulders'],
      equipment: 'bodyweight', instructions: ['Pull one arm across chest with opposite hand', 'Hold 15s each side', 'Keep shoulders down'] },
    { name: 'Band Shoulder Circles', type: 'mobility', durationSeconds: 45, targetMuscles: ['shoulders'],
      equipment: 'resistance-band', instructions: ['Hold band with wide grip in front', 'Circle overhead and behind back', 'Narrow grip as mobility improves'] },
  ],
  biceps: [
    { name: 'Wrist Flexor Stretch', type: 'stretch', durationSeconds: 30, targetMuscles: ['biceps'],
      equipment: 'bodyweight', instructions: ['Extend arm forward, palm up', 'Gently press fingers back with other hand', 'Hold 15s each side'] },
  ],
  triceps: [
    { name: 'Overhead Tricep Stretch', type: 'stretch', durationSeconds: 30, targetMuscles: ['triceps'],
      equipment: 'bodyweight', instructions: ['Raise arm overhead, bend at elbow', 'Use other hand to gently pull elbow back', 'Hold 15s each side'] },
  ],
  quads: [
    { name: 'Standing Quad Stretch', type: 'stretch', durationSeconds: 30, targetMuscles: ['quads'],
      equipment: 'bodyweight', instructions: ['Stand on one leg, pull heel toward glute', 'Keep knees together', 'Hold 15s each side'] },
    { name: 'Leg Swing (forward/back)', type: 'mobility', durationSeconds: 40, targetMuscles: ['quads', 'hamstrings'],
      equipment: 'bodyweight', instructions: ['Hold wall for balance', 'Swing leg forward and back 10 times each side', 'Increase range progressively'] },
  ],
  hamstrings: [
    { name: 'Inchworm', type: 'mobility', durationSeconds: 45, targetMuscles: ['hamstrings', 'back'],
      equipment: 'bodyweight', instructions: ['Stand, hinge forward and walk hands out to plank', 'Walk feet back to hands', 'Repeat 5 times'] },
    { name: 'Standing Hamstring Stretch', type: 'stretch', durationSeconds: 30, targetMuscles: ['hamstrings'],
      equipment: 'bodyweight', instructions: ['Place heel on low surface', 'Hinge forward at hips with straight back', 'Hold 15s each side'] },
  ],
  glutes: [
    { name: 'Hip 90/90 Stretch', type: 'stretch', durationSeconds: 45, targetMuscles: ['glutes'],
      equipment: 'bodyweight', instructions: ['Sit with both legs at 90-degree angles', 'Lean forward over front leg', 'Hold 20s each side'] },
    { name: 'Glute Bridge Hold', type: 'mobility', durationSeconds: 30, targetMuscles: ['glutes', 'hamstrings'],
      equipment: 'bodyweight', instructions: ['Lie on back, feet flat', 'Drive hips up and hold', 'Focus on glute squeeze'] },
  ],
  core: [
    { name: 'World\'s Greatest Stretch', type: 'mobility', durationSeconds: 60, targetMuscles: ['core', 'quads', 'back'],
      equipment: 'bodyweight', instructions: ['Lunge forward, place same-side hand down', 'Open arm toward ceiling, rotating thorax', 'Return and repeat 5 each side'] },
    { name: 'Dead Bug Hold', type: 'mobility', durationSeconds: 30, targetMuscles: ['core'],
      equipment: 'bodyweight', instructions: ['Lie on back, arms and legs up', 'Press lower back into floor', 'Hold the position, breathing steadily'] },
  ],
};

// Cardio warmup options mapped to available equipment
const CARDIO_WARMUP_OPTIONS = [
  { equipment: 'echo-bike' as const, name: 'Echo Bike Warmup', instructions: ['Set resistance to light', 'Ride at conversational pace', 'Build intensity gradually in final 2 min'] },
  { equipment: 'rower'     as const, name: 'Row Erg Warmup',   instructions: ['Set damper to 3-5', 'Row at steady 70% effort', 'Focus on smooth catch and drive'] },
  { equipment: 'ski-erg'   as const, name: 'SkiErg Warmup',    instructions: ['Easy pull rhythm', 'Focus on hip hinge and arm extension', 'Build pace in final minute'] },
  { equipment: 'bodyweight'as const, name: 'Dynamic Warmup',   instructions: ['Jumping jacks 30s', 'High knees 30s', 'Arm circles 20s each direction', 'Repeat x2'] },
];

// ---------------------------------------------------------------------------
// Build warmup phase
// ---------------------------------------------------------------------------
function buildWarmup(
  targetMuscles: MuscleGroup[],
  availableEquipment: string[],
  durationMinutes: number,
): WarmupItem[] {
  const warmup: WarmupItem[] = [];
  let budgetSeconds = durationMinutes * 60;

  // 1. Cardio machine (7 min minimum, up to 8 min)
  const cardioDuration = Math.min(480, Math.max(420, Math.floor(budgetSeconds * 0.65)));
  const cardioOption = CARDIO_WARMUP_OPTIONS.find(o => availableEquipment.includes(o.equipment))
    ?? CARDIO_WARMUP_OPTIONS[CARDIO_WARMUP_OPTIONS.length - 1];

  warmup.push({
    name: cardioOption.name,
    type: 'cardio',
    durationSeconds: cardioDuration,
    targetMuscles: ['cardio' as MuscleGroup],
    equipment: cardioOption.equipment,
    instructions: cardioOption.instructions,
  });
  budgetSeconds -= cardioDuration;

  // 2. Mobility/stretches for target muscles (remaining time, max 3 items)
  const stretched = new Set<MuscleGroup>();
  for (const muscle of targetMuscles) {
    if (budgetSeconds < 20 || stretched.size >= 4) break;
    const options = WARMUP_STRETCHES[muscle];
    if (!options?.length) continue;
    const item = options[0];
    warmup.push(item);
    budgetSeconds -= item.durationSeconds;
    stretched.add(muscle);
  }

  return warmup;
}

// ---------------------------------------------------------------------------
// Build sets for one exercise
// ---------------------------------------------------------------------------
function buildSets(
  exercise: Exercise,
  goal: WorkoutGoal,
  config: typeof VOLUME_CONFIG[WorkoutGoal],
  restSeconds: number,
  recentWorkouts: Workout[],
): { sets: WorkoutSet[]; progressionNote?: string } {
  const reps = Math.floor(Math.random() * (config.maxReps - config.minReps + 1)) + config.minReps;
  let progressionNote: string | undefined;
  let suggestedWeight: number | undefined;

  for (const w of recentWorkouts) {
    const prev = w.exercises?.find(e => e.exerciseId === exercise.id);
    if (prev) {
      const done = prev.sets.filter(s => s.completed);
      if (done.length > 0) {
        const allDone = done.length === prev.sets.length;
        const avgW = done.reduce((s, x) => s + (x.completedWeight || 0), 0) / done.length;
        const avgR = done.reduce((s, x) => s + (x.completedReps || x.targetReps), 0) / done.length;
        if (allDone && avgW > 0) {
          suggestedWeight = avgW + 5;
          progressionNote = `↑ Up 5lbs from last session (was ${avgW}lbs × ${Math.round(avgR)} reps)`;
        } else if (avgW > 0) {
          suggestedWeight = avgW;
          progressionNote = `Same weight — aim to complete all sets (${avgW}lbs × ${Math.round(avgR)} reps last time)`;
        }
      }
      break;
    }
  }

  if (!suggestedWeight && exercise.category !== 'cardio') {
    const mw = STARTING_WEIGHTS[exercise.primaryMuscle];
    if (mw) suggestedWeight = mw[exercise.equipment] ?? mw['dumbbell'];
  }

  const sets: WorkoutSet[] = Array.from({ length: config.sets }, (_, i) => ({
    setNumber: i + 1,
    targetReps: reps,
    targetWeight: exercise.category === 'cardio' ? undefined : suggestedWeight,
    completed: false,
    restSeconds,
  }));

  return { sets, progressionNote };
}

// ---------------------------------------------------------------------------
// Calculate minutes for one exercise based on actual rest time
// ---------------------------------------------------------------------------
function minutesForExercise(sets: number, restSeconds: number): number {
  // sets × (40s avg work + rest) but last set has no rest
  return (sets * SET_WORK_SECONDS + Math.max(0, sets - 1) * restSeconds) / 60;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------
export async function generateWorkout(context: {
  settings: UserSettings;
  recentWorkouts: Workout[];
  request: GenerateWorkoutRequest;
}): Promise<{ exercises: WorkoutExercise[]; warmup: WarmupItem[] }> {
  const { settings, recentWorkouts, request } = context;
  const goal = request.goal || settings.goal;
  const config = VOLUME_CONFIG[goal];
  const restSeconds = settings.restBetweenSetsSeconds ?? config.restSeconds;
  const targetMinutes = request.durationMinutes;
  const includeWarmup = request.includeWarmup ?? settings.includeWarmup ?? true;
  const allowSupersets = request.allowSupersets ?? settings.allowSupersets ?? true;

  // Warmup duration: 5 min default, 10 if workout ≥ 60 min
  const warmupMinutes = includeWarmup ? 12 : 0; // Always 10-12 min: ~7 min cardio + ~3 min stretching

  // Warmup is ADDITIONAL time — 1h workout = 10min warmup + 1h of exercises
  let budget = targetMinutes;
  if (goal === 'fat-loss') budget -= 8; // cardio finisher

  // Minutes per standard exercise
  const minsPerExercise = minutesForExercise(config.sets, restSeconds);
  // Supersets are faster: two exercises share rest time (rest once between pairs)
  const minsPerSuperset = minutesForExercise(config.sets, restSeconds) * 1.6; // ~60% overhead vs 2x standalone

  // 1. Equipment filter
  const available = getExercisesForEquipment(settings.availableEquipment);

  // 2. Fatigue filter
  const fatigueWindowMs = settings.fatigueWindowHours * 3_600_000;
  const now = Date.now();
  const fatiguedMuscles = new Set<MuscleGroup>();
  for (const w of recentWorkouts) {
    if (!w.completedAt) continue;
    if (now - new Date(w.completedAt).getTime() < fatigueWindowMs) {
      w.exercises.forEach(e => fatiguedMuscles.add(e.exercise.primaryMuscle));
    }
  }

  // 3. Variety filter
  const varietyCutoff = new Date(Date.now() - settings.exerciseVarietyDays * 86_400_000);
  const recentIds = new Set<string>();
  for (const w of recentWorkouts) {
    if (w.completedAt && new Date(w.completedAt) > varietyCutoff) {
      w.exercises.forEach(e => recentIds.add(e.exerciseId));
    }
  }

  // 4. Pick target muscles
  const ALL_MUSCLES: MuscleGroup[] = [
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'quads', 'hamstrings', 'glutes', 'core',
  ];

  let targetMuscles: MuscleGroup[];
  if (request.targetMuscleGroups?.length) {
    targetMuscles = request.targetMuscleGroups;
  } else {
    const fresh = ALL_MUSCLES.filter(m => !fatiguedMuscles.has(m));
    const estimatedExercises = Math.floor(budget / minsPerExercise);
    const muscleSlots = Math.min(5, Math.max(2, Math.floor(estimatedExercises / 1.5)));

    const push = fresh.filter(m => ['chest', 'shoulders', 'triceps'].includes(m));
    const pull = fresh.filter(m => ['back', 'biceps'].includes(m));
    const legs = fresh.filter(m => ['quads', 'hamstrings', 'glutes'].includes(m));

    targetMuscles = [];
    if (push[0]) targetMuscles.push(push[0]);
    if (pull[0]) targetMuscles.push(pull[0]);
    if (targetMuscles.length < muscleSlots && legs[0]) targetMuscles.push(legs[0]);
    for (const m of fresh) {
      if (targetMuscles.length >= muscleSlots) break;
      if (!targetMuscles.includes(m)) targetMuscles.push(m);
    }
    if (!targetMuscles.length) targetMuscles = ALL_MUSCLES.slice(0, 3);
  }

  // 5. Build warmup
  const warmup = includeWarmup
    ? buildWarmup(targetMuscles, settings.availableEquipment as string[], warmupMinutes)
    : [];

  // 6. Identify superset opportunities
  const supersetPairs: Set<string> = new Set();
  if (allowSupersets) {
    for (const [a, b] of SUPERSET_PAIRS) {
      if (targetMuscles.includes(a) && targetMuscles.includes(b)) {
        supersetPairs.add(`${a}+${b}`);
      }
    }
  }

  // 7. Build exercise list
  const result: WorkoutExercise[] = [];
  const exclude = new Set(request.excludeExerciseIds || []);
  const processedMuscles = new Set<MuscleGroup>();

  // Seeded random shuffle so regenerate produces different exercises each time
  const shuffleSeed = Date.now();
  const seededRandom = (i: number) => ((shuffleSeed * (i + 1) * 2654435761) >>> 0) / 4294967296;
  const shuffle = <T,>(arr: T[]): T[] =>
    [...arr].sort((_, __, i = Math.random()) => i - 0.5);

  const pickExercise = (muscle: MuscleGroup, preferCompound: boolean, excludeIds: Set<string>) => {
    const pool = shuffle(available.filter(e =>
      e.primaryMuscle === muscle &&
      !recentIds.has(e.id) &&
      !excludeIds.has(e.id) &&
      !exclude.has(e.id)
    ));
    if (preferCompound) {
      return pool.find(e => e.category === 'compound') ?? pool[0];
    }
    return pool[0];
  };

  // Process muscles — create supersets where possible
  const remainingMuscles = [...targetMuscles];

  while (remainingMuscles.length > 0 && budget > minsPerExercise * 0.8) {
    const muscle = remainingMuscles.shift()!;
    if (processedMuscles.has(muscle)) continue;

    // Check if this muscle has a superset partner in remaining muscles
    let supersetPartner: MuscleGroup | undefined;
    if (allowSupersets && budget > minsPerSuperset) {
      for (const [a, b] of SUPERSET_PAIRS) {
        const partner = muscle === a ? b : muscle === b ? a : undefined;
        if (partner && remainingMuscles.includes(partner)) {
          supersetPartner = partner;
          break;
        }
      }
    }

    const usedIds = new Set<string>(exclude);
    const primaryEx = pickExercise(muscle, settings.preferCompound, usedIds);
    if (!primaryEx) continue;

    if (supersetPartner) {
      // === SUPERSET ===
      usedIds.add(primaryEx.id);
      const partnerEx = pickExercise(supersetPartner, settings.preferCompound, usedIds);
      // Never superset two barbell movements — user only has 1 barbell set up at a time
      const bothBarbell = primaryEx.equipment === 'barbell' && partnerEx?.equipment === 'barbell';
      if (partnerEx && !bothBarbell) {
        const groupId = uuidv4();
        // In a superset rest is shared — shorter rest per individual exercise
        // Superset rest: half of normal rest, never less than 30s
        const supersetRest = Math.max(30, Math.round(restSeconds * 0.5));

        const { sets: setsA, progressionNote: noteA } = buildSets(primaryEx, goal, config, supersetRest, recentWorkouts);
        const { sets: setsB, progressionNote: noteB } = buildSets(partnerEx, goal, config, supersetRest, recentWorkouts);

        result.push({
          exerciseId: primaryEx.id, exercise: primaryEx,
          sets: setsA, progressionNote: noteA,
          supersetGroupId: groupId, supersetOrder: 1,
        });
        result.push({
          exerciseId: partnerEx.id, exercise: partnerEx,
          sets: setsB, progressionNote: noteB,
          supersetGroupId: groupId, supersetOrder: 2,
        });

        budget -= minsPerSuperset;
        processedMuscles.add(muscle);
        processedMuscles.add(supersetPartner);
        remainingMuscles.splice(remainingMuscles.indexOf(supersetPartner), 1);
        continue;
      }
    }

    // === STANDARD EXERCISE ===
    const { sets, progressionNote } = buildSets(primaryEx, goal, config, restSeconds, recentWorkouts);
    result.push({ exerciseId: primaryEx.id, exercise: primaryEx, sets, progressionNote });
    budget -= minsPerExercise;
    processedMuscles.add(muscle);

    // Isolation accessory if time remains (not for supersets)
    if (budget > minsPerExercise * 0.9) {
      const isoPool = available.filter(e =>
        e.primaryMuscle === muscle &&
        e.category === 'isolation' &&
        e.id !== primaryEx.id &&
        !recentIds.has(e.id) &&
        !exclude.has(e.id)
      );
      if (isoPool.length) {
        const { sets: isoSets, progressionNote: isoNote } = buildSets(isoPool[0], goal, config, restSeconds, recentWorkouts);
        result.push({ exerciseId: isoPool[0].id, exercise: isoPool[0], sets: isoSets, progressionNote: isoNote });
        budget -= minsPerExercise;
      }
    }
  }

  // Core finisher (if not already included and time remains)
  if (!processedMuscles.has('core') && budget > minsPerExercise * 0.7) {
    const core = available.filter(e => e.primaryMuscle === 'core' && !recentIds.has(e.id));
    if (core.length) {
      const { sets, progressionNote } = buildSets(core[0], goal, config, restSeconds, recentWorkouts);
      result.push({ exerciseId: core[0].id, exercise: core[0], sets, progressionNote });
    }
  }

  // Cardio finisher for fat-loss
  if (goal === 'fat-loss') {
    const cardio = available.filter(e => e.primaryMuscle === 'cardio');
    if (cardio.length) {
      result.push({
        exerciseId: cardio[0].id, exercise: cardio[0],
        sets: [{ setNumber: 1, targetReps: 1, completed: false, restSeconds: 0 }],
        notes: '8 minutes steady-state cardio finisher',
      });
    }
  }

  return { exercises: result, warmup };
}
