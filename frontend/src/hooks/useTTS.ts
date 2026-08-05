import { useCallback, useRef } from 'react';
import { api } from '@/lib/api';

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string) => {
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
  }, []);

  return { speak };
}
