import { useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { data: settings } = useSettings();
  // Default on when settings haven't loaded yet or the field is unset
  const enabled = settings?.voiceCoachingEnabled ?? true;

  const speak = useCallback(async (text: string) => {
    if (!enabled) return;

    try {
      const { audio } = await api.synthesizeSpeech(text);
      const src = `data:audio/mpeg;base64,${audio}`;

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audioEl = new Audio(src);
      audioRef.current = audioEl;
      await audioEl.play();
    } catch (err) {
      console.error('TTS failed:', err);
      // Non-fatal — workout continues without audio
    }
  }, [enabled]);

  return { speak, enabled };
}
