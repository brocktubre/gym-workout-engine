import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, SkipForward, CheckCircle2 } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowTrendUp } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { SetRow } from '@/components/workout/SetRow';
import { WorkoutTimer, RestTimer } from '@/components/workout/WorkoutTimer';
import { MuscleGroupBadge } from '@/components/workout/MuscleGroupBadge';
import { useActiveWorkout, useWorkoutTimer, useRestCountdown } from '@/hooks/useWorkoutEngine';
import { useCompleteWorkout, useUpdateWorkout } from '@/hooks/useWorkouts';
import { toast } from '@/components/ui/use-toast';
import { calculateVolume } from '@/lib/utils';
import type { WorkoutSet } from '@/types';

export default function ActiveWorkout() {
  const navigate = useNavigate();
  const { activeWorkout, updateActiveWorkout, clearActiveWorkout } = useActiveWorkout();
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const { elapsed } = useWorkoutTimer(activeWorkout !== null);
  const { restSeconds, isResting, startRest, skipRest } = useRestCountdown();

  const completeWorkoutMutation = useCompleteWorkout();
  const updateWorkoutMutation = useUpdateWorkout();

  // No active workout – redirect
  if (!activeWorkout) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4 px-4">
        <CheckCircle2 className="h-16 w-16 text-[#38383A]" />
        <p className="text-[#8E8E93] text-center">No active workout. Generate one first!</p>
        <Button onClick={() => navigate('/generate')}>Generate Workout</Button>
      </div>
    );
  }

  const exercises = activeWorkout.exercises;
  const currentExercise = exercises[currentExerciseIndex];
  const isLastExercise = currentExerciseIndex === exercises.length - 1;
  const totalSets = exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const completedSets = exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completed).length,
    0,
  );
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const handleSetUpdate = useCallback(
    (setIndex: number, field: 'weight' | 'reps', value: number) => {
      const updated = { ...activeWorkout };
      const setObj = { ...updated.exercises[currentExerciseIndex].sets[setIndex] };
      if (field === 'weight') {
        setObj.completedWeight = value;
      } else {
        setObj.completedReps = value;
      }
      updated.exercises[currentExerciseIndex].sets[setIndex] = setObj;
      updateActiveWorkout(updated);
    },
    [activeWorkout, currentExerciseIndex, updateActiveWorkout],
  );

  const handleSetComplete = useCallback(
    (setIndex: number, weight: number, reps: number) => {
      const updated = { ...activeWorkout };
      const set: WorkoutSet = {
        ...updated.exercises[currentExerciseIndex].sets[setIndex],
        completedWeight: weight,
        completedReps: reps,
        completed: true,
      };
      updated.exercises[currentExerciseIndex].sets[setIndex] = set;
      updateActiveWorkout(updated);

      // Start rest timer
      const restSecs = set.restSeconds ?? 90;
      startRest(restSecs);

      toast({ title: `Set ${setIndex + 1} complete`, variant: 'success', duration: 1500 });
    },
    [activeWorkout, currentExerciseIndex, updateActiveWorkout, startRest],
  );

  const handleNextExercise = () => {
    skipRest();
    setCurrentExerciseIndex((i) => Math.min(i + 1, exercises.length - 1));
  };

  const handleSkipExercise = () => {
    skipRest();
    if (!isLastExercise) {
      setCurrentExerciseIndex((i) => i + 1);
    }
  };

  const handleCompleteWorkout = async () => {
    const durationMinutes = Math.round(elapsed / 60);
    const totalVolume = exercises.reduce((acc, e) => acc + calculateVolume(e.sets), 0);

    const updated = {
      ...activeWorkout,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
      actualDurationMinutes: durationMinutes,
      totalVolume,
    };

    try {
      await completeWorkoutMutation.mutateAsync({
        date: activeWorkout.date,
        id: activeWorkout.id,
      });
    } catch {
      // If API fails, still save locally
    }

    try {
      await updateWorkoutMutation.mutateAsync({
        date: activeWorkout.date,
        id: activeWorkout.id,
        updates: {
          status: 'completed',
          completedAt: updated.completedAt,
          actualDurationMinutes: durationMinutes,
          totalVolume,
          exercises: activeWorkout.exercises,
        },
      });
    } catch {
      // ignore
    }

    updateActiveWorkout(updated);
    clearActiveWorkout();
    toast({
      title: 'Workout Complete!',
      description: `${exercises.length} exercises · ${durationMinutes}min`,
      variant: 'success',
    });
    navigate('/history');
  };

  const handleExit = () => {
    clearActiveWorkout();
    setShowExitDialog(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-xl z-40 px-4 pt-14 pb-3 border-b border-[#38383A]">
        <div className="flex items-center justify-between mb-3">
          <button
            className="h-9 w-9 rounded-full bg-[#2c2c2e] flex items-center justify-center text-[#8E8E93] hover:text-white transition-colors"
            onClick={() => setShowExitDialog(true)}
          >
            <X className="h-4 w-4" />
          </button>
          <WorkoutTimer elapsed={elapsed} size="default" />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowExitDialog(true)}
          >
            Finish
          </Button>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-[#8E8E93]">
            <span>
              Exercise {currentExerciseIndex + 1} of {exercises.length}
            </span>
            <span>{completedSets}/{totalSets} sets done</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Current exercise header */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentExerciseIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white leading-tight">
                    {currentExercise?.exercise.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    {currentExercise && (
                      <MuscleGroupBadge muscle={currentExercise.exercise.primaryMuscle} />
                    )}
                    <span className="text-xs text-[#8E8E93] capitalize">
                      {currentExercise?.exercise.equipment.replace('-', ' ')}
                    </span>
                  </div>
                </div>
                <div className="bg-[#2c2c2e] rounded-xl px-3 py-1.5 text-center">
                  <p className="text-lg font-bold text-white">
                    {currentExercise?.sets.length ?? 0}
                  </p>
                  <p className="text-[10px] text-[#8E8E93]">sets</p>
                </div>
              </div>
              {currentExercise?.progressionNote && (
                <div className="flex items-center gap-1.5 mt-2 bg-[#30D158]/10 rounded-xl px-3 py-2">
                  <span className="text-[#30D158] text-xs font-medium">
                    <><FontAwesomeIcon icon={faArrowTrendUp} className="mr-1.5" />{currentExercise.progressionNote}</>
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Rest timer overlay */}
        <AnimatePresence>
          {isResting && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex justify-center py-2"
            >
              <RestTimer
                seconds={restSeconds}
                totalSeconds={currentExercise?.sets[0]?.restSeconds ?? 90}
                onSkip={skipRest}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sets */}
        {!isResting && (
          <div className="space-y-2">
            {currentExercise?.sets.map((set, si) => (
              <SetRow
                key={`${currentExerciseIndex}-${si}`}
                set={set}
                isActive={!set.completed}
                onComplete={(weight, reps) => handleSetComplete(si, weight, reps)}
                onChange={(field, value) => handleSetUpdate(si, field, value)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="sticky bottom-[83px] px-4 py-3 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[#38383A]">
        <div className="flex gap-3">
          {!isLastExercise ? (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSkipExercise}
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip
              </Button>
              <Button
                className="flex-[2]"
                onClick={handleNextExercise}
              >
                Next Exercise
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <Button
              className="w-full"
              size="lg"
              variant="success"
              onClick={handleCompleteWorkout}
              disabled={completeWorkoutMutation.isPending || updateWorkoutMutation.isPending}
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {completeWorkoutMutation.isPending ? 'Saving...' : 'Complete Workout'}
            </Button>
          )}
        </div>
      </div>

      {/* Exit confirmation dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Workout?</DialogTitle>
            <DialogDescription>
              Your progress will be lost. Are you sure you want to exit?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowExitDialog(false)}
            >
              Keep Going
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleExit}
            >
              End Workout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
