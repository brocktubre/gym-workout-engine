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
  | 'landmine'
  | 'resistance-band'
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
  | 'ez-bar';

export type MovementType = 'push' | 'pull' | 'legs' | 'hinge' | 'core' | 'cardio';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutGoal = 'strength' | 'hypertrophy' | 'endurance' | 'fat-loss';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: 'compound' | 'isolation' | 'cardio';
  movementType: MovementType;
  difficulty: Difficulty;
  instructions: string[];
  tips: string[];
}

export interface WorkoutSet {
  setNumber: number;
  targetReps: number;
  targetWeight?: number;
  completedReps?: number;
  completedWeight?: number;
  completed: boolean;
  restSeconds: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  notes?: string;
  progressionNote?: string;
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
}

export interface GenerateWorkoutRequest {
  durationMinutes: number;
  goal?: WorkoutGoal;
  targetMuscleGroups?: MuscleGroup[];
  excludeExerciseIds?: string[];
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
