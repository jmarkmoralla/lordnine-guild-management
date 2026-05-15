const SPECIAL_FIELD_BOSS_NAMES = new Set(['libitina', 'rakajeth', 'tumier']);

const normalizeAttendanceType = (attendanceType: string) => attendanceType.trim().toLowerCase();
const normalizeBossName = (bossName: string) => bossName.trim().toLowerCase();

export const getAttendancePoints = (attendanceType: string, bossName = ''): number => {
  const normalizedType = normalizeAttendanceType(attendanceType);

  if (normalizedType === 'kransia') return 10;
  if (normalizedType === 'guild boss') return 2;
  if (normalizedType === 'field boss' && SPECIAL_FIELD_BOSS_NAMES.has(normalizeBossName(bossName))) {
    return 5;
  }

  return 1;
};

export const getAttendancePointsForBossSelection = (
  attendanceType: string,
  bossNames: string[]
): number => {
  if (bossNames.length === 0) {
    return getAttendancePoints(attendanceType);
  }

  return bossNames.reduce(
    (totalPoints, bossName) => totalPoints + getAttendancePoints(attendanceType, bossName),
    0
  );
};