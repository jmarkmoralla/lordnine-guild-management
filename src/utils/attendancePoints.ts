type BossPointsMap = Map<string, number>;

const DEFAULT_POINTS = 1;

const normalizeAttendanceType = (attendanceType: string) => attendanceType.trim().toLowerCase();
const normalizeBossName = (bossName: string) => bossName.trim().toLowerCase();

export const getAttendancePoints = (
  attendanceType: string,
  bossName = '',
  bossPointsMap?: BossPointsMap
): number => {
  if (bossName && bossPointsMap) {
    const normalized = normalizeBossName(bossName);
    const customPoints = bossPointsMap.get(normalized);
    if (customPoints !== undefined) return customPoints;
  }

  const normalizedType = normalizeAttendanceType(attendanceType);
  if (normalizedType === 'kransia') return 10;
  if (normalizedType === 'guild boss') return 2;

  return DEFAULT_POINTS;
};

export const getAttendancePointsForBossSelection = (
  attendanceType: string,
  bossNames: string[],
  bossPointsMap?: BossPointsMap
): number => {
  if (bossNames.length === 0) {
    return getAttendancePoints(attendanceType, '', bossPointsMap);
  }

  return bossNames.reduce(
    (totalPoints, bossName) => totalPoints + getAttendancePoints(attendanceType, bossName, bossPointsMap),
    0
  );
};
