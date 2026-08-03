import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, RefreshCw, Play, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExerciseItem } from '@/components/workout/ExerciseItem';
import { PageHeader } from '@/components/layout/PageHeader';
import { useGenerateWorkout, useActiveWorkout } from '@/hooks/useWorkoutEngine';
import { useCreateWorkout } from '@/hooks/useWorkouts';
import { toast } from '@/components/ui/use-toast';
import { getTodayDate, formatDuration } from '@/lib/utils';
import type { MuscleGroup, WorkoutGoal, WorkoutExercise } from '@/types';
import { cn } from '@/lib/utils';

const DURATION_OPTIONS = [30, 45, 60, 90];

const GOAL_OPTIONS: { value: WorkoutGoal; label: string; emoji: string }[] = [
  { value: 'strength', label: 'Strength', emoji: '💪' },
  { value: 'hypertrophy', label: 'Hypertrophy', emoji: '📈' },
  { value: 'endurance', label: 'Endurance', emoji: '🏃' },
  { value: 'fat-loss', label: 'Fat Loss', emoji: '🔥' },
];

const MUSCLE_OPTIONS: { value: MuscleGroup; label: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core' },
];

interface GeneratedWorkout {
  exercises: WorkoutExercise[];
  goal: WorkoutGoal;
  targetDurationMinutes: number;
}

export default function Generate() {
  const navigate = useNavigate();
  const [duration, setDuration] = useState(60);
  const [goal, setGoal] = useState<WorkoutGoal>('hypertrophy');
  const [targetMuscles, setTargetMuscles] = useState<MuscleGroup[]>([]);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);

  const generateMutation = useGenerateWorkout();
  const createWorkoutMutation = useCreateWorkout();
  const { startWorkout } = useActiveWorkout();

  const toggleMuscle = (muscle: MuscleGroup) => {
    setTargetMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
  };

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({
        durationMinutes: duration,
        goal,
        targetMuscleGroups: targetMuscles.length > 0 ? targetMuscles : undefined,
      });
      setGeneratedWorkout(result.workout);
    } catch (err) {
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Could not generate workout',
        variant: 'error',
      });
    }
  };

  const handleStartWorkout = async () => {
    if (!generatedWorkout) return;

    try {
      const now = new Date().toISOString();
      const workout = await createWorkoutMutation.mutateAsync({
        date: getTodayDate(),
        createdAt: now,
        status: 'in-progress',
        exercises: generatedWorkout.exercises,
        targetDurationMinutes: generatedWorkout.targetDurationMinutes,
        goal: generatedWorkout.goal,
      });

      startWorkout(workout);
      navigate('/active');
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not start workout',
        variant: 'error',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PageHeader
        title="Generate Workout"
        subtitle="Build your perfect session"
      />

      <div className="px-4 space-y-5 pb-6">
        {/* Duration */}
        <section>
          <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">
            Duration
          </h3>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border',
                  duration === d
                    ? 'bg-[#FF375F] text-white border-[#FF375F]'
                    : 'bg-[#1c1c1e] text-[#8E8E93] border-[#38383A] hover:bg-[#2c2c2e]',
                )}
              >
                {formatDuration(d)}
              </button>
            ))}
          </div>
        </section>

        {/* Goal */}
        <section>
          <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">
            Goal
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g.value}
                onClick={() => setGoal(g.value)}
                className={cn(
                  'flex items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-colors border text-left',
                  goal === g.value
                    ? 'bg-[#FF375F]/20 text-[#FF375F] border-[#FF375F]/40'
                    : 'bg-[#1c1c1e] text-[#8E8E93] border-[#38383A] hover:bg-[#2c2c2e]',
                )}
              >
                <span className="text-base">{g.emoji}</span>
                {g.label}
              </button>
            ))}
          </div>
        </section>

        {/* Target Muscles (optional) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider">
              Target Muscles
            </h3>
            <span className="text-xs text-[#8E8E93]">Optional</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_OPTIONS.map((m) => {
              const isSelected = targetMuscles.includes(m.value);
              return (
                <button
                  key={m.value}
                  onClick={() => toggleMuscle(m.value)}
                  className={cn(
                    'flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-medium transition-colors border',
                    isSelected
                      ? 'bg-[#FF375F]/20 text-[#FF375F] border-[#FF375F]/40'
                      : 'bg-[#1c1c1e] text-[#8E8E93] border-[#38383A] hover:bg-[#2c2c2e]',
                  )}
                >

                  {m.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Generate button */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Generate Workout
            </>
          )}
        </Button>

        {/* Generated workout preview */}
        <AnimatePresence>
          {generateMutation.isPending && !generatedWorkout && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </motion.div>
          )}

          {generatedWorkout && !generateMutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Summary row */}
              <div className="flex items-center justify-between bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4">
                <div className="flex items-center gap-2 text-sm text-[#8E8E93]">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(generatedWorkout.targetDurationMinutes)} estimated</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#8E8E93]">
                  <ChevronRight className="h-4 w-4" />
                  <span>{generatedWorkout.exercises.length} exercises</span>
                </div>
              </div>

              {/* Exercise list */}
              <div className="space-y-2">
                {generatedWorkout.exercises.map((we, i) => (
                  <ExerciseItem key={we.exerciseId} workoutExercise={we} index={i} />
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button
                  className="flex-2 flex-grow"
                  size="lg"
                  onClick={handleStartWorkout}
                  disabled={createWorkoutMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2 fill-white" />
                  {createWorkoutMutation.isPending ? 'Starting...' : 'Start Workout'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
