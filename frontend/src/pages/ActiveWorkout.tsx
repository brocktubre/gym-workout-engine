import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SkipForward, CheckCircle2, ArrowLeftRight, ChevronRight } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowTrendUp, faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { SetRow } from '@/components/workout/SetRow';
import { WorkoutTimer, RestTimer } from '@/components/workout/WorkoutTimer';
import { MuscleGroupBadge } from '@/components/workout/MuscleGroupBadge';
import { useActiveWorkout, useWorkoutTimer, useRestCountdown } from '@/hooks/useWorkoutEngine';
import { useCompleteWorkout, useUpdateWorkout, useDeleteWorkout } from '@/hooks/useWorkouts';
import { toast } from '@/components/ui/use-toast';
import { calculateVolume } from '@/lib/utils';
import type { WorkoutSet, WorkoutExercise, WarmupItem, Workout, Exercise } from '@/types';
import { SwapExerciseSheet } from '@/components/workout/SwapExerciseSheet';

// ── Superset turn logic ───────────────────────────────────────────────────────

interface WorkoutTurn {
  exerciseIndex: number;
  setIndex: number;
  isSuperset: boolean;
  supersetGroupId?: string;
  /** True when the NEXT turn is a different exercise — triggers 60s rest */
  betweenExercise: boolean;
}

const BETWEEN_EXERCISE_REST = 60; // 1 minute always between different movements

