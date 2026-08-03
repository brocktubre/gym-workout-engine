import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Zap, Play, Dumbbell, Flame, BarChart2, Sparkles } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrophy } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { StreakDisplay } from '@/components/dashboard/StreakDisplay';
import { RecentWorkout } from '@/components/dashboard/RecentWorkout';
import { useWorkoutHistory, useWorkoutStats, useDeleteWorkout } from '@/hooks/useWorkouts';
import { useActiveWorkout } from '@/hooks/useWorkoutEngine';
import { useCoachingNote } from '@/hooks/useCoachingNote';
import { formatDuration, getGreeting, getTodayDate } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeWorkout, hasActiveWorkout, isPaused, pauseWorkout, clearActiveWorkout } = useActiveWorkout();
  const deleteWorkoutMutation = useDeleteWorkout();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { data: history, isLoading: historyLoading } = useWorkoutHistory(30);
  const { data: stats, isLoading: statsLoading } = useWorkoutStats();

  const today = getTodayDate();
  const todayWorkout = history?.find((w) => w.date === today);
  const recentWorkouts = history
    ?.filter((w) => w.status === 'completed' || w.status === 'in-progress')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5) ?? [];

  const { data: coachingNote, isLoading: noteLoading } = useCoachingNote();

  const greeting = getGreeting();
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 pt-14 pb-2">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-[#8E8E93] text-sm">{dateLabel}</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">
            {greeting}, Brock! 👋
          </h1>
        </motion.div>
      </div>

      <div className="px-4 space-y-5 pb-6">
        {/* Active workout banner */}
        {hasActiveWorkout && activeWorkout && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-[#FF375F]/20 to-[#FF9F0A]/20 rounded-2xl border border-[#FF375F]/30 p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isPaused ? 'bg-[#FF9F0A]' : 'bg-[#FF375F]'}`}>
                <Play className="h-5 w-5 text-white fill-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white text-sm">
                  {isPaused ? 'Workout Paused' : 'Workout In Progress'}
                </p>
                <p className="text-xs text-[#8E8E93] capitalize">
                  {activeWorkout.goal?.replace('-', ' ') ?? ''} · {activeWorkout.exercises.length} exercises
                </p>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-[2] bg-[#FF375F] text-white text-xs"
                onClick={() => navigate('/active')}
              >
                {isPaused ? 'Resume Workout' : 'Continue'}
              </Button>
              {!isPaused && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => { pauseWorkout(0, 0); }}
                >
                  Pause
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 text-xs text-[#FF375F] hover:text-[#FF375F]"
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel
              </Button>
            </div>
            {/* Cancel confirmation */}
            {showCancelConfirm && (
              <div className="mt-3 p-3 bg-[#2c2c2e] rounded-xl border border-[#FF375F]/30">
                <p className="text-xs text-white mb-2 font-medium">Delete this workout?</p>
                <p className="text-xs text-[#8E8E93] mb-3">This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setShowCancelConfirm(false)}>
                    Keep It
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 text-xs"
                    disabled={deleteWorkoutMutation.isPending}
                    onClick={() => {
                      // Clear state immediately so dashboard re-renders correctly
                      clearActiveWorkout();
                      setShowCancelConfirm(false);
                      // Delete in background (best-effort)
                      deleteWorkoutMutation.mutateAsync({ date: activeWorkout.date, id: activeWorkout.id }).catch(() => {});
                    }}
                  >
                    {deleteWorkoutMutation.isPending ? '...' : 'Delete'}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Today section: No workout yet */}
        {!hasActiveWorkout && !todayWorkout && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            {/* AI Coaching Note */}
            {noteLoading ? (
              <Skeleton className="h-28 rounded-2xl" />
            ) : coachingNote ? (
              <div className="bg-[#1c1c1e] rounded-2xl border border-[#BF5AF2]/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-[#BF5AF2]" />
                  <span className="text-xs font-bold text-[#BF5AF2] uppercase tracking-wider">AI Coach</span>
                </div>
                <p className="text-sm text-white leading-relaxed mb-3">{coachingNote.note}</p>
                <Button
                  size="sm"
                  className="w-full bg-[#BF5AF2] hover:bg-[#BF5AF2]/90 text-white"
                  onClick={() =>
                    navigate('/generate', {
                      state: {
                        suggestedMuscles: coachingNote.suggestedMuscles,
                        suggestedGoal: coachingNote.suggestedGoal,
                      },
                    })
                  }
                >
                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                  Train This
                </Button>
              </div>
            ) : null}

            {/* Standard generate card */}
            <div className="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] rounded-2xl border border-[#38383A] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-[#FF375F]/20 flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="h-5 w-5 text-[#FF375F]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Build your own</h2>
                  <p className="text-xs text-[#8E8E93]">Choose duration, goal, and target muscles</p>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={() => navigate('/generate')}
              >
                <Zap className="h-4 w-4 mr-2" />
                Generate Workout
              </Button>
            </div>
          </motion.div>
        )}

        {/* Today's completed workout */}
        {todayWorkout && todayWorkout.status === 'completed' && !hasActiveWorkout && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-[#30D158]/10 to-[#1c1c1e] rounded-2xl border border-[#30D158]/30 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-[#30D158]/20 flex items-center justify-center">
                <FontAwesomeIcon icon={faTrophy} className="text-[#FF9F0A] text-xl" />
              </div>
              <div>
                <p className="font-bold text-white">Workout Complete!</p>
                <p className="text-xs text-[#8E8E93]">Great work today</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[#1c1c1e] rounded-xl p-2.5">
                <p className="text-base font-bold text-white">
                  {todayWorkout.exercises.length}
                </p>
                <p className="text-[10px] text-[#8E8E93]">exercises</p>
              </div>
              <div className="bg-[#1c1c1e] rounded-xl p-2.5">
                <p className="text-base font-bold text-white">
                  {formatDuration(todayWorkout.actualDurationMinutes ?? todayWorkout.targetDurationMinutes)}
                </p>
                <p className="text-[10px] text-[#8E8E93]">duration</p>
              </div>
              <div className="bg-[#1c1c1e] rounded-xl p-2.5">
                <p className="text-base font-bold text-white">
                  {todayWorkout.totalVolume != null ? `${todayWorkout.totalVolume.toLocaleString()}` : '—'}
                </p>
                <p className="text-[10px] text-[#8E8E93]">lbs vol</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {statsLoading ? (
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-3 flex flex-col items-center justify-center text-center">
                <StreakDisplay
                  streak={stats?.currentStreak ?? 0}
                  longestStreak={stats?.longestStreak}
                />
              </div>
              <StatsCard
                icon={<Dumbbell className="h-4 w-4" />}
                label="This month"
                value={history?.filter((w) => w.status === 'completed').length ?? 0}
                accentColor="#0A84FF"
              />
              <StatsCard
                icon={<BarChart2 className="h-4 w-4" />}
                label="Avg duration"
                value={stats ? formatDuration(Math.round(stats.averageDurationMinutes)) : '—'}
                accentColor="#FF9F0A"
              />
            </div>
          )}
        </motion.div>

        {/* Recent workouts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">Recent Workouts</h2>
            <button
              className="text-xs text-[#FF375F] font-medium"
              onClick={() => navigate('/history')}
            >
              See all
            </button>
          </div>

          {historyLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : recentWorkouts.length === 0 ? (
            <div className="text-center py-8">
              <Flame className="h-8 w-8 text-[#38383A] mx-auto mb-2" />
              <p className="text-sm text-[#8E8E93]">No workouts yet. Time to train!</p>
            </div>
          ) : (
            <div className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] divide-y divide-[#38383A] overflow-hidden">
              {recentWorkouts.map((workout) => (
                <div key={workout.id} className="px-4">
                  <RecentWorkout workout={workout} />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
