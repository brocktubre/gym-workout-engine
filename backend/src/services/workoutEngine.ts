import {
  Exercise, Workout, WorkoutExercise, WorkoutSet,
  WorkoutGoal, MuscleGroup, UserSettings, GenerateWorkoutRequest,
  WarmupItem,
} from '../types';
import { getExercisesForEquipment } from './exerciseService';
import {
  nextDumbbellWeight,
  nextKettlebellWeight,
  snapSuggestedWeight,
} from './equipmentWeights';
import { suggestComplementaryExercises } from './claudeService';

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
/** Wall-clock rest between circuits / movements (matches ActiveWorkout). */
const BETWEEN_EXERCISE_MINUTES = 1;

/** Complementary muscles when a focus group can't fill the duration alone. */
const COMPLEMENT_MUSCLES: Record<MuscleGroup, MuscleGroup[]> = {
  core: ['shoulders', 'glutes', 'back', 'chest', 'quads'],
  chest: ['triceps', 'shoulders', 'back', 'core'],
  back: ['biceps', 'core', 'shoulders', 'chest'],
  shoulders: ['core', 'triceps', 'back', 'chest'],
  biceps: ['back', 'core', 'shoulders'],
  triceps: ['chest', 'shoulders', 'core'],
  quads: ['glutes', 'hamstrings', 'core', 'calves'],
  hamstrings: ['glutes', 'quads', 'core', 'back'],
  glutes: ['hamstrings', 'quads', 'core', 'back'],
  calves: ['quads', 'hamstrings', 'glutes', 'core'],
  cardio: ['core', 'quads', 'glutes', 'shoulders'],
};

// ---------------------------------------------------------------------------
// Starting weights in lbs by muscle group + equipment
// ---------------------------------------------------------------------------
const STARTING_WEIGHTS: Partial<Record<MuscleGroup, Partial<Record<string, number>>>> = {
  chest:      { barbell: 135, dumbbell: 50, machine: 90,  cable: 45,  rings: 0 },
  back:       { barbell: 185, dumbbell: 50, machine: 110, cable: 65,  kettlebell: 53, sled: 135 },
  shoulders:  { barbell: 95,  dumbbell: 20, machine: 65,  cable: 30,  kettlebell: 35 },
  biceps:     { barbell: 65,  dumbbell: 20, cable: 35,    'ez-bar': 55, rings: 0 },
  triceps:    { barbell: 95,  dumbbell: 20, cable: 45,    rings: 0 },
  quads:      { barbell: 185, machine: 135, sled: 185,    'plyometric-box': 0, kettlebell: 53, sandbag: 65 },
  hamstrings: { barbell: 135, machine: 90,  kettlebell: 53, sled: 135 },
  glutes:     { barbell: 185, machine: 110, sled: 185,    kettlebell: 53 },
  core:       { 'medicine-ball': 20, sandbag: 45, rings: 0, kettlebell: 35 },
};

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
    { name: 'Cat-Cow', type: 'mobility' as const, durationSeconds: 45, targetMuscles: ['back', 'core'],
      equipment: 'bodyweight', instructions: ['On all fours, alternate arching and rounding spine', 'Move slowly through full range', 'Breathe out on cat, in on cow'] },
    { name: 'Lat Hang', type: 'stretch', durationSeconds: 30, targetMuscles: ['back'],
      equipment: 'pull-up-bar', instructions: ['Hang from pull-up bar, arms fully extended', 'Let shoulders unpack and lats stretch', 'Hold 30 seconds'] },
  ],
  shoulders: [
    { name: 'Cross-Body Shoulder Stretch', type: 'stretch', durationSeconds: 30, targetMuscles: ['shoulders'],
      equipment: 'bodyweight', instructions: ['Pull one arm across chest with opposite hand', 'Hold 15s each side', 'Keep shoulders down'] },
    { name: 'Band Shoulder Circles', type: 'mobility' as const, durationSeconds: 45, targetMuscles: ['shoulders'],
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
    { name: 'Leg Swing (forward/back)', type: 'mobility' as const, durationSeconds: 40, targetMuscles: ['quads', 'hamstrings'],
      equipment: 'bodyweight', instructions: ['Hold wall for balance', 'Swing leg forward and back 10 times each side', 'Increase range progressively'] },
  ],
  hamstrings: [
    { name: 'Inchworm', type: 'mobility' as const, durationSeconds: 45, targetMuscles: ['hamstrings', 'back'],
      equipment: 'bodyweight', instructions: ['Stand, hinge forward and walk hands out to plank', 'Walk feet back to hands', 'Repeat 5 times'] },
    { name: 'Standing Hamstring Stretch', type: 'stretch', durationSeconds: 30, targetMuscles: ['hamstrings'],
      equipment: 'bodyweight', instructions: ['Place heel on low surface', 'Hinge forward at hips with straight back', 'Hold 15s each side'] },
  ],
  glutes: [
    { name: 'Hip 90/90 Stretch', type: 'stretch', durationSeconds: 45, targetMuscles: ['glutes'],
      equipment: 'bodyweight', instructions: ['Sit with both legs at 90-degree angles', 'Lean forward over front leg', 'Hold 20s each side'] },
    { name: 'Glute Bridge Hold', type: 'mobility' as const, durationSeconds: 30, targetMuscles: ['glutes', 'hamstrings'],
      equipment: 'bodyweight', instructions: ['Lie on back, feet flat', 'Drive hips up and hold', 'Focus on glute squeeze'] },
  ],
  core: [
    { name: 'World\'s Greatest Stretch', type: 'mobility' as const, durationSeconds: 60, targetMuscles: ['core', 'quads', 'back'],
      equipment: 'bodyweight', instructions: ['Lunge forward, place same-side hand down', 'Open arm toward ceiling, rotating thorax', 'Return and repeat 5 each side'] },
    { name: 'Dead Bug Hold', type: 'mobility' as const, durationSeconds: 30, targetMuscles: ['core'],
      equipment: 'bodyweight', instructions: ['Lie on back, arms and legs up', 'Press lower back into floor', 'Hold the position, breathing steadily'] },
  ],
};

