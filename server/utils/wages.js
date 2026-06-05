const STANDARD_DAILY_HOURS = 8;

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hourlyFromDailyWage = (dailyWage) => {
  const wage = toNumberOrNull(dailyWage);
  return wage === null ? 0 : wage / STANDARD_DAILY_HOURS;
};

const dailyWageFromLegacyHourly = (hourlyRate) => {
  const rate = toNumberOrNull(hourlyRate);
  return rate === null ? null : rate * STANDARD_DAILY_HOURS;
};

const dailyWageFromPayload = (payload) => {
  const dailyWage = toNumberOrNull(payload.daily_wage);
  if (dailyWage !== null) return dailyWage;

  const legacyHourlyRate = toNumberOrNull(payload.rate);
  return legacyHourlyRate === null ? null : dailyWageFromLegacyHourly(legacyHourlyRate);
};

const getLabourDailyWage = (labour) => {
  const dailyWage = toNumberOrNull(labour?.daily_wage);
  if (dailyWage !== null) return dailyWage;

  return dailyWageFromLegacyHourly(labour?.rate) || 0;
};

const getLabourHourlyRate = (labour) => hourlyFromDailyWage(getLabourDailyWage(labour));

const withWageCompatibility = (labour) => {
  if (!labour) return labour;
  const dailyWage = getLabourDailyWage(labour);
  return {
    ...labour,
    daily_wage: dailyWage,
    rate: hourlyFromDailyWage(dailyWage),
  };
};

const withWageCompatibilityList = (labours) => labours.map(withWageCompatibility);

module.exports = {
  STANDARD_DAILY_HOURS,
  hourlyFromDailyWage,
  dailyWageFromLegacyHourly,
  dailyWageFromPayload,
  getLabourDailyWage,
  getLabourHourlyRate,
  withWageCompatibility,
  withWageCompatibilityList,
};
