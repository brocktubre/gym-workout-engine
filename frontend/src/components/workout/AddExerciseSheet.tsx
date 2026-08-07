import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWeightHanging, faDumbbell, faPersonWalking, faCog,
  faLink, faMinus, faBell, faRing, faArrowUp,
  faWater, faTruckFast, faCube, faShirt, faBagShopping,
  faCircleDot, faPersonBiking, faPersonSwimming, faPersonSkiing,
  faCircle,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { MuscleGroupBadge } from './MuscleGroupBadge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Exercise, MuscleGroup } from '@/types';

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
  'battle-rope': faWater,
  sled: faTruckFast,
  'plyometric-box': faCube,
  'weight-vest': faShirt,
  sandbag: faBagShopping,
  'medicine-ball': faCircleDot,
  'echo-bike': faPersonBiking,
  rower: faPersonSwimming,
  'ski-erg': faPersonSkiing,
  plate: faCircle,
  parallettes: faCube,
  'monkey-feet': faPersonWalking,
};

const MUSCLE_FILTERS: { value: MuscleGroup | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hams' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core' },
];

function ExerciseRow({
  exercise,
  onSelect,
}: {
  exercise: Exercise;
  onSelect: (ex: Exercise) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-[#1c1c1e] border-[#38383A] hover:border-[#48484A] transition-colors">
      <div className="h-9 w-9 rounded-xl bg-[#2c2c2e] flex items-center justify-center flex-shrink-0">
        <FontAwesomeIcon
          icon={equipmentIcons[exercise.equipment] ?? faWeightHanging}
          className="text-[#8E8E93] text-sm"
        />
      </div>
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
      <Button
        size="sm"
        className="flex-shrink-0 h-8 px-3 text-xs"
        onClick={() => onSelect(exercise)}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add
      </Button>
    </div>
  );
}

export interface AddExerciseSheetProps {
  open: boolean;
  /** Exercise IDs already in the workout — excluded from the list */
  excludeIds: string[];
  onAdd: (exercise: Exercise) => void;
  onClose: () => void;
}

export function AddExerciseSheet({
  open,
  excludeIds,
  onAdd,
  onClose,
}: AddExerciseSheetProps) {
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'all'>('all');

  const { data: allExercises = [], isLoading } = useQuery({
    queryKey: ['exercises', 'list', 'all'],
    queryFn: () => api.getExercises(),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allExercises
      .filter((e) => !excludeSet.has(e.id))
      .filter((e) => muscleFilter === 'all' || e.primaryMuscle === muscleFilter)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.equipment.toLowerCase().includes(q) ||
          e.primaryMuscle.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (a.category === 'compound' && b.category !== 'compound') return -1;
        if (a.category !== 'compound' && b.category === 'compound') return 1;
        return a.name.localeCompare(b.name);
      });
  }, [allExercises, excludeSet, muscleFilter, search]);

  const handleSelect = (ex: Exercise) => {
    onAdd(ex);
    onClose();
    setSearch('');
    setMuscleFilter('all');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden bg-[#1c1c1e] border-[#38383A]">
        <DialogHeader className="px-4 pt-5 pb-3 border-b border-[#38383A] flex-shrink-0">
          <DialogTitle className="text-white text-base">Add Movement</DialogTitle>
          <DialogDescription className="text-[#8E8E93] text-sm">
            Pick an exercise to append to your workout
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden px-4 pb-4 pt-3 gap-2">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8E8E93]" />
            <Input
              className="pl-8 bg-[#2c2c2e] border-[#38383A] text-white placeholder:text-[#48484A] h-9 text-sm"
              placeholder="Search exercises…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 flex-shrink-0 scrollbar-none">
            {MUSCLE_FILTERS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMuscleFilter(m.value)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                  muscleFilter === m.value
                    ? 'bg-[#FF375F] text-white'
                    : 'bg-[#2c2c2e] text-[#8E8E93] hover:text-white',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {isLoading ? (
              <>
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-[#8E8E93] text-center py-8">No exercises found</p>
            ) : (
              filtered.map((ex) => (
                <ExerciseRow key={ex.id} exercise={ex} onSelect={handleSelect} />
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