// ---------------------------------------------------------------------------
// Cardio interval options
// ---------------------------------------------------------------------------
const CARDIO_WARMUP_OPTIONS = [
  { equipment: 'echo-bike' as const, name: 'Echo Bike',   shortName: 'Echo Bike',  instructions: ['Set resistance to light', 'Ride at conversational pace', 'Build intensity slightly each round'] },
  { equipment: 'rower'     as const, name: 'Row Erg',     shortName: 'Row Erg',    instructions: ['Set damper to 3-5', 'Row at steady 70% effort', 'Focus on smooth catch and drive'] },
  { equipment: 'ski-erg'   as const, name: 'SkiErg',      shortName: 'SkiErg',     instructions: ['Easy pull rhythm', 'Focus on hip hinge and arm extension', 'Build pace each round'] },
  { equipment: 'bodyweight' as const, name: 'Dynamic Cardio', shortName: 'Cardio', instructions: [] }, // instructions built dynamically
];

// ---------------------------------------------------------------------------
// Dynamic bodyweight cardio movement pool — randomly assembled each generation
// ---------------------------------------------------------------------------
const DYNAMIC_CARDIO_POOL: string[] = [
  'Jumping jacks 30s',
  'High knees 30s',
  'Butt kicks 30s',
  'Mountain climbers 30s',
  'Side shuffles 30s each direction',
  'Lateral bounds 30s',
  'Inchworm walkouts × 5 reps',
  'Arm circles 20s each direction',
  'Hip circles 20s each direction',
  'Torso twists 30s',
  'Alternating forward leg swings 20s each leg',
  'Alternating lateral leg swings 20s each leg',
  'Shoulder rolls forward & back 20s',
  'March in place with high knees 30s',
  'Squat jumps 30s',
  'Bear crawl 5 steps forward, 5 steps back',
  'Standing hip rotations 20s each side',
  'Calf raises 30s',
  'Alternating reverse lunges 30s',
  'Speed skaters 30s',
];

