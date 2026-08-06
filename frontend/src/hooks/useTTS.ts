import { useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';

/**
 * Polly TTS helper. Reuses one HTMLAudioElement so playback started from a
 * user gesture (e.g. completing a set) can still play after a rest timer
 * finishes — browsers often block `new Audio().play()` without a gesture.
 */
export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { data: settings } = useSettings();
  // Default on when settings haven't loaded yet or the field is unset
  const enabled = settings?.voiceCoachingEnabled ?? true;

  const getAudioEl = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return audioRef.current;
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!enabled) return;

    try {
      const { audio } = await api.synthesizeSpeech(text);
      const src = `data:audio/mpeg;base64,${audio}`;

      const audioEl = getAudioEl();
      audioEl.pause();
      audioEl.src = src;
      await audioEl.play();
    } catch (err) {
      console.error('TTS failed:', err);
      // Non-fatal — workout continues without audio
    }
  }, [enabled, getAudioEl]);

  return { speak, enabled };
}
