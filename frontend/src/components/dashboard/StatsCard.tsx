import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down' | 'neutral'; label: string };
  accentColor?: string;
  className?: string;
}

export function StatsCard({
  icon,
  label,
  value,
  trend,
  accentColor = '#FF375F',
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        'bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4 flex flex-col gap-2',
        className,
      )}
    >
      <div
        className="h-8 w-8 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
      >
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white tabular-nums leading-none">
          {value}
        </div>
        <div className="text-xs text-[#8E8E93] mt-1">{label}</div>
      </div>
      {trend && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs',
            trend.direction === 'up'
              ? 'text-[#30D158]'
              : trend.direction === 'down'
              ? 'text-[#FF375F]'
              : 'text-[#8E8E93]',
          )}
        >
          {trend.direction === 'up' ? (
            <TrendingUp className="h-3 w-3" />
          ) : trend.direction === 'down' ? (
            <TrendingDown className="h-3 w-3" />
          ) : null}
          <span>{trend.label}</span>
        </div>
      )}
    </div>
  );
}