/** Pick 5 random movements from the pool, returned as instruction strings */
function buildDynamicCardioInstructions(): string[] {
  const shuffled = [...DYNAMIC_CARDIO_POOL].sort(() => Math.random() - 0.5);
  return [
    ...shuffled.slice(0, 5),
    'Repeat — build intensity with each round',
  ];
}

// ---------------------------------------------------------------------------
// Hip-circle and resistance-band activation circuits
// ---------------------------------------------------------------------------
const HIP_CIRCLE_ACTIVATIONS: WarmupItem[] = [
  { name: 'Hip Circle Lateral Band Walk', type: 'activation', durationSeconds: 40, targetMuscles: ['glutes'],
    equipment: 'hip-circle-band', instructions: ['Band above knees, sit into mini-squat', 'Step laterally 10 steps each direction', 'Keep constant tension against band', 'Stay low throughout'] },
  { name: 'Hip Circle Monster Walk', type: 'activation', durationSeconds: 40, targetMuscles: ['glutes'],
    equipment: 'hip-circle-band', instructions: ['Band above knees, slight squat', 'Step forward diagonally outward', 'Walk 10 steps forward, 10 back', 'Maintain knee-out pressure throughout'] },
  { name: 'Hip Circle Fire Hydrant', type: 'activation', durationSeconds: 40, targetMuscles: ['glutes'],
    equipment: 'hip-circle-band', instructions: ['All fours, band above knees', 'Raise knee out to side like a fire hydrant', '12-15 reps each side', 'Squeeze glute hard at the top'] },
  { name: 'Hip Circle Squat Activation', type: 'activation', durationSeconds: 45, targetMuscles: ['glutes', 'quads'],
    equipment: 'hip-circle-band', instructions: ['Band above knees, feet shoulder-width', 'Push knees out against band throughout', '15 bodyweight squats focusing on glute engagement', 'Pause 1s at bottom of each rep'] },
  { name: 'Hip Circle Glute Bridge', type: 'activation', durationSeconds: 40, targetMuscles: ['glutes', 'hamstrings'],
    equipment: 'hip-circle-band', instructions: ['Lie on back, band above knees, feet flat', 'Push knees slightly apart against band', 'Drive hips up squeezing glutes hard', '12-15 reps with 2s hold at top'] },
  { name: 'Hip Circle Standing Hip Abduction', type: 'activation', durationSeconds: 40, targetMuscles: ['glutes'],
    equipment: 'hip-circle-band', instructions: ['Band above knees, stand on one leg', 'Slowly raise working leg out to side against band', '12 reps each side', 'Keep standing leg slightly bent'] },
];

const RESISTANCE_BAND_ACTIVATIONS: WarmupItem[] = [
  { name: 'Band Pull-Apart', type: 'activation', durationSeconds: 35, targetMuscles: ['shoulders', 'back'],
    equipment: 'resistance-band', instructions: ['Hold band shoulder-width, arms extended in front', 'Pull band apart until arms straight out to sides', '15-20 reps', 'Pinch shoulder blades at end range'] },
  { name: 'Banded Good Morning', type: 'activation', durationSeconds: 40, targetMuscles: ['hamstrings', 'back'],
    equipment: 'resistance-band', instructions: ['Stand on band, loop over shoulders or neck', 'Hinge forward at hips keeping back neutral', '12-15 slow reps', 'Feel hamstring stretch at bottom'] },
  { name: 'Banded Hip Hinge Activation', type: 'activation', durationSeconds: 35, targetMuscles: ['glutes', 'hamstrings'],
    equipment: 'resistance-band', instructions: ['Band around hips anchored behind', 'Drive hips back against band tension', '12 reps focusing on glute engagement', 'Full hip extension at the top'] },
  { name: 'Lateral Band Walk', type: 'activation', durationSeconds: 35, targetMuscles: ['glutes'],
    equipment: 'resistance-band', instructions: ['Band above knees, slight squat position', 'Step side to side 10-12 steps each way', 'Keep toes forward', 'Maintain band tension throughout'] },
];

