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

const getApplicableHourlyRate = (labour, salaryHistory = [], date) => {
  if (!salaryHistory || salaryHistory.length === 0) {
    return getLabourHourlyRate(labour);
  }
  if (!date) {
    return getLabourHourlyRate(labour);
  }

  let applicableRate = null;
  for (let i = salaryHistory.length - 1; i >= 0; i--) {
    if (salaryHistory[i].date <= date) {
      applicableRate = salaryHistory[i].new_daily_wage !== null && salaryHistory[i].new_daily_wage !== undefined
        ? hourlyFromDailyWage(salaryHistory[i].new_daily_wage)
        : salaryHistory[i].new_rate;
      break;
    }
  }

  if (applicableRate !== null) return applicableRate;

  if (salaryHistory[0].previous_daily_wage !== null && salaryHistory[0].previous_daily_wage !== undefined) {
    return hourlyFromDailyWage(salaryHistory[0].previous_daily_wage);
  }
  if (salaryHistory[0].previous_rate !== null && salaryHistory[0].previous_rate !== undefined) {
    return salaryHistory[0].previous_rate;
  }
  return getLabourHourlyRate(labour);
};

const syncLabourOvertimeAmounts = async (db, labourId, fromDate = null) => {
  const labour = await db.get('SELECT id, rate, daily_wage FROM labours WHERE id = ?', [labourId]);
  if (!labour) return;

  const history = await db.all(
    'SELECT previous_rate, new_rate, previous_daily_wage, new_daily_wage, date FROM salary_history WHERE labour_id = ? ORDER BY date ASC',
    [labourId]
  );

  let query = 'SELECT id, date, hours FROM overtime WHERE labour_id = ?';
  const params = [labourId];
  if (fromDate) {
    query += ' AND date >= ?';
    params.push(fromDate);
  }

  const overtimeRecords = await db.all(query, params);
  for (const ot of overtimeRecords) {
    const hourlyRate = getApplicableHourlyRate(labour, history, ot.date);
    const amount = (Number(ot.hours) || 0) * hourlyRate;
    await db.run('UPDATE overtime SET amount = ? WHERE id = ?', [amount, ot.id]);
  }
};

module.exports = {
  STANDARD_DAILY_HOURS,
  hourlyFromDailyWage,
  dailyWageFromLegacyHourly,
  dailyWageFromPayload,
  getLabourDailyWage,
  getLabourHourlyRate,
  getApplicableHourlyRate,
  syncLabourOvertimeAmounts,
  withWageCompatibility,
  withWageCompatibilityList,
};

