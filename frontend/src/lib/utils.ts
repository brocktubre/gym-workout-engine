import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { MuscleGroup } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number | undefined | null): string {
  if (minutes == null || isNaN(minutes) || minutes <= 0) return '—';
  const mins = Math.round(minutes);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function muscleGroupColor(muscle: MuscleGroup | string): string {
  const colors: Record<string, string> = {
    chest: 'bg-[#FF375F]/20 text-[#FF375F]',
    back: 'bg-[#0A84FF]/20 text-[#0A84FF]',
    shoulders: 'bg-[#BF5AF2]/20 text-[#BF5AF2]',
    biceps: 'bg-[#FF9F0A]/20 text-[#FF9F0A]',
    triceps: 'bg-[#FF9F0A]/20 text-[#FF9F0A]',
    quads: 'bg-[#30D158]/20 text-[#30D158]',
    hamstrings: 'bg-[#30D158]/20 text-[#30D158]',
    glutes: 'bg-[#5AC8FA]/20 text-[#5AC8FA]',
    calves: 'bg-[#30D158]/20 text-[#30D158]',
    core: 'bg-[#FFD60A]/20 text-[#FFD60A]',
    cardio: 'bg-[#5AC8FA]/20 text-[#5AC8FA]',
  };
  return colors[muscle] ?? 'bg-gray-500/20 text-gray-400';
}

export function getTodayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export function formatElapsedTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function calculateVolume(sets: { completedReps?: number; completedWeight?: number; completed: boolean }[]): number {
  return sets
    .filter((s) => s.completed)
    .reduce((acc, s) => acc + (s.completedReps ?? 0) * (s.completedWeight ?? 0), 0);
}
