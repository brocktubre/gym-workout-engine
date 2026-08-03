import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp, Dumbbell, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { MuscleGroupBadge } from './MuscleGroupBadge';
import { formatDate, formatDuration } from '@/lib/utils';
import type { Workout, MuscleGroup } from '@/types';

interface WorkoutCardProps {
  workout: Workout;
  expandable?: boolean;
}

function getUniqueMuscles(workout: Workout): MuscleGroup[] {
  const seen = new Set<MuscleGroup>();
  workout.exercises.forEach((we) => {
    seen.add(we.exercise.primaryMuscle);
  });
  return Array.from(seen);
}

export function WorkoutCard({ workout, expandable = false }: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const muscles = getUniqueMuscles(workout);
  const visible = muscles.slice(0, 3);
  const extra = muscles.length - 3;

  const statusColor =
    workout.status === 'completed'
      ? 'text-[#30D158]'
      : workout.status === 'in-progress'
      ? 'text-[#FF9F0A]'
      : workout.status === 'skipped'
      ? 'text-[#8E8E93]'
      : 'text-[#0A84FF]';

  const StatusIcon =
    workout.status === 'completed'
      ? CheckCircle2
      : workout.status === 'skipped'
      ? AlertCircle
      : Dumbbell;

  return (
    <Card
      className={expandable ? 'cursor-pointer active:opacity-90' : ''}
      onClick={expandable ? () => setExpanded((v) => !v) : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-semibold text-sm text-white">
              {formatDate(workout.date)}
            </p>
            <p className="text-xs text-[#8E8E93] capitalize mt-0.5">
              {workout.goal?.replace('-', ' ') ?? ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`h-4 w-4 ${statusColor}`} />
            <span className={`text-xs font-medium capitalize ${statusColor}`}>
              {workout.status?.replace('-', ' ') ?? ''}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {visible.map((m) => (
            <MuscleGroupBadge key={m} muscle={m} size="sm" />
          ))}
          {extra > 0 && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#2c2c2e] text-[#8E8E93]">
              +{extra} more
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-[#8E8E93]">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {workout.actualDurationMinutes
                ? formatDuration(workout.actualDurationMinutes)
                : formatDuration(workout.targetDurationMinutes)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Dumbbell className="h-3.5 w-3.5" />
            <span>{workout.exercises.length} exercises</span>
          </div>
          {workout.totalVolume != null && workout.totalVolume > 0 && (
            <div className="flex items-center gap-1">
              <span>{workout.totalVolume.toLocaleString()} lbs total</span>
            </div>
          )}
        </div>

        {expandable && (
          <div className="flex items-center justify-center mt-3 text-[#8E8E93]">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        )}

        <AnimatePresence>
          {expandable && expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-[#38383A] space-y-2">
                {workout.exercises.map((we) => (
                  <div key={we.exerciseId} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-white font-medium">{we.exercise.name}</span>
                      {we.progressionNote && (
                        <span className="ml-2 text-[#30D158]">{we.progressionNote}</span>
                      )}
                    </div>
                    <div className="text-[#8E8E93]">
                      {we.sets.length} × {we.sets[0]?.targetReps ?? '?'} reps
                      {we.sets[0]?.targetWeight ? ` @ ${we.sets[0].targetWeight}lbs` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
