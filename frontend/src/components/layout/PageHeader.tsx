import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/brand/AppLogo';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Show brand mark next to the title (default on) */
  showLogo?: boolean;
  onBack?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  showBack = false,
  showLogo = true,
  onBack,
  action,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 pt-14 pb-4 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-xl z-40',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {showBack && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleBack}
            className="text-[#FF375F] -ml-2 rounded-xl flex-shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        {showLogo && !showBack && (
          <AppLogo size="sm" className="flex-shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-[#8E8E93] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