const BODYWEIGHT_ACTIVATIONS: WarmupItem[] = [
  { name: 'Glute Bridge Activation', type: 'activation', durationSeconds: 35, targetMuscles: ['glutes'],
    equipment: 'bodyweight', instructions: ['Lie on back, feet flat', 'Drive hips up squeezing glutes hard', '15 reps with 2s hold at top', 'Full hip extension each rep'] },
  { name: 'Fire Hydrant', type: 'activation', durationSeconds: 35, targetMuscles: ['glutes'],
    equipment: 'bodyweight', instructions: ['All fours, raise knee out to side', '15 reps each side', 'Squeeze glute at top', 'Keep hips square'] },
];

// ---------------------------------------------------------------------------
// Build warmup phase — 3-round circuit + targeted static stretches
// Structure: Opening cardio → 3 rounds of (cardio interval + activation + mobility) → static stretches
// ---------------------------------------------------------------------------
function buildWarmup(
  targetMuscles: MuscleGroup[],
  availableEquipment: string[],
  workoutDurationMinutes: number,
): WarmupItem[] {
  const warmup: WarmupItem[] = [];
  // Pick a random duration in 5-second steps inclusive of min/max
  const randomSeconds = (min: number, max: number) => {
    const steps = Math.floor((max - min) / 5) + 1;
    return min + Math.floor(Math.random() * steps) * 5;
  };

  // Scale the initial monostructural movement with the workout length.
  // 30m → 2m, 45m → 2:30, 60m → 3m, longer than 60m → 5m.
  const openingCardioSeconds =
    workoutDurationMinutes <= 30 ? 120
    : workoutDurationMinutes <= 45 ? 150
    : workoutDurationMinutes <= 60 ? 180
    : 300;

  // Build pool of ALL available cardio machines (not just the first match)
  const availableCardioPool = CARDIO_WARMUP_OPTIONS.filter(o =>
    availableEquipment.includes(o.equipment),
  );
  // Always have at least the bodyweight fallback
  const cardioPool = availableCardioPool.length > 0
    ? availableCardioPool
    : [CARDIO_WARMUP_OPTIONS[CARDIO_WARMUP_OPTIONS.length - 1]];

  // Shuffle so the opening machine is random each generation
  const shuffledCardio = [...cardioPool].sort(() => Math.random() - 0.5);

  // Helper: pick machine by position, cycling through the pool
  // This ensures each round uses a different machine when 2-3 are available
  const getCardioForIndex = (i: number) => shuffledCardio[i % shuffledCardio.length];

  // Opening cardio uses index 0; rounds 1-3 use indices 1, 2, 3 (wrapping as needed)
  const openingCardio = getCardioForIndex(0);

  // Pick activation exercises based on available equipment
  const activationPool: WarmupItem[] =
    availableEquipment.includes('hip-circle-band')  ? HIP_CIRCLE_ACTIVATIONS
    : availableEquipment.includes('resistance-band') ? RESISTANCE_BAND_ACTIVATIONS
    : BODYWEIGHT_ACTIVATIONS;

  // Shuffle pool so each workout gets variety
  const shuffled = [...activationPool].sort(() => Math.random() - 0.5);

  // ── Phase 1: Opening monostructural movement ─────────────────────────────
  const openingInstructions = openingCardio.equipment === 'bodyweight'
    ? buildDynamicCardioInstructions()
    : [...openingCardio.instructions, 'Start easy, then build gradually to a moderate pace'];

  warmup.push({
    name: `${openingCardio.name} Warmup`,
    type: 'cardio',
    durationSeconds: openingCardioSeconds,
    targetMuscles: ['cardio' as MuscleGroup],
    equipment: openingCardio.equipment,
    instructions: openingInstructions,
  });

  // ── Phase 2: 3-round circuit ─────────────────────────────────────────────
  // Build a pool of mobility/stretches for circuit rounds
  const mobilityCircuitPool: WarmupItem[] = [
    { name: 'Leg Swing (Forward/Back)', type: 'mobility' as const, durationSeconds: 35, targetMuscles: ['quads', 'hamstrings'],
      equipment: 'bodyweight', instructions: ['Hold wall for balance', 'Swing one leg forward and back 12 times', 'Gradually increase range', 'Switch legs'] },
    { name: 'Hip Circle Rotation', type: 'mobility' as const, durationSeconds: 35, targetMuscles: ['glutes', 'core'],
      equipment: 'bodyweight', instructions: ['Stand feet shoulder-width', 'Draw large circles with hips — 10 clockwise, 10 counter-clockwise', 'Gradually increase size of circles', 'Keep feet flat on floor'] },
    { name: 'World\'s Greatest Stretch', type: 'mobility' as const, durationSeconds: 45, targetMuscles: ['core', 'quads', 'back'],
      equipment: 'bodyweight', instructions: ['Lunge forward, plant same-side hand on floor', 'Open opposite arm toward ceiling, rotating thorax', 'Hold 2s, return and switch sides', '5 reps each side'] },
    { name: 'Inchworm', type: 'mobility' as const, durationSeconds: 40, targetMuscles: ['hamstrings', 'back'],
      equipment: 'bodyweight', instructions: ['Hinge forward and walk hands out to plank position', 'Walk feet back to hands', '5 slow reps', 'Feel the hamstring stretch each time'] },
    { name: 'Lateral Leg Swing', type: 'mobility' as const, durationSeconds: 35, targetMuscles: ['glutes', 'hamstrings'],
      equipment: 'bodyweight', instructions: ['Hold wall, swing leg side to side across body', '12 swings each leg', 'Gradually increase range of motion', 'Keep core stable'] },
    { name: 'Hip 90/90 Transition', type: 'mobility' as const, durationSeconds: 40, targetMuscles: ['glutes', 'hamstrings'],
      equipment: 'bodyweight', instructions: ['Sit in 90/90 position on floor', 'Rotate hips to switch 90/90 side to side', '8-10 transitions each direction', 'Work through any hip tightness'] },
  ];
  const mobilityCircuit = [...mobilityCircuitPool].sort(() => Math.random() - 0.5);

  const NUM_ROUNDS = 3;
  for (let r = 0; r < NUM_ROUNDS; r++) {
    const roundLabel = `Round ${r + 1}`;
    // Each round rotates to the next machine in the pool (indices 1, 2, 3 — cycling)
    const roundCardio = getCardioForIndex(r + 1);

    // Short monostructural interval inside each round
    warmup.push({
      name: `${roundCardio.shortName} — ${roundLabel}`,
      type: 'cardio',
      durationSeconds: 30,
      targetMuscles: ['cardio' as MuscleGroup],
      equipment: roundCardio.equipment,
      instructions: roundCardio.equipment === 'bodyweight'
        ? buildDynamicCardioInstructions()
        : [
            r === 0 ? 'Moderate pace — get your heart rate up' :
            r === 1 ? 'Push slightly harder than round 1' :
                      'Give it 85-90% effort for this final interval',
            'Breathe rhythmically',
            roundCardio.instructions[1] ?? '',
          ].filter(Boolean),
    });

    // Banded / bodyweight activation
    const activation = shuffled[r % shuffled.length];
    if (activation) {
      warmup.push({ ...activation, durationSeconds: randomSeconds(15, 20) });
    }

    // Dynamic mobility
    const mobility = mobilityCircuit[r % mobilityCircuit.length];
    if (mobility) {
      warmup.push({ ...mobility, durationSeconds: randomSeconds(20, 30) });
    }
  }

  // ── Phase 3: Targeted static stretches (5-7 based on muscle groups) ───────
  const stretched = new Set<MuscleGroup>();

  // Always add some universal lower-body/hip stretches
  const universalStretches: WarmupItem[] = [
    { name: 'Hip Flexor Lunge Stretch', type: 'stretch', durationSeconds: 40, targetMuscles: ['quads', 'glutes'],
      equipment: 'bodyweight', instructions: ['Step into a deep lunge', 'Lower back knee to floor, drive hips forward', 'Hold 20s each side', 'Keep torso upright'] },
    { name: 'Hip 90/90 Static Stretch', type: 'stretch', durationSeconds: 45, targetMuscles: ['glutes'],
      equipment: 'bodyweight', instructions: ['Sit with both legs at 90-degree angles on floor', 'Lean forward slowly over front leg', 'Hold 20s each side', 'Breathe into the stretch'] },
    { name: 'Standing Figure-4 Stretch', type: 'stretch', durationSeconds: 40, targetMuscles: ['glutes'],
      equipment: 'bodyweight', instructions: ['Stand, cross one ankle over opposite knee', 'Sit back into single-leg squat until stretch felt in glute', 'Hold 20s each side', 'Use wall if needed for balance'] },
  ];

  // Add up to 2 universal stretches
  for (let i = 0; i < Math.min(2, universalStretches.length); i++) {
    warmup.push({
      ...universalStretches[i],
      durationSeconds: randomSeconds(20, 30),
    });
  }

  // Add muscle-specific stretches for target muscles (up to 4 more)
  const allMuscles = [...targetMuscles];
  for (const muscle of allMuscles) {
    if (stretched.size >= 4) break;
    const options = WARMUP_STRETCHES[muscle];
    if (!options?.length) continue;
    // Pick both options if available (variety)
    for (const item of options) {
      if (stretched.size >= 4) break;
      warmup.push({ ...item, durationSeconds: randomSeconds(20, 30) });
    }
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
  // ── Active timed exercises (jump rope, timed cardio intervals, etc.) ───────
  if (exercise.durationSeconds) {
    const sets: WorkoutSet[] = Array.from({ length: config.sets }, (_, i) => ({
      setNumber: i + 1,
      targetReps: 1,
      targetDurationSeconds: exercise.durationSeconds,
      completed: false,
      restSeconds,
    }));
    return { sets };
  }

  // ── Static hold exercises (plank, dead hang, ring support hold, etc.) ──────
  if (exercise.isHold && exercise.holdSeconds) {
    const sets: WorkoutSet[] = Array.from({ length: config.sets }, (_, i) => ({
      setNumber: i + 1,
      targetReps: 1,
      targetHoldSeconds: exercise.holdSeconds,
      completed: false,
      restSeconds,
    }));
    return { sets };
  }

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
          if (exercise.equipment === 'dumbbell') {
            suggestedWeight = nextDumbbellWeight(avgW);
            const bumped = suggestedWeight > avgW;
            progressionNote = bumped
              ? `↑ Up to ${suggestedWeight}lbs from last session (was ${avgW}lbs × ${Math.round(avgR)} reps)`
              : `Same weight — already at heaviest dumbbell (${avgW}lbs × ${Math.round(avgR)} reps last time)`;
          } else if (exercise.equipment === 'kettlebell') {
            suggestedWeight = nextKettlebellWeight(avgW);
            const bumped = suggestedWeight > avgW;
            progressionNote = bumped
              ? `↑ Up to ${suggestedWeight}lbs from last session (was ${avgW}lbs × ${Math.round(avgR)} reps)`
              : `Same weight — already at heaviest kettlebell (${avgW}lbs × ${Math.round(avgR)} reps last time)`;
          } else {
            suggestedWeight = avgW + 5;
            progressionNote = `↑ Up 5lbs from last session (was ${avgW}lbs × ${Math.round(avgR)} reps)`;
          }
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

  // Always constrain free-weight targets to plates/bells that actually exist
  if (suggestedWeight !== undefined && exercise.category !== 'cardio') {
    suggestedWeight = snapSuggestedWeight(exercise.equipment, suggestedWeight);
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

/** Minutes consumed when adding the next movement (includes between-circuit rest). */
function costForNextMovement(alreadyCount: number, minsPerExercise: number): number {
  const between = alreadyCount > 0 ? BETWEEN_EXERCISE_MINUTES : 0;
  return minsPerExercise + between;
}

function pushBuiltExercise(
  result: WorkoutExercise[],
  exercise: Exercise,
  goal: WorkoutGoal,
  config: { sets: number; minReps: number; maxReps: number; restSeconds: number },
  restSeconds: number,
  recentWorkouts: Workout[],
): void {
  const { sets, progressionNote } = buildSets(exercise, goal, config, restSeconds, recentWorkouts);
  result.push({ exerciseId: exercise.id, exercise, sets, progressionNote });
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
  // Note: allowSupersets is handled by Claude's enhancement step (claudeService.ts)

  // Warmup is additional time; its opening movement scales with workout length.
  let budget = targetMinutes;
  if (goal === 'fat-loss') budget -= 8; // cardio finisher

  // Minutes per standard exercise
  const minsPerExercise = minutesForExercise(config.sets, restSeconds);
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

  const userPickedMuscles = Boolean(request.targetMuscleGroups?.length);
  let targetMuscles: MuscleGroup[];
  if (request.targetMuscleGroups?.length) {
    targetMuscles = request.targetMuscleGroups;
  } else {
    const fresh = ALL_MUSCLES.filter(m => !fatiguedMuscles.has(m));
    const estimatedExercises = Math.max(2, Math.floor(budget / (minsPerExercise + BETWEEN_EXERCISE_MINUTES)));
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
    ? buildWarmup(targetMuscles, settings.availableEquipment as string[], targetMinutes)
    : [];

  // 6. Build exercise list — fill the duration, not just one slot per muscle
  const result: WorkoutExercise[] = [];
  const exclude = new Set(request.excludeExerciseIds || []);
  const usedIds = new Set<string>(exclude);

  const shuffle = <T,>(arr: T[]): T[] =>
    [...arr].sort(() => Math.random() - 0.5);

  const pickExercise = (
    muscle: MuscleGroup,
    preferCompound: boolean,
  ): Exercise | undefined => {
    const pool = shuffle(available.filter(e =>
      e.primaryMuscle === muscle &&
      e.category !== 'mobility' &&
      !recentIds.has(e.id) &&
      !usedIds.has(e.id),
    ));
    // Prefer unused recent-filtered pool; if empty, allow recentIds (still unique)
    const fallbackPool = pool.length
      ? pool
      : shuffle(available.filter(e =>
        e.primaryMuscle === muscle &&
        e.category !== 'mobility' &&
        !usedIds.has(e.id),
      ));
    if (preferCompound) {
      return fallbackPool.find(e => e.category === 'compound') ?? fallbackPool[0];
    }
    // Alternate compounds and isolations for variety within one muscle focus
    const compounds = fallbackPool.filter(e => e.category === 'compound');
    const isolations = fallbackPool.filter(e => e.category === 'isolation');
    if (result.filter(r => r.exercise.primaryMuscle === muscle).length % 2 === 0) {
      return compounds[0] ?? isolations[0] ?? fallbackPool[0];
    }
    return isolations[0] ?? compounds[0] ?? fallbackPool[0];
  };

  const canAffordAnother = () =>
    budget >= costForNextMovement(result.length, minsPerExercise) * 0.85;

  // Round-robin across selected muscles until the time budget is spent
  const muscleQueue = [...targetMuscles];
  let cursor = 0;
  let preferCompoundPass = settings.preferCompound;

  while (muscleQueue.length > 0 && canAffordAnother()) {
    const muscle = muscleQueue[cursor % muscleQueue.length];
    const picked = pickExercise(muscle, preferCompoundPass);
    if (!picked) {
      muscleQueue.splice(cursor % muscleQueue.length, 1);
      if (muscleQueue.length === 0) break;
      continue;
    }

    usedIds.add(picked.id);
    budget -= costForNextMovement(result.length, minsPerExercise);
    pushBuiltExercise(result, picked, goal, config, restSeconds, recentWorkouts);
    cursor++;
    // After the first compound per muscle cycle, lean into accessories
    if (cursor >= targetMuscles.length) preferCompoundPass = false;
  }

  // If focus muscles couldn't fill the session, add complementary movements
  if (canAffordAnother()) {
    const slotsLeft = Math.max(
      1,
      Math.floor(budget / (minsPerExercise + BETWEEN_EXERCISE_MINUTES)),
    );
    const candidatePool = available.filter(e =>
      e.category !== 'mobility' &&
      e.primaryMuscle !== 'cardio' &&
      !usedIds.has(e.id),
    );

    let complementIds: string[] = [];
    try {
      complementIds = await suggestComplementaryExercises({
        focusMuscles: targetMuscles,
        existingIds: result.map(r => r.exerciseId),
        existingNames: result.map(r => r.exercise.name),
        candidates: candidatePool.map(e => ({
          id: e.id,
          n: e.name,
          m: e.primaryMuscle,
          eq: e.equipment,
          c: e.category,
        })),
        slotsNeeded: slotsLeft,
        remainingMinutes: Math.round(budget),
        goal,
      });
    } catch (err) {
      console.warn('[Engine] Complement suggestion failed:', err);
    }

    // Reserve Claude picks so fallback doesn't re-select them
    for (const id of complementIds) usedIds.add(id);

    const fallbackMuscles: MuscleGroup[] = [];
    for (const m of targetMuscles) {
      for (const c of COMPLEMENT_MUSCLES[m] ?? []) {
        if (!targetMuscles.includes(c) && !fallbackMuscles.includes(c)) {
          fallbackMuscles.push(c);
        }
      }
    }
    for (const m of ALL_MUSCLES) {
      if (!fallbackMuscles.includes(m) && !targetMuscles.includes(m)) {
        fallbackMuscles.push(m);
      }
    }

    // Top up if Claude returned nothing / too few — round-robin complements
    if (complementIds.length < slotsLeft && fallbackMuscles.length) {
      let fbCursor = 0;
      let stall = 0;
      while (complementIds.length < slotsLeft && stall < fallbackMuscles.length * 3) {
        const muscle = fallbackMuscles[fbCursor % fallbackMuscles.length];
        fbCursor++;
        const picked = pickExercise(muscle, false);
        if (!picked) {
          stall++;
          continue;
        }
        if (complementIds.includes(picked.id) || usedIds.has(picked.id)) {
          stall++;
          continue;
        }
        // Reserve so the next pickExercise call doesn't re-pick the same id
        usedIds.add(picked.id);
        complementIds.push(picked.id);
        stall = 0;
      }
    }

    for (const id of complementIds) {
      if (!canAffordAnother()) break;
      const exercise = available.find(e => e.id === id);
      if (!exercise || exercise.category === 'mobility') continue;
      // usedIds may already contain fallback picks; Claude picks still need marking
      if (!usedIds.has(id)) usedIds.add(id);
      // Skip if already in the workout (shouldn't happen, but safe)
      if (result.some(r => r.exerciseId === id)) continue;
      budget -= costForNextMovement(result.length, minsPerExercise);
      pushBuiltExercise(result, exercise, goal, config, restSeconds, recentWorkouts);
    }
  }

  // Core finisher only when the user didn't already focus core / include it
  if (
    !userPickedMuscles &&
    !result.some(r => r.exercise.primaryMuscle === 'core') &&
    canAffordAnother()
  ) {
    const core = pickExercise('core', false);
    if (core) {
      usedIds.add(core.id);
      budget -= costForNextMovement(result.length, minsPerExercise);
      pushBuiltExercise(result, core, goal, config, restSeconds, recentWorkouts);
    }
  }

  // Cardio finisher for fat-loss
  if (goal === 'fat-loss') {
    const cardio = available.filter(e => e.primaryMuscle === 'cardio' && !usedIds.has(e.id));
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
