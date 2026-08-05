import type { UserSettings } from '@/types';

/** True when the first-login body profile prompt should still be shown. */
export function needsBodyOnboarding(settings: UserSettings | undefined | null): boolean {
  if (!settings) return false;
  if (settings.bodyProfileDismissed) return false;
  return !settings.sex || !settings.heightInches || !settings.bodyWeightLbs;
}
