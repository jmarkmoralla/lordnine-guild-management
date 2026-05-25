const normalizeAttendanceSessionPart = (value: string) => value.trim().toLowerCase();

export const buildAttendanceSessionId = (eventDate: string, attendanceType: string, bossName: string) => (
  [eventDate.trim(), normalizeAttendanceSessionPart(attendanceType), normalizeAttendanceSessionPart(bossName)].join('|')
);

export const buildAttendanceSessionIdFromAttendanceDate = (
  attendanceDate: string,
  attendanceType: string,
  bossName: string
) => {
  const [datePart] = attendanceDate.split('T');
  return buildAttendanceSessionId(datePart || attendanceDate, attendanceType, bossName);
};