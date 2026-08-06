import type { UserSettings } from '@/types';

/** Adult height bounds — 4'0" through 7'6" */
export const MIN_HEIGHT_INCHES = 48;
export const MAX_HEIGHT_INCHES = 90;
export const MIN_HEIGHT_FT = 4;
export const MAX_HEIGHT_FT = 7;
export const MIN_HEIGHT_IN = 0;
export const MAX_HEIGHT_IN = 11;

/** Adult body-weight bounds (lbs) */
export const MIN_WEIGHT_LBS = 80;
export const MAX_WEIGHT_LBS = 400;

/** Digits allowed = typical max length + 1 (so out-of-range values can be typed) */
export const HEIGHT_FT_MAX_CHARS = String(MAX_HEIGHT_FT).length + 1;
export const HEIGHT_IN_MAX_CHARS = String(MAX_HEIGHT_IN).length + 1;
export const WEIGHT_MAX_CHARS = String(MAX_WEIGHT_LBS).length + 1;

export function heightInchesFromParts(ft: number, inches: number): number {
  return ft * 12 + inches;
}

/** Keep digits only, capped at maxChars. */
export function sanitizeDigitInput(raw: string, maxChars: number): string {
  return raw.replace(/\D/g, '').slice(0, maxChars);
}

export interface BodyMetricFieldErrors {
  height?: string;
  weight?: string;
}

/**
 * Field-level errors for height / weight draft strings.
 * When requireComplete is false, empty fields are skipped; filled fields are still checked.
 */
export function getBodyMetricFieldErrors(
  input: { heightFt: string; heightIn: string; weightLbs: string },
  options?: { requireComplete?: boolean },
): BodyMetricFieldErrors {
  const requireComplete = options?.requireComplete ?? true;
  const errors: BodyMetricFieldErrors = {};

  const ftRaw = input.heightFt.trim();
  const inRaw = input.heightIn.trim();
  const lbsRaw = input.weightLbs.trim();

  const heightTouched = ftRaw !== '' || inRaw !== '';
  if (requireComplete || heightTouched) {
    if (ftRaw === '' || inRaw === '') {
      errors.height = 'Enter both feet and inches';
    } else {
      const ft = parseInt(ftRaw, 10);
      const inches = parseInt(inRaw, 10);
      if (!Number.isFinite(ft) || !Number.isFinite(inches)) {
        errors.height = 'Enter a valid height';
      } else if (ft < MIN_HEIGHT_FT || ft > MAX_HEIGHT_FT) {
        errors.height = `Feet must be between ${MIN_HEIGHT_FT} and ${MAX_HEIGHT_FT}`;
      } else if (inches < MIN_HEIGHT_IN || inches > MAX_HEIGHT_IN) {
        errors.height = `Inches must be between ${MIN_HEIGHT_IN} and ${MAX_HEIGHT_IN}`;
      } else {
        const total = heightInchesFromParts(ft, inches);
        if (total < MIN_HEIGHT_INCHES || total > MAX_HEIGHT_INCHES) {
          const maxFt = Math.floor(MAX_HEIGHT_INCHES / 12);
          const maxIn = MAX_HEIGHT_INCHES % 12;
          errors.height = `Height must be between ${MIN_HEIGHT_FT}'0" and ${maxFt}'${maxIn}"`;
        }
      }
    }
  }

  if (requireComplete || lbsRaw !== '') {
    if (lbsRaw === '') {
      errors.weight = `Enter weight (${MIN_WEIGHT_LBS}–${MAX_WEIGHT_LBS} lbs)`;
    } else {
      const lbs = parseInt(lbsRaw, 10);
      if (!Number.isFinite(lbs)) {
        errors.weight = 'Enter a valid weight';
      } else if (lbs < MIN_WEIGHT_LBS || lbs > MAX_WEIGHT_LBS) {
        errors.weight = `Weight must be between ${MIN_WEIGHT_LBS} and ${MAX_WEIGHT_LBS} lbs`;
      }
    }
  }

  return errors;
}

/** Validate ft/in/lbs numbers and return a single error, or null if ok. */
export function validateBodyMetrics(input: {
  heightFt: number;
  heightIn: number;
  weightLbs: number;
}): string | null {
  const errors = getBodyMetricFieldErrors({
    heightFt: String(input.heightFt),
    heightIn: String(input.heightIn),
    weightLbs: String(input.weightLbs),
  }, { requireComplete: true });
  return errors.height ?? errors.weight ?? null;
}

/** True when the first-login body profile prompt should still be shown. */
export function needsBodyOnboarding(settings: UserSettings | undefined | null): boolean {
  if (!settings) return false;
  if (settings.bodyProfileDismissed) return false;
  return !settings.sex || !settings.heightInches || !settings.bodyWeightLbs;
}
