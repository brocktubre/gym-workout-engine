import type { WarmupItem } from '@/types';

/** Remove legacy duration suffixes because duration is displayed separately. */
export function getWarmupDisplayName(name: string): string {
  return name.replace(/\s*(?:—|-)\s*\d+\s*min(?:ute)?s?\s*$/i, '').trim();
}

export function getWarmupAnnouncement(item: WarmupItem): string {
  const name = getWarmupDisplayName(item.name);
  const duration = item.durationSeconds >= 60 && item.durationSeconds % 60 === 0
    ? `${item.durationSeconds / 60} ${item.durationSeconds === 60 ? 'minute' : 'minutes'}`
    : `${item.durationSeconds} seconds`;

  return `${name}. ${duration}.`;
}
