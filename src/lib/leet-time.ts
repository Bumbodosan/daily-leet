const LEET_HOUR = 13;
const LEET_MINUTE = 37;

const TRUTHY_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isLeetTimeForced() {
  const testMode = process.env.EXPO_PUBLIC_LEET_TEST_MODE;
  return typeof testMode === 'string' && TRUTHY_ENV_VALUES.has(testMode.toLowerCase());
}

export function isLeetMinute(date = new Date()) {
  if (isLeetTimeForced()) {
    return true;
  }

  return date.getHours() === LEET_HOUR && date.getMinutes() === LEET_MINUTE;
}