function buildTurns(exercises: WorkoutExercise[]): WorkoutTurn[] {
  const turns: WorkoutTurn[] = [];
  const processedGroups = new Set<string>();

  exercises.forEach((ex, ei) => {
    if (ex.supersetGroupId) {
      if (processedGroups.has(ex.supersetGroupId)) return;
      processedGroups.add(ex.supersetGroupId);

      // Gather all partners sorted by supersetOrder
      const partners = exercises
        .map((e, i) => ({ exercise: e, index: i }))
        .filter(({ exercise }) => exercise.supersetGroupId === ex.supersetGroupId)
        .sort((a, b) => (a.exercise.supersetOrder ?? 0) - (b.exercise.supersetOrder ?? 0));

      const maxSets = Math.max(...partners.map((p) => p.exercise.sets.length));

      // Interleave: A1, B1, A2, B2 ...
      for (let s = 0; s < maxSets; s++) {
        for (const { exercise, index } of partners) {
          if (s < exercise.sets.length) {
            turns.push({
              exerciseIndex: index,
              setIndex: s,
              isSuperset: true,
              supersetGroupId: ex.supersetGroupId,
              betweenExercise: false,
            });
          }
        }
      }
    } else {
      ex.sets.forEach((_, si) => {
        turns.push({ exerciseIndex: ei, setIndex: si, isSuperset: false, betweenExercise: false });
      });
    }
  });

  // Annotate each turn: is the next turn a different exercise/superset group?
  for (let i = 0; i < turns.length; i++) {
    const cur = turns[i];
    const nxt = turns[i + 1];
    if (!nxt) {
      cur.betweenExercise = false;
      continue;
    }
    const sameGroup = cur.supersetGroupId && cur.supersetGroupId === nxt.supersetGroupId;
    const sameExercise = cur.exerciseIndex === nxt.exerciseIndex;
    cur.betweenExercise = !sameGroup && !sameExercise;
  }

  return turns;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActiveWorkout() {
  const navigate = useNavigate();
  const { activeWorkout, updateActiveWorkout, clearActiveWorkout, pauseWorkout, resumeFromPause, getSavedElapsed, getSavedTurnIndex, isPaused } = useActiveWorkout();
  const [currentTurnIndex, setCurrentTurnIndex] = useState(() => getSavedTurnIndex());
  const [showExitDialog, setShowExitDialog] = useState(false);
  // Local state drives warmup visibility — immediate sync update avoids black screen on transition
  const [showWarmup, setShowWarmup] = useState(
    () => activeWorkout?.warmupStatus === 'pending' && (activeWorkout?.warmup?.length ?? 0) > 0
  );
  const [showSwapSheet, setShowSwapSheet] = useState(false);

  const handleSwapExercise = (newExercise: Exercise) => {
    if (!activeWorkout || !currentTurn) return;
    const idx = currentTurn.exerciseIndex;
    const original = exercises[idx];
    if (!original) return;
    const updatedExercises = exercises.map((ex, i) =>
      i === idx
        ? {
            ...ex,
            exerciseId: newExercise.id,
            exercise: newExercise,
            progressionNote: undefined,
            sets: ex.sets.map(s => ({
              ...s,
              targetWeight:
                newExercise.equipment === 'bodyweight' || newExercise.equipment === 'rings'
                  ? undefined
                  : s.targetWeight,
            })),
          }
        : ex,
    );
    updateActiveWorkout({ exercises: updatedExercises });
    toast({ title: `Swapped to ${newExercise.name}`, variant: 'success', duration: 2000 });
  };

  const { elapsed } = useWorkoutTimer(activeWorkout !== null && !isPaused, isPaused ? getSavedElapsed() : undefined);
  const { restSeconds, isResting, startRest, skipRest } = useRestCountdown();
  const wasRestingRef = useRef(false);
  // Track the total rest seconds the current timer was started with (for the progress arc)
  const restTotalRef = useRef(90);

  // If workout was paused, resume the timer on mount
  useEffect(() => {
    if (isPaused) {
      resumeFromPause();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const completeWorkoutMutation = useCompleteWorkout();
  const updateWorkoutMutation = useUpdateWorkout();
  const deleteWorkoutMutation = useDeleteWorkout();

  // ── ALL hooks before any conditional return (Rules of Hooks) ──────────────

  // Safe derived state — uses optional chaining so null activeWorkout is fine
  const exercises = activeWorkout?.exercises ?? [];
  // Use local showWarmup state so transition is immediate (not waiting on async setState)
  const warmupPending = showWarmup;

  const handleWarmupComplete = useCallback(
    (updatedWarmup: WarmupItem[]) => {
      setShowWarmup(false); // Immediate — no black screen between warmup and workout
      updateActiveWorkout({ warmup: updatedWarmup, warmupStatus: 'completed' });
    },
    [updateActiveWorkout],
  );
  const handleSkipAllWarmup = useCallback(() => {
    setShowWarmup(false); // Immediate — no black screen
    updateActiveWorkout({ warmupStatus: 'skipped' });
  }, [updateActiveWorkout]);

  const turns = useMemo(() => buildTurns(exercises), [exercises]);

  useEffect(() => {
    if (!isResting && wasRestingRef.current) {
      wasRestingRef.current = false;
      setCurrentTurnIndex((i) => Math.min(i + 1, turns.length - 1));
    }
    if (isResting) wasRestingRef.current = true;
  }, [isResting, turns.length]);

  // ── Conditional returns — no hooks after this point ──────────────────────

  if (!activeWorkout) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4 px-4">
        <CheckCircle2 className="h-16 w-16 text-[#38383A]" />
        <p className="text-[#8E8E93] text-center">No active workout. Generate one first!</p>
        <Button onClick={() => navigate('/generate')}>Generate Workout</Button>
      </div>
    );
  }

  if (warmupPending) {
    const warmupItems = activeWorkout.warmup!;
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-xl z-40 px-4 pt-14 pb-4 border-b border-[#38383A]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Warmup</h1>
              <p className="text-sm text-[#8E8E93]">
                {Math.round(warmupItems.reduce((s, i) => s + i.durationSeconds, 0) / 60)} min before your workout
              </p>
            </div>
            <WorkoutTimer elapsed={elapsed} size="default" />
          </div>
        </div>
        {/* Warmup list */}
        <div className="flex-1 px-4 py-4 space-y-2 pb-[160px]">
          {warmupItems.map((item, i) => {
            const typeColors: Record<string, string> = {
              cardio: 'bg-[#FF375F]/20 text-[#FF375F] border-[#FF375F]/30',
              stretch: 'bg-[#0A84FF]/20 text-[#0A84FF] border-[#0A84FF]/30',
              mobility: 'bg-[#BF5AF2]/20 text-[#BF5AF2] border-[#BF5AF2]/30',
            };
            const durationLabel = item.durationSeconds >= 60
              ? `${Math.round(item.durationSeconds / 60)} min`
              : `${item.durationSeconds}s`;
            return (
              <div key={i} className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4">
                <div className="flex items-start gap-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border flex-shrink-0 mt-0.5 ${typeColors[item.type] ?? 'bg-gray-500/20 text-gray-400'}`}>
                    {item.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      <span className="text-xs text-[#FF375F] font-semibold ml-2 flex-shrink-0">{durationLabel}</span>
                    </div>
                    <ul className="space-y-0.5">
                      {item.instructions.map((instr, j) => (
                        <li key={j} className="text-xs text-[#8E8E93] flex gap-1.5">
                          <span className="text-[#48484A] flex-shrink-0">{j + 1}.</span>
                          <span>{instr}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Bottom actions */}
        <div className="fixed bottom-[83px] left-0 right-0 px-4 py-3 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[#38383A]">
          <div className="flex gap-3 items-stretch">
            <Button variant="outline" size="lg" onClick={handleSkipAllWarmup} className="flex-1 h-14">
              Skip Warmup
            </Button>
            <Button
              size="lg"
              className="flex-[2] h-14"
              onClick={() => handleWarmupComplete(warmupItems.map(item => ({ ...item, completed: true })))}
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Warmup Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const totalSets = exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const completedSets = exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completed).length,
    0,
  );
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const isLastTurn = currentTurnIndex >= turns.length - 1;
  const currentTurn = turns[currentTurnIndex];

  if (!currentTurn) {
    // All turns done but user hasn't tapped "Complete" yet — show complete button
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4 px-4">
        <CheckCircle2 className="h-16 w-16 text-[#30D158]" />
        <p className="text-white text-lg font-bold">All sets done!</p>
        <Button
          size="lg"
          variant="success"
          onClick={() => handleCompleteWorkout()}
        >
          <CheckCircle2 className="h-5 w-5 mr-2" />
          Complete Workout
        </Button>
      </div>
    );
  }

  const currentExercise = exercises[currentTurn.exerciseIndex];

  // For superset display: find ALL members of the superset group (supports 2-4)
  let supersetMembers: WorkoutExercise[] = [];
  let supersetTypeName = '';
  if (currentTurn.isSuperset && currentTurn.supersetGroupId) {
    supersetMembers = exercises
      .filter(e => e.supersetGroupId === currentTurn.supersetGroupId)
      .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));
    supersetTypeName =
      supersetMembers.length === 2 ? 'Superset'
      : supersetMembers.length === 3 ? 'Tri-Set'
      : 'Giant Set';
  }
  // Position of the current exercise within its superset (0-based)
  const supersetPosition = supersetMembers.findIndex(
    e => e.exerciseId === currentExercise?.exerciseId,
  );

  // Unique exercise count for "Exercise X of Y" counter
  const exerciseCount = exercises.length;
  const currentExerciseNumber = currentTurn.exerciseIndex + 1;
  const setNumber = currentTurn.setIndex + 1;
  const totalExerciseSets = currentExercise?.sets.length ?? 0;

  // Auto-advance is handled by the single useEffect above the conditional returns

  // ── Event handlers ─────────────────────────────────────────────────────────

  function handleSetUpdate(field: 'weight' | 'reps', value: number) {
    if (!currentTurn) return;
    if (!activeWorkout) return;
    const updated = { ...activeWorkout, exercises: [...(activeWorkout.exercises ?? [])] };
    const setObj = { ...(updated.exercises[currentTurn.exerciseIndex]?.sets[currentTurn.setIndex] ?? {}) };
    if (field === 'weight') {
      setObj.completedWeight = value;
    } else {
      setObj.completedReps = value;
    }
    if (updated.exercises[currentTurn.exerciseIndex]) {
      updated.exercises[currentTurn.exerciseIndex] = { ...updated.exercises[currentTurn.exerciseIndex] };
      updated.exercises[currentTurn.exerciseIndex].sets[currentTurn.setIndex] = setObj as WorkoutSet;
    }
    updateActiveWorkout(updated as Workout);
  }

  function handleSetComplete(weight: number, reps: number) {
    if (!currentTurn) return;
    if (!activeWorkout) return;
    const updated = { ...activeWorkout, exercises: [...(activeWorkout.exercises ?? [])] };
    updated.exercises[currentTurn.exerciseIndex] = { ...updated.exercises[currentTurn.exerciseIndex] };
    const set: WorkoutSet = {
      ...(updated.exercises[currentTurn.exerciseIndex]?.sets[currentTurn.setIndex] ?? {}),
      targetReps: updated.exercises[currentTurn.exerciseIndex]?.sets[currentTurn.setIndex]?.targetReps ?? 0,
      completedWeight: weight,
      completedReps: reps,
      completed: true,
    };
    updated.exercises[currentTurn.exerciseIndex].sets[currentTurn.setIndex] = set;
    updateActiveWorkout(updated as Workout);

    toast({ title: `Set ${currentTurn.setIndex + 1} complete`, variant: 'success', duration: 1500 });

    // Within a superset: if the next turn is in the SAME round (same setIndex, same group),
    // advance immediately without a rest timer — you move straight to the next movement.
    const nextTurn = turns[currentTurnIndex + 1];
    const sameRound =
      currentTurn.isSuperset &&
      nextTurn?.supersetGroupId === currentTurn.supersetGroupId &&
      nextTurn?.setIndex === currentTurn.setIndex;

    if (sameRound) {
      setCurrentTurnIndex(i => Math.min(i + 1, turns.length - 1));
    } else {
      const restSecs = currentTurn.betweenExercise
        ? BETWEEN_EXERCISE_REST
        : (set.restSeconds ?? 90);
      restTotalRef.current = restSecs;
      startRest(restSecs);
    }
  }

  function handleSkipSet() {
    skipRest();
    if (!isLastTurn) {
      setCurrentTurnIndex((i) => i + 1);
    }
  }

  async function handleCompleteWorkout() {
    const durationMinutes = Math.round(elapsed / 60);
    const totalVolume = exercises.reduce((acc, e) => acc + calculateVolume(e.sets), 0);

    const updated = {
      ...activeWorkout,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
      actualDurationMinutes: durationMinutes,
      totalVolume,
    };

    if (!activeWorkout) return;
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
        date: activeWorkout?.date ?? '',
        id: activeWorkout?.id ?? '',
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
      title: 'Workout Complete! 🎉',
      description: `${exercises.length} exercises · ${durationMinutes}min`,
      variant: 'success',
    });
    navigate('/history');
  }

  function handleAddSet() {
    if (!activeWorkout || !currentTurn) return;
    const exIdx = currentTurn.exerciseIndex;
    const exercise = activeWorkout.exercises[exIdx];
    if (!exercise) return;

    // Copy last set as template for new set
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const newSet: WorkoutSet = {
      setNumber: exercise.sets.length + 1,
      targetReps: lastSet?.targetReps ?? 10,
      targetWeight: lastSet?.targetWeight,
      completed: false,
      restSeconds: lastSet?.restSeconds ?? 90,
    };

    const updatedExercise = {
      ...exercise,
      sets: [...exercise.sets, newSet],
    };

    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exIdx] = updatedExercise;

    updateActiveWorkout({ exercises: updatedExercises });
  }

  function handlePauseLater() {
    // Save current position and elapsed time — workout stays in DB
    pauseWorkout(currentTurnIndex, elapsed);
    setShowExitDialog(false);
    // Delay navigation slightly so the dialog's close animation completes
    // before the route changes — prevents the black-screen flash on iOS/Android.
    setTimeout(() => navigate('/'), 150);
  }

  async function handleCancelWorkout() {
    setShowExitDialog(false);
    // Clear local state and navigate first — avoids black screen from
    // AnimatePresence racing with the now-null activeWorkout render
    clearActiveWorkout();
    navigate('/');
    // Fire delete in background (best-effort)
    if (activeWorkout) {
      deleteWorkoutMutation.mutateAsync({ date: activeWorkout.date, id: activeWorkout.id }).catch(() => {});
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <Button size="sm" variant="destructive" onClick={() => setShowExitDialog(true)}>
            Finish
          </Button>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-[#8E8E93]">
            <span>
              Exercise {currentExerciseNumber} of {exerciseCount}
              {' · '}Set {setNumber}/{totalExerciseSets}
            </span>
            <span>{completedSets}/{totalSets} sets done</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Current exercise card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentTurn.exerciseIndex}-${currentTurn.setIndex}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4">
              {/* Superset header — shows type name + sequence pills (A / B / C / D) */}
              {currentTurn.isSuperset && (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#38383A]">
                  <FontAwesomeIcon icon={faArrowRightArrowLeft} className="text-[#0A84FF] flex-shrink-0" />
                  <span className="text-xs font-bold text-[#0A84FF] uppercase tracking-wider flex-shrink-0">
                    {supersetTypeName}
                  </span>
                  {/* Sequence pills: A B C D — active=blue, done-this-round=green, pending=gray */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {supersetMembers.map((m, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isCurrent = m.exerciseId === currentExercise?.exerciseId;
                      const doneThisRound = m.sets[currentTurn.setIndex]?.completed;
                      return (
                        <span
                          key={m.exerciseId}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                            isCurrent
                              ? 'bg-[#0A84FF] text-white'
                              : doneThisRound
                              ? 'bg-[#30D158] text-white'
                              : 'bg-[#38383A] text-[#8E8E93]'
                          }`}
                        >
                          {letter}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  {/* Current exercise name */}
                  <h2 className="text-lg font-bold text-white leading-tight">
                    {currentExercise?.exercise.name}
                  </h2>
                  {/* Muscle badge + equipment */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {currentExercise && (
                      <MuscleGroupBadge muscle={currentExercise.exercise.primaryMuscle} />
                    )}
                    <span className="text-xs text-[#8E8E93] capitalize">
                      {currentExercise?.exercise.equipment?.replace('-', ' ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <button
                    onClick={() => setShowSwapSheet(true)}
                    className="h-9 w-9 rounded-xl bg-[#2c2c2e] flex items-center justify-center text-[#8E8E93] hover:text-[#FF375F] hover:bg-[#FF375F]/10 transition-colors"
                    title="Swap exercise"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                  <div className="bg-[#2c2c2e] rounded-xl px-3 py-1.5 text-center">
                    <p className="text-lg font-bold text-white">{setNumber}</p>
                    <p className="text-[10px] text-[#8E8E93]">of {totalExerciseSets}</p>
                  </div>
                </div>
              </div>

              {/* Superset context row: letter + round info */}
              {currentTurn.isSuperset && supersetPosition >= 0 && (
                <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-[#0A84FF]/10 rounded-xl">
                  <span className="text-xs font-semibold text-[#0A84FF]">
                    {String.fromCharCode(65 + supersetPosition)} · {currentExercise?.exercise.name}
                  </span>
                  <span className="text-xs text-[#8E8E93] ml-auto">
                    Round {currentTurn.setIndex + 1}/{totalExerciseSets}
                  </span>
                </div>
              )}

              {currentExercise?.progressionNote && (
                <div className="flex items-center gap-1.5 mt-2 bg-[#30D158]/10 rounded-xl px-3 py-2">
                  <FontAwesomeIcon icon={faArrowTrendUp} className="text-[#30D158] text-xs mr-1" />
                  <span className="text-[#30D158] text-xs font-medium">
                    {currentExercise.progressionNote}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Rest timer overlay */}
        <AnimatePresence>
          {isResting && (() => {
            const nextTurn = turns[currentTurnIndex + 1];
            const nextExercise = nextTurn ? exercises[nextTurn.exerciseIndex] : undefined;

            // Is this rest at the end of a superset round? (next turn is same group, new set index)
            const endOfSupersetRound =
              currentTurn.isSuperset &&
              nextTurn?.supersetGroupId === currentTurn.supersetGroupId &&
              nextTurn?.setIndex !== undefined &&
              nextTurn.setIndex > currentTurn.setIndex;

            // Next-exercise superset members (for between-exercise Next Up card)
            const nextSupersetMembers: WorkoutExercise[] = nextTurn?.isSuperset && nextTurn.supersetGroupId
              ? exercises
                  .filter(e => e.supersetGroupId === nextTurn.supersetGroupId)
                  .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0))
              : nextExercise ? [nextExercise] : [];

            const nextSetNum   = (nextTurn?.setIndex ?? 0) + 1;
            const nextSetTotal = nextExercise?.sets.length ?? 0;

            return (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="w-full space-y-3 py-2"
              >
                {/* Timer row */}
                <div className="flex flex-col items-center gap-1">
                  {currentTurn.betweenExercise && (
                    <p className="text-xs font-semibold text-[#FF9F0A] uppercase tracking-wider">
                      Rest between exercises
                    </p>
                  )}
                  {endOfSupersetRound && (
                    <p className="text-xs font-semibold text-[#0A84FF] uppercase tracking-wider">
                      {supersetTypeName} — Round {currentTurn.setIndex + 2} up next
                    </p>
                  )}
                  <RestTimer
                    seconds={restSeconds}
                    totalSeconds={restTotalRef.current}
                    onSkip={skipRest}
                  />
                </div>

                {/* End-of-superset-round: show upcoming round sequence */}
                {endOfSupersetRound && supersetMembers.length > 0 && (
                  <div className="bg-[#1c1c1e] rounded-2xl border border-[#0A84FF]/25 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FontAwesomeIcon icon={faArrowRightArrowLeft} className="text-[#0A84FF] text-xs" />
                      <span className="text-xs font-bold text-[#0A84FF] uppercase tracking-wider">
                        Next Round — {supersetTypeName}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {supersetMembers.map((m, i) => {
                        const exSet = m.sets[currentTurn.setIndex + 1] ?? m.sets[0];
                        const hasWeight = exSet?.targetWeight && exSet.targetWeight > 0;
                        return (
                          <div key={m.exerciseId} className="flex items-center gap-2 bg-[#2c2c2e] rounded-xl px-3 py-2">
                            <span className="text-xs font-bold text-[#0A84FF] w-4">
                              {String.fromCharCode(65 + i)}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-white leading-tight">{m.exercise.name}</p>
                              <p className="text-[10px] text-[#8E8E93]">
                                {exSet?.targetReps ?? '?'} reps
                                {hasWeight ? ` · ${exSet!.targetWeight} lbs` : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Between-exercise Next Up card */}
                {currentTurn.betweenExercise && nextExercise && (
                  <div className="bg-[#1c1c1e] rounded-2xl border border-[#FF9F0A]/25 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ChevronRight className="h-3.5 w-3.5 text-[#FF9F0A]" />
                      <span className="text-xs font-bold text-[#FF9F0A] uppercase tracking-wider">
                        Next Up
                      </span>
                      {nextTurn?.isSuperset && (
                        <span className="text-[10px] text-[#8E8E93] ml-1">
                          {nextSupersetMembers.length === 2 ? 'Superset' : nextSupersetMembers.length === 3 ? 'Tri-Set' : nextSupersetMembers.length > 3 ? 'Giant Set' : ''}
                        </span>
                      )}
                    </div>

                    {nextSupersetMembers.map((ex, i) => {
                      const exSet = ex.sets[nextTurn?.setIndex ?? 0] ?? ex.sets[0];
                      const hasWeight = exSet?.targetWeight && exSet.targetWeight > 0;
                      return (
                        <div key={ex.exerciseId} className={i > 0 ? 'mt-3 pt-3 border-t border-[#38383A]' : ''}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {nextSupersetMembers.length > 1 && (
                                <span className="text-[10px] font-bold text-[#FF9F0A] mr-1">
                                  {String.fromCharCode(65 + i)}
                                </span>
                              )}
                              <span className="text-sm font-bold text-white leading-tight">
                                {ex.exercise.name}
                              </span>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <MuscleGroupBadge muscle={ex.exercise.primaryMuscle} size="sm" />
                                <span className="text-[10px] text-[#8E8E93] capitalize">
                                  {ex.exercise.equipment.replace(/-/g, ' ')}
                                </span>
                              </div>
                            </div>
                            <div className="bg-[#2c2c2e] rounded-xl px-2.5 py-1.5 text-center flex-shrink-0">
                              <p className="text-sm font-bold text-white leading-none">
                                {nextSetNum}/{nextSetTotal}
                              </p>
                              <p className="text-[10px] text-[#8E8E93]">set</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                            <span className="text-xs font-semibold bg-[#2c2c2e] text-white px-3 py-1 rounded-full">
                              {exSet?.targetReps ?? '?'} reps
                            </span>
                            {hasWeight && (
                              <span className="text-xs font-semibold bg-[#FF375F]/15 text-[#FF375F] px-3 py-1 rounded-full">
                                {exSet!.targetWeight} lbs
                              </span>
                            )}
                            {ex.progressionNote && (
                              <span className="text-[10px] text-[#30D158] flex items-center gap-1">
                                <FontAwesomeIcon icon={faArrowTrendUp} className="text-[10px]" />
                                {ex.progressionNote}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Sets */}
        {!isResting && currentExercise && (
          <div className="space-y-2">
            {currentExercise.sets.map((set, si) => {
              const isCurrent = si === currentTurn.setIndex;
              return (
                <SetRow
                  key={`${currentTurn.exerciseIndex}-${si}`}
                  set={set}
                  isActive={isCurrent && !set.completed}
                  equipment={currentExercise.exercise.equipment}
                  onComplete={(weight, reps) => {
                    // Allow completing any not-yet-done set, not just the
                    // strict current — handles tap-lag and set order mismatches
                    if (!set.completed) handleSetComplete(weight, reps);
                  }}
                  onChange={(field, value) => {
                    if (isCurrent) handleSetUpdate(field, value);
                  }}
                />
              );
            })}
            {/* Add Set button */}
            <button
              onClick={handleAddSet}
              className="w-full py-2.5 rounded-xl border border-dashed border-[#38383A] text-[#8E8E93] text-sm flex items-center justify-center gap-2 hover:border-[#FF375F]/50 hover:text-[#FF375F] transition-colors active:scale-98"
            >
              <span className="text-lg leading-none">+</span>
              Add Set
            </button>
          </div>
        )}
      </div>

      {/* Bottom actions — hidden during rest (RestTimer has its own skip control) */}
      {!isResting && (
        <div className="sticky bottom-[83px] px-4 py-3 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[#38383A]">
          <div className="flex gap-3">
            {!isLastTurn ? (
              <Button variant="outline" className="w-full" onClick={handleSkipSet}>
                <SkipForward className="h-4 w-4 mr-2" />
                Skip
              </Button>
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
      )}

      {/* Swap exercise sheet */}
      {currentExercise && showSwapSheet && (
        <SwapExerciseSheet
          open={showSwapSheet}
          workoutExercise={currentExercise}
          allExerciseIds={exercises.map(e => e.exerciseId)}
          onSwap={handleSwapExercise}
          onClose={() => setShowSwapSheet(false)}
        />
      )}

      {/* Exit confirmation dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="max-w-xs mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Pause or End?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              size="lg"
              className="w-full"
              onClick={() => setShowExitDialog(false)}
            >
              Continue
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={handlePauseLater}
            >
              Resume Later
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="w-full"
              onClick={handleCancelWorkout}
              disabled={deleteWorkoutMutation.isPending}
            >
              {deleteWorkoutMutation.isPending ? 'Deleting...' : 'Delete Workout'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
