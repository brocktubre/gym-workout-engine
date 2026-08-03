import { Exercise, Workout, WorkoutExercise, WorkoutSet, WorkoutGoal, MuscleGroup, UserSettings, GenerateWorkoutRequest, Equipment } from '../types';
import { getExercisesForEquipment } from './exerciseService';

const VOLUME_CONFIG: Record<WorkoutGoal, {
  sets: number; minReps: number; maxReps: number;
  restSeconds: number; estimatedSetMinutes: number;
}> = {
  strength:    { sets: 5, minReps: 3,  maxReps: 5,  restSeconds: 180, estimatedSetMinutes: 4   },
  hypertrophy: { sets: 4, minReps: 8,  maxReps: 12, restSeconds: 90,  estimatedSetMinutes: 2.5 },
  endurance:   { sets: 3, minReps: 15, maxReps: 20, restSeconds: 45,  estimatedSetMinutes: 1.5 },
  'fat-loss':  { sets: 3, minReps: 12, maxReps: 15, restSeconds: 60,  estimatedSetMinutes: 2   },
};

const STARTING_WEIGHTS: Partial<Record<MuscleGroup, Partial<Record<string, number>>>> = {
  chest:      { barbell: 60, dumbbell: 20, machine: 40, cable: 20 },
  back:       { barbell: 80, dumbbell: 25, machine: 50, cable: 30 },
  shoulders:  { barbell: 40, dumbbell: 12, machine: 30, cable: 15 },
  biceps:     { barbell: 30, dumbbell: 12, cable: 15, 'ez-bar': 25 },
  triceps:    { barbell: 40, dumbbell: 12, cable: 20 },
  quads:      { barbell: 80, machine: 60 },
  hamstrings: { barbell: 60, machine: 40 },
  glutes:     { barbell: 80, machine: 50 },
};

type VolumeConfig = typeof VOLUME_CONFIG[WorkoutGoal];

function buildSets(
  exercise: Exercise,
  goal: WorkoutGoal,
  config: VolumeConfig,
  recentWorkouts: Workout[]
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
          suggestedWeight = avgW + 2.5;
          progressionNote = `↑ Up 2.5kg from last session (was ${avgW}kg × ${Math.round(avgR)} reps)`;
        } else if (avgW > 0) {
          suggestedWeight = avgW;
          progressionNote = `Same weight — aim to complete all sets (${avgW}kg × ${Math.round(avgR)} reps last time)`;
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
    restSeconds: config.restSeconds,
  }));

  return { sets, progressionNote };
}

export async function generateWorkout(context: {
  settings: UserSettings;
  recentWorkouts: Workout[];
  request: GenerateWorkoutRequest;
}): Promise<WorkoutExercise[]> {
  const { settings, recentWorkouts, request } = context;
  const goal = request.goal || settings.goal;
  const config = VOLUME_CONFIG[goal];
  const targetMinutes = request.durationMinutes;

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
    const estimatedExCount = Math.floor(targetMinutes / (config.sets * config.estimatedSetMinutes));
    const muscleSlots = Math.min(4, Math.max(2, Math.floor(estimatedExCount / 2)));

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
    if (!targetMuscles.length) targetMuscles = ALL_MUSCLES.slice(0, muscleSlots);
  }

  // 5. Build exercise list
  const result: WorkoutExercise[] = [];
  let budget = targetMinutes - 5; // 5 min warmup
  if (goal === 'fat-loss') budget -= 10;

  const exclude = new Set(request.excludeExerciseIds || []);

  for (const muscle of targetMuscles) {
    if (budget <= 0) break;

    const pool = available.filter(e =>
      e.primaryMuscle === muscle &&
      !recentIds.has(e.id) &&
      !exclude.has(e.id)
    );

    const sorted = settings.preferCompound
      ? [...pool].sort((a, b) => (a.category === 'compound' ? -1 : 1))
      : pool;

    if (!sorted.length) continue;

    const primary = sorted[0];
    const { sets, progressionNote } = buildSets(primary, goal, config, recentWorkouts);
    result.push({ exerciseId: primary.id, exercise: primary, sets, progressionNote });
    budget -= config.sets * config.estimatedSetMinutes;

    // Isolation accessory if time allows
    if (budget > config.sets * config.estimatedSetMinutes) {
      const iso = pool.filter(
        e => e.category === 'isolation' && e.id !== primary.id && !recentIds.has(e.id)
      );
      if (iso.length) {
        const { sets: isoSets, progressionNote: isoNote } = buildSets(iso[0], goal, config, recentWorkouts);
        result.push({ exerciseId: iso[0].id, exercise: iso[0], sets: isoSets, progressionNote: isoNote });
        budget -= config.sets * config.estimatedSetMinutes;
      }
    }
  }

  // Core finisher if not already included
  if (!targetMuscles.includes('core') && budget > config.sets * 1.5) {
    const core = available.filter(e => e.primaryMuscle === 'core' && !recentIds.has(e.id));
    if (core.length) {
      const { sets, progressionNote } = buildSets(core[0], goal, config, recentWorkouts);
      result.push({ exerciseId: core[0].id, exercise: core[0], sets, progressionNote });
    }
  }

  // Cardio finisher for fat-loss
  if (goal === 'fat-loss') {
    const cardio = available.filter(e => e.primaryMuscle === 'cardio');
    if (cardio.length) {
      result.push({
        exerciseId: cardio[0].id,
        exercise: cardio[0],
        sets: [{ setNumber: 1, targetReps: 1, completed: false, restSeconds: 0 }],
        notes: '10 minutes steady-state cardio',
      });
    }
  }

  return result;
}
