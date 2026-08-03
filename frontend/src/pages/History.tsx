import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Dumbbell, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkoutHistory } from '@/hooks/useWorkouts';
import { cn } from '@/lib/utils';
import type { Workout } from '@/types';

type DateRange = 7 | 30 | 90 | 365;

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 365, label: 'All' },
];

interface WeeklyVolume {
  week: string;
  volume: number;
  count: number;
}

function buildWeeklyData(workouts: Workout[]): WeeklyVolume[] {
  const map = new Map<string, { volume: number; count: number }>();

  workouts
    .filter((w) => w.status === 'completed')
    .forEach((w) => {
      const d = new Date(w.date + 'T00:00:00');
      // Get Monday of this week
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      const weekKey = d.toISOString().split('T')[0];
      const existing = map.get(weekKey) ?? { volume: 0, count: 0 };
      map.set(weekKey, {
        volume: existing.volume + (w.totalVolume ?? 0),
        count: existing.count + 1,
      });
    });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, data]) => ({
      week: new Date(week + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      volume: Math.round(data.volume),
      count: data.count,
    }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#2c2c2e] border border-[#38383A] rounded-xl px-3 py-2 text-xs">
      <p className="text-[#8E8E93] mb-1">{label as string}</p>
      <p className="text-white font-semibold">
        {(payload[0]?.value as number)?.toLocaleString()} kg
      </p>
      <p className="text-[#8E8E93]">{payload[0]?.payload?.count as number} workouts</p>
    </div>
  );
}

export default function History() {
  const [dateRange, setDateRange] = useState<DateRange>(30);
  const { data: workouts, isLoading } = useWorkoutHistory(dateRange);

  const sorted = workouts
    ? [...workouts].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const weeklyData = workouts ? buildWeeklyData(workouts) : [];
  const hasVolume = weeklyData.some((d) => d.volume > 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PageHeader title="History" subtitle="Your workout log" />

      <div className="px-4 space-y-5 pb-6">
        {/* Date range filter */}
        <div className="flex gap-2">
          {DATE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDateRange(r.value)}
              className={cn(
                'flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border',
                dateRange === r.value
                  ? 'bg-[#FF375F] text-white border-[#FF375F]'
                  : 'bg-[#1c1c1e] text-[#8E8E93] border-[#38383A] hover:bg-[#2c2c2e]',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Volume chart */}
        {isLoading ? (
          <Skeleton className="h-[180px] rounded-2xl" />
        ) : hasVolume ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-[#FF375F]" />
              <span className="text-sm font-semibold text-white">Weekly Volume</span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={weeklyData} barSize={20}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#38383A"
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  tick={{ fill: '#8E8E93', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="volume"
                  fill="#FF375F"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        ) : null}

        {/* Workout list */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="h-16 w-16 rounded-2xl bg-[#1c1c1e] border border-[#38383A] flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-[#38383A]" />
            </div>
            <p className="font-semibold text-white mb-1">No workouts yet</p>
            <p className="text-sm text-[#8E8E93]">
              Time to train! Generate your first workout.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-sm text-[#8E8E93]">
              <Dumbbell className="h-4 w-4" />
              <span>{sorted.length} workouts in last {dateRange === 365 ? 'year' : `${dateRange} days`}</span>
            </div>
            {sorted.map((workout) => (
              <WorkoutCard key={workout.id} workout={workout} expandable />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
