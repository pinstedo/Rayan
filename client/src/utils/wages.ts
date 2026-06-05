export const STANDARD_DAILY_HOURS = 8;

export type WageLike = {
  daily_wage?: number | string | null;
  rate?: number | string | null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getDailyWage = (labour?: WageLike | null): number => {
  const dailyWage = toNumberOrNull(labour?.daily_wage);
  if (dailyWage !== null) return dailyWage;

  const legacyHourlyRate = toNumberOrNull(labour?.rate);
  return legacyHourlyRate === null ? 0 : legacyHourlyRate * STANDARD_DAILY_HOURS;
};

export const getHourlyRate = (labour?: WageLike | null): number => {
  const dailyWage = toNumberOrNull(labour?.daily_wage);
  if (dailyWage !== null) return dailyWage / STANDARD_DAILY_HOURS;

  const legacyHourlyRate = toNumberOrNull(labour?.rate);
  return legacyHourlyRate === null ? 0 : legacyHourlyRate;
};
