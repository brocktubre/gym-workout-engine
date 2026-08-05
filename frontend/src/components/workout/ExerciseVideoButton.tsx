import { useState } from 'react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Play, Loader2, VideoOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ExerciseVideoButtonProps {
  name: string;
  exerciseId?: string;
  className?: string;
  /** Optional label next to the icon (e.g. expanded ExerciseItem) */
  label?: string;
  title?: string;
}

/**
 * Watch-video control. Fetches MuscleWiki only on tap.
 * Hides itself for the rest of the session after a 404 / no-match.
 */
export function ExerciseVideoButton({
  name,
  exerciseId,
  className,
  label,
  title = 'Watch video',
}: ExerciseVideoButtonProps) {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const { videoPlaybackEnabled } = useFeatureFlags();

  if (!videoPlaybackEnabled || hidden) return null;

  async function handleOpen(e?: React.MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    setOpen(true);
    setError(null);
    setNotFound(false);
    setLoading(true);
    setVideoSrc(null);
    setMatchedName(null);

    try {
      const result = await api.getExerciseVideo({ name, exerciseId });
      setMatchedName(result.matchedName);
      setVideoSrc(api.getExerciseVideoStreamUrl(result.streamUrl));
    } catch (err) {
      // 404 = no MuscleWiki match. Tell the user, then retire the button once
      // they dismiss the dialog so it stops advertising a video we can't show.
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setVideoSrc(null);
      setError(null);
      if (notFound) setHidden(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          label
            ? 'inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A84FF] hover:text-[#0A84FF]/80 transition-colors'
            : 'h-9 w-9 rounded-xl bg-[#2c2c2e] flex items-center justify-center text-[#8E8E93] hover:text-[#0A84FF] hover:bg-[#0A84FF]/10 transition-colors',
          className,
        )}
        title={title}
        aria-label={title}
      >
        <Play className={label ? 'h-3.5 w-3.5' : 'h-4 w-4'} fill="currentColor" />
        {label ? <span>{label}</span> : null}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="pr-8">{matchedName ?? name}</DialogTitle>
            <DialogDescription>
              {notFound
                ? 'No demonstration available'
                : matchedName && matchedName !== name
                  ? `Matched “${matchedName}” on MuscleWiki`
                  : 'Exercise demonstration'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
            {loading && (
              <Loader2 className="h-8 w-8 text-[#8E8E93] animate-spin" />
            )}
            {!loading && notFound && (
              <div className="flex flex-col items-center gap-2 px-6 text-center">
                <VideoOff className="h-8 w-8 text-[#8E8E93]" />
                <p className="text-sm font-semibold text-white">
                  No video found for “{name}”
                </p>
                <p className="text-xs text-[#8E8E93]">
                  We couldn’t find a demonstration for this movement in the
                  MuscleWiki library.
                </p>
              </div>
            )}
            {!loading && !notFound && error && (
              <p className="text-sm text-[#FF375F] px-4 text-center">{error}</p>
            )}
            {!loading && !notFound && !error && videoSrc && (
              <video
                key={videoSrc}
                src={videoSrc}
                controls
                playsInline
                autoPlay
                className="w-full h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
