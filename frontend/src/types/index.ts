export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'cardio';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'bodyweight'
  | 'rings'
  | 'pull-up-bar'
  | 'resistance-band'
  | 'hip-circle-band'
  | 'battle-rope'
  | 'sled'
  | 'plyometric-box'
  | 'weight-vest'
  | 'sandbag'
  | 'medicine-ball'
  | 'echo-bike'
  | 'rower'
  | 'ski-erg'
  | 'machine'
  | 'cable'
  | 'ez-bar'
  | 'plate'
  | 'parallettes'
  | 'monkey-feet';

export type MovementType = 'push' | 'pull' | 'legs' | 'hinge' | 'core' | 'cardio' | 'mobility';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutGoal = 'strength' | 'hypertrophy' | 'endurance' | 'fat-loss';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: 'compound' | 'isolation' | 'cardio' | 'mobility';
  movementType: MovementType;
  difficulty: Difficulty;
  instructions: string[];
  tips: string[];
  /** True when this exercise is a timed static hold (plank, dead hang, etc.) */
  isHold?: boolean;
  /** Default hold duration in seconds for isHold exercises */
  holdSeconds?: number;
  /** Default work interval for active timed movements such as jump rope */
  durationSeconds?: number;
}

export interface WorkoutSet {
  setNumber: number;
  targetReps: number;
  targetWeight?: number;
  completedReps?: number;
  completedWeight?: number;
  completed: boolean;
  restSeconds: number;
  /** For isHold exercises: target hold duration in seconds */
  targetHoldSeconds?: number;
  /** For isHold exercises: actual hold duration completed */
  completedHoldSeconds?: number;
  /** For active timed exercises: target work interval in seconds */
  targetDurationSeconds?: number;
  /** For active timed exercises: actual work interval completed */
  completedDurationSeconds?: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  notes?: string;
  progressionNote?: string;
  /** If set, this exercise is part of a superset */
  supersetGroupId?: string;
  /** 1 = first in superset, 2 = second, etc. */
  supersetOrder?: number;
}

export interface WarmupItem {
  name: string;
  type: 'cardio' | 'stretch' | 'mobility' | 'activation';
  durationSeconds: number;
  targetMuscles: MuscleGroup[];
  equipment?: Equipment;
  instructions: string[];
  completed?: boolean;
  skipped?: boolean;
}

export interface Workout {
  id: string;
  date: string;
  createdAt: string;
  completedAt?: string;
  status: 'generated' | 'in-progress' | 'completed' | 'skipped';
  exercises: WorkoutExercise[];
  targetDurationMinutes: number;
  actualDurationMinutes?: number;
  goal: WorkoutGoal;
  notes?: string;
  totalVolume?: number;
  warmup?: WarmupItem[];
  warmupStatus?: 'pending' | 'in-progress' | 'completed' | 'skipped';
  /** ISO timestamp when the workout was actually started (not generated) */
  startedAt?: string;
  /** Accumulated pause time in milliseconds across all pause/resume cycles */
  totalPausedMs?: number;
  /** ISO timestamp of the most recent pause start; cleared on resume */
  lastPausedAt?: string;
  /** Optimistic-locking version; incremented on every server write */
  version?: number;
  /** Cognito sub of the user who created this workout — used to isolate per-user queries */
  userId?: string;
  /** Local calendar date of the daily plan this session was started from */
  fromDailyDate?: string;
}

export interface UserSettings {
  availableEquipment: Equipment[];
  goal: WorkoutGoal;
  fitnessLevel: Difficulty;
  defaultDurationMinutes: number;
  restBetweenSetsSeconds: number;
  fatigueWindowHours: number;
  exerciseVarietyDays: number;
  preferCompound: boolean;
  targetMuscleGroups?: MuscleGroup[];
  /** Include warmup phase at start of each workout */
  includeWarmup?: boolean;
  /** Allow superset pairings in generated workouts */
  allowSupersets?: boolean;
  /**
   * When true, Dashboard shows a control to regenerate today’s daily workout.
   * Default off — daily plan stays fixed once created.
   */
  allowDailyRegenerate?: boolean;
  /** Speak workout cues via Amazon Polly (warmup, sets, rest, etc.) */
  voiceCoachingEnabled?: boolean;
  /** Biological sex — used to scale suggested loads */
  sex?: 'male' | 'female';
  /** Standing height in total inches */
  heightInches?: number;
  /** Body weight in pounds */
  bodyWeightLbs?: number;
  /** User completed or skipped the first-login body profile prompt */
  bodyProfileDismissed?: boolean;
}

export interface GenerateWorkoutRequest {
  durationMinutes: number;
  goal?: WorkoutGoal;
  targetMuscleGroups?: MuscleGroup[];
  excludeExerciseIds?: string[];
  includeWarmup?: boolean;
  allowSupersets?: boolean;
}

export interface WorkoutStats {
  totalWorkouts: number;
  currentStreak: number;
  longestStreak: number;
  totalVolumeKg: number;
  averageDurationMinutes: number;
  favoriteExercise?: string;
  muscleGroupFrequency: Partial<Record<MuscleGroup, number>>;
}
