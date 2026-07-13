import * as XLSX from 'xlsx';

export interface SummaryExportRow {
  name: string;
  guildName: string;
  kransia: number;
  fieldBoss: number;
  guildBoss: number;
  guildvsguild: number;
  totalEventsAttended: number;
  computedTotalAttendance: number;
  participationPercent: number;
  computedPercentage: number;
  computedUsdtShare: number;
  computedMultiplier: number;
}

export interface WorkbookMetadata {
  totalFund: number;
  attendanceShare: number;
  managementShare: number;
  totalSessions: number;
  totalPoints: number;
}

export function buildAndDownloadAttendanceWorkbook(
  summaryRows: SummaryExportRow[],
  metadata: WorkbookMetadata
): void {
  const summarySection = [
    [null, 'Total Fund', { t: 'n', v: metadata.totalFund, z: '$#,##0.00' }],
    [null, 'Attendance Share (90%)', { t: 'n', v: metadata.attendanceShare, z: '$#,##0.00' }],
    [null, 'Management Share (10%)', { t: 'n', v: metadata.managementShare, z: '$#,##0.00' }],
    [null, 'Total Bosses', { t: 'n', v: metadata.totalSessions, z: '0' }],
    [null, 'Overall Points', { t: 'n', v: metadata.totalPoints, z: '#,##0' }],
    [],
  ];

  const header = [
    'No.',
    'Name',
    'Guild',
    'Kransia',
    'Field Boss',
    'Guild Boss',
    'Guild vs Guild',
    'Total Events Attended',
    'Total Points',
    'Participation%',
    '%',
    'USDT Share',
    'Multiplier',
  ];

  const data = summaryRows.map((row, index) => [
    index + 1,
    row.name,
    row.guildName,
    row.kransia,
    row.fieldBoss,
    row.guildBoss,
    row.guildvsguild,
    row.totalEventsAttended,
    row.computedTotalAttendance,
    Number(row.participationPercent.toFixed(2)),
    Number(row.computedPercentage.toFixed(2)),
    Number(row.computedUsdtShare.toFixed(2)),
    row.computedMultiplier,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...summarySection, header, ...data]);

  const firstRow = summaryRows[0];

  const legendRows = [
    ['Computation Legend:'],
  ];

  if (firstRow) {
    const attPct = Number(firstRow.computedPercentage.toFixed(2));
    const usdt = Number(firstRow.computedUsdtShare.toFixed(2));

    legendRows.push(
      ['Participation % = (Total Events Attended / Total Bosses) * 100'],
      [`Sample: Participation % = (${firstRow.totalEventsAttended} / ${metadata.totalSessions}) * 100 = ${Number(firstRow.participationPercent.toFixed(2))}%`],
      [],
      ['Attendance Percentage (%) = (Total Points / Overall Points) * 100'],
      [`Sample: Attendance Percentage (%) = (${firstRow.computedTotalAttendance} / ${metadata.totalPoints}) * 100 = ${attPct}%`],
      [],
      ['Usdt Share = Attendance Share * Attendance Percentage'],
      [`Sample: Usdt Share = $${Number(metadata.attendanceShare.toFixed(2)).toLocaleString()} * ${attPct}% = $${usdt.toLocaleString()}`],
    );
  } else {
    legendRows.push(
      ['Participation % = (Total Events Attended / Total Bosses) * 100'],
      [],
      ['Attendance Percentage (%) = (Total Points / Overall Points) * 100'],
      [],
      ['Usdt Share = Attendance Share * Attendance Percentage'],
    );
  }

  XLSX.utils.sheet_add_aoa(ws, legendRows, { origin: { r: 6, c: 15 } });

  ws['!cols'] = [
    { wch: 5 },   // No.
    { wch: 28 },  // Summary labels / Name
    { wch: 16 },  // Summary values / Guild
    { wch: 10 },  // Kransia
    { wch: 12 },  // Field Boss
    { wch: 12 },  // Guild Boss
    { wch: 16 },  // Guild vs Guild
    { wch: 22 },  // Total Events Attended
    { wch: 10 },  // Total Pts
    { wch: 16 },  // Participation%
    { wch: 8 },   // %
    { wch: 14 },  // USDT Share
    { wch: 10 },  // Multiplier
    { wch: 3 },   // N - spacer
    { wch: 3 },   // O - spacer
    { wch: 60 },  // P - Computation Legend
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');

  const now = new Date();
  const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const filename = `attendance-report-${datePart}.xlsx`;

  XLSX.writeFile(wb, filename);
}
