import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Zap, List, CheckCircle2 } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWeightHanging, faDumbbell, faPersonWalking, faCog,
  faLink, faMinus, faBell, faRing, faArrowUp, faCrosshairs,
  faWater, faTruckFast, faCube, faShirt, faBagShopping,
  faCircleDot, faPersonBiking, faPersonSwimming, faPersonSkiing,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { MuscleGroupBadge } from './MuscleGroupBadge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Exercise, WorkoutExercise } from '@/types';

// ── Equipment icons (same map as ExerciseItem) ────────────────────────────────
const equipmentIcons: Record<string, IconDefinition> = {
  barbell: faWeightHanging,
  dumbbell: faDumbbell,
  bodyweight: faPersonWalking,
  machine: faCog,
  cable: faLink,
  'resistance-band': faMinus,
  kettlebell: faBell,
  'ez-bar': faMinus,
  rings: faRing,
  'pull-up-bar': faArrowUp,
  landmine: faCrosshairs,
  'battle-rope': faWater,
  sled: faTruckFast,
  'plyometric-box': faCube,
  'weight-vest': faShirt,
  sandbag: faBagShopping,
  'medicine-ball': faCircleDot,
  'echo-bike': faPersonBiking,
  rower: faPersonSwimming,
  'ski-erg': faPersonSkiing,
};

// ── Exercise row used in both tabs ────────────────────────────────────────────
function ExerciseRow({
  exercise,
  onSelect,
  isCurrent = false,
}: {
  exercise: Exercise;
  onSelect: (ex: Exercise) => void;
  isCurrent?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
        isCurrent
          ? 'bg-[#2c2c2e] border-[#FF375F]/30 opacity-60'
          : 'bg-[#1c1c1e] border-[#38383A] hover:border-[#48484A]',
      )}
    >
      {/* Equipment icon */}
      <div className="h-9 w-9 rounded-xl bg-[#2c2c2e] flex items-center justify-center flex-shrink-0">
        <FontAwesomeIcon
          icon={equipmentIcons[exercise.equipment] ?? faWeightHanging}
          className="text-[#8E8E93] text-sm"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{exercise.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <MuscleGroupBadge muscle={exercise.primaryMuscle} size="sm" />
          <span
            className={cn(
              'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full',
              exercise.category === 'compound'
                ? 'bg-[#FF375F]/15 text-[#FF375F]'
                : 'bg-[#38383A] text-[#8E8E93]',
            )}
          >
            {exercise.category}
          </span>
          <span className="text-[10px] text-[#8E8E93] capitalize">
            {exercise.equipment.replace(/-/g, ' ')}
          </span>
        </div>
      </div>

      {/* Action */}
      {isCurrent ? (
        <span className="text-xs text-[#8E8E93] flex-shrink-0">current</span>
      ) : (
        <Button
          size="sm"
          className="flex-shrink-0 h-8 px-3 text-xs"
          onClick={() => onSelect(exercise)}
        >
          Use This
        </Button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SwapExerciseSheetProps {
  open: boolean;
  workoutExercise: WorkoutExercise;
  /** All exercise IDs currently in the workout — excluded from suggestions */
  allExerciseIds: string[];
  onSwap: (newExercise: Exercise) => void;
  onClose: () => void;
}

export function SwapExerciseSheet({
  open,
  workoutExercise,
  allExerciseIds,
  onSwap,
  onClose,
}: SwapExerciseSheetProps) {
  const [search, setSearch] = useState('');
  const muscle = workoutExercise.exercise.primaryMuscle;

  // ── Suggestions tab ──────────────────────────────────────────────────────
  const {
    data: suggestions = [],
    isLoading: suggestionsLoading,
  } = useQuery({
    queryKey: ['swap-suggest', workoutExercise.exerciseId, allExerciseIds.join(',')],
    queryFn: () =>
      api.swapSuggest({ primaryMuscle: muscle, excludeIds: allExerciseIds }),
    enabled: open,
    staleTime: 0,
  });

  // ── Browse tab ───────────────────────────────────────────────────────────
  const {
    data: allForMuscle = [],
    isLoading: browseLoading,
  } = useQuery({
    queryKey: ['exercises', 'list', { muscle }],
    queryFn: () => api.getExercises({ muscle }),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  // Browse: primary muscle only, filtered by search, current exercise shown as "current"
  const browseList = allForMuscle
    .filter(e => e.primaryMuscle === muscle)
    .filter(
      e =>
        !search ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.equipment.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      // Current exercise first, then compounds, then isolations
      if (a.id === workoutExercise.exerciseId) return -1;
      if (b.id === workoutExercise.exerciseId) return 1;
      if (a.category === 'compound' && b.category !== 'compound') return -1;
      if (a.category !== 'compound' && b.category === 'compound') return 1;
      return a.name.localeCompare(b.name);
    });

  const handleSelect = (ex: Exercise) => {
    onSwap(ex);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden bg-[#1c1c1e] border-[#38383A]">
        <DialogHeader className="px-4 pt-5 pb-3 border-b border-[#38383A] flex-shrink-0">
          <DialogTitle className="text-white text-base">Swap Exercise</DialogTitle>
          <DialogDescription className="text-[#8E8E93] text-sm">
            Replacing{' '}
            <span className="text-white font-medium">{workoutExercise.exercise.name}</span>
            {' '}— pick something for{' '}
            <span className="text-white font-medium capitalize">{muscle}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="suggestions" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="mx-4 mt-3 mb-1 flex-shrink-0 bg-[#2c2c2e]">
            <TabsTrigger value="suggestions" className="flex-1 gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Suggestions
            </TabsTrigger>
            <TabsTrigger value="browse" className="flex-1 gap-1.5">
              <List className="h-3.5 w-3.5" />
              Browse All
            </TabsTrigger>
          </TabsList>

          {/* ── Suggestions tab ─────────────────────────────────────────── */}
          <TabsContent
            value="suggestions"
            className="flex-1 overflow-y-auto px-4 pb-4 mt-0 space-y-2"
          >
            {suggestionsLoading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </>
            ) : suggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-[#38383A] mb-2" />
                <p className="text-sm text-[#8E8E93]">
                  No other {muscle} exercises available with your current equipment.
                </p>
                <p className="text-xs text-[#48484A] mt-1">Try the Browse All tab.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-[#8E8E93] pt-1 pb-0.5">
                  Best alternatives for{' '}
                  <span className="capitalize font-medium text-white">{muscle}</span>{' '}
                  with your equipment — compounds first
                </p>
                {suggestions.map(ex => (
                  <ExerciseRow key={ex.id} exercise={ex} onSelect={handleSelect} />
                ))}
              </>
            )}
          </TabsContent>

          {/* ── Browse all tab ───────────────────────────────────────────── */}
          <TabsContent
            value="browse"
            className="flex-1 overflow-hidden flex flex-col px-4 pb-4 mt-0"
          >
            <div className="relative mb-2 mt-1 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8E8E93]" />
              <Input
                className="pl-8 bg-[#2c2c2e] border-[#38383A] text-white placeholder:text-[#48484A] h-9 text-sm"
                placeholder={`Search ${muscle} exercises…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {browseLoading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </>
              ) : browseList.length === 0 ? (
                <p className="text-sm text-[#8E8E93] text-center py-8">No results</p>
              ) : (
                browseList.map(ex => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    onSelect={handleSelect}
                    isCurrent={ex.id === workoutExercise.exerciseId}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
